import { test, expect } from '../src/fixtures';
import { novoProduto, novoUsuarioAdministrador } from '../src/dados/fabrica';
import { MENSAGENS } from '../src/dados/mensagens';
import { conferirEstoque } from '../src/verificacoes';
import type { ServeRest } from '../src/api/serverest';
import type { Carrinho, ItemDoCarrinho, ProdutoCadastrado } from '../src/tipos';

/**
 * Fluxo principal de negócio da ServeRest:
 *   1. cadastrar usuário → 2. login (token) → 3. cadastrar produtos (IDs)
 *   → 4. criar, consultar e encerrar o carrinho.
 *
 * Os passos 1 a 3 rodam no beforeEach e alimentam as variáveis abaixo, que
 * são usadas no passo 4. Como a base é zerada toda noite, todos os dados são
 * criados aqui mesmo, a cada execução.
 *
 * Tags:
 *   @desafio-tecnico → é exatamente o fluxo obrigatório pedido no desafio;
 *   @smoke           → é o caminho essencial do negócio;
 *   @regressao       → como todo teste, faz parte da suíte completa.
 */
test.describe('Fluxo de compra', { tag: ['@desafio-tecnico', '@smoke', '@regressao'] }, () => {
  let idUsuario: string;
  let token: string;
  let produtos: ProdutoCadastrado[];

  test.beforeEach(async ({ api, massa }) => {
    const usuario = novoUsuarioAdministrador();

    await test.step('1. Cadastrar um novo usuário administrador', async () => {
      const resposta = await api.usuarios.cadastrar(usuario);
      expect(resposta.status()).toBe(201);

      const corpo = await resposta.json();
      expect(corpo).toEqual({
        message: MENSAGENS.cadastroComSucesso,
        _id: expect.any(String),
      });

      idUsuario = corpo._id;
      massa.guardarUsuario(idUsuario);
    });

    await test.step('2. Fazer login com o usuário criado e guardar o token', async () => {
      const resposta = await api.login.entrar(usuario.email, usuario.password);
      expect(resposta.status()).toBe(200);

      const corpo = await resposta.json();
      expect(corpo.message).toBe(MENSAGENS.loginComSucesso);
      expect(corpo.authorization).toMatch(/^Bearer \S+$/);

      token = corpo.authorization;
      massa.guardarToken(token);
    });

    await test.step('3. Cadastrar com o token os produtos da compra', async () => {
      produtos = [];
      for (const produto of [novoProduto(), novoProduto()]) {
        const resposta = await api.produtos.cadastrar(produto, token);
        expect(resposta.status()).toBe(201);

        const corpo = await resposta.json();
        expect(corpo).toEqual({
          message: MENSAGENS.cadastroComSucesso,
          _id: expect.any(String),
        });

        massa.guardarProduto(corpo._id, token);
        produtos.push({ ...produto, _id: corpo._id });
      }
    });
  });

  test('deve criar, consultar e concluir a compra, mantendo o estoque baixado', async ({ api }) => {
    const [produtoA, produtoB] = produtos;
    const itens: ItemDoCarrinho[] = [
      { idProduto: produtoA._id, quantidade: 2 },
      { idProduto: produtoB._id, quantidade: 1 },
    ];

    const idCarrinho = await criarCarrinho(api, itens);
    await consultarCarrinho(api, idCarrinho, itens);

    await test.step('Estoque é reservado ao criar o carrinho', async () => {
      await conferirEstoque(api, produtoA, produtoA.quantidade - 2);
      await conferirEstoque(api, produtoB, produtoB.quantidade - 1);
    });

    await test.step('4.3 Concluir a compra (DELETE /carrinhos/concluir-compra)', async () => {
      const resposta = await api.carrinhos.concluirCompra(token);
      expect(resposta.status()).toBe(200);
      // Só o status não basta: a API também responde 200 quando NÃO há
      // carrinho para excluir. É a mensagem que confirma a exclusão.
      expect(await resposta.json()).toEqual({ message: MENSAGENS.registroExcluido });
    });

    await garantirQueCarrinhoFoiExcluido(api, idCarrinho);

    await test.step('Estoque continua baixado após concluir a compra', async () => {
      await conferirEstoque(api, produtoA, produtoA.quantidade - 2);
      await conferirEstoque(api, produtoB, produtoB.quantidade - 1);
    });
  });

  test('deve criar, consultar e cancelar a compra, devolvendo o estoque', async ({ api }) => {
    const [produtoA, produtoB] = produtos;
    const itens: ItemDoCarrinho[] = [
      { idProduto: produtoA._id, quantidade: 3 },
      { idProduto: produtoB._id, quantidade: 1 },
    ];

    const idCarrinho = await criarCarrinho(api, itens);
    await consultarCarrinho(api, idCarrinho, itens);

    await test.step('Estoque é reservado ao criar o carrinho', async () => {
      await conferirEstoque(api, produtoA, produtoA.quantidade - 3);
      await conferirEstoque(api, produtoB, produtoB.quantidade - 1);
    });

    await test.step('4.3 Cancelar a compra (DELETE /carrinhos/cancelar-compra)', async () => {
      const resposta = await api.carrinhos.cancelarCompra(token);
      expect(resposta.status()).toBe(200);
      expect(await resposta.json()).toEqual({ message: MENSAGENS.compraCancelada });
    });

    await garantirQueCarrinhoFoiExcluido(api, idCarrinho);

    await test.step('Estoque volta ao valor original após cancelar a compra', async () => {
      await conferirEstoque(api, produtoA, produtoA.quantidade);
      await conferirEstoque(api, produtoB, produtoB.quantidade);
    });
  });

  // ---------------------------------------------------------------------------
  // Passos reaproveitados pelos dois testes acima. Ficam dentro do describe
  // para enxergar o token, o usuário e os produtos criados no beforeEach.
  // ---------------------------------------------------------------------------

  async function criarCarrinho(api: ServeRest, itens: ItemDoCarrinho[]) {
    return test.step('4.1 Criar o carrinho com o token e os IDs dos produtos', async () => {
      const resposta = await api.carrinhos.cadastrar(itens, token);
      expect(resposta.status()).toBe(201);

      const corpo = await resposta.json();
      expect(corpo).toEqual({
        message: MENSAGENS.cadastroComSucesso,
        _id: expect.any(String),
      });

      return corpo._id;
    });
  }

  async function consultarCarrinho(api: ServeRest, idCarrinho: string, itens: ItemDoCarrinho[]) {
    // O carrinho esperado é calculado a partir do que cadastramos: preço
    // unitário vem do produto, e os totais são a soma dos itens.
    const carrinhoEsperado: Carrinho = {
      _id: idCarrinho,
      idUsuario,
      produtos: itens.map((item) => ({
        ...item,
        precoUnitario: precoDoProduto(item.idProduto),
      })),
      quantidadeTotal: itens.reduce((total, item) => total + item.quantidade, 0),
      precoTotal: itens.reduce(
        (total, item) => total + item.quantidade * precoDoProduto(item.idProduto),
        0,
      ),
    };

    await test.step('4.2 Consultar o carrinho pelo ID (GET /carrinhos/{id})', async () => {
      const resposta = await api.carrinhos.buscarPorId(idCarrinho);
      expect(resposta.status()).toBe(200);
      expect(await resposta.json()).toEqual(carrinhoEsperado);
    });

    await test.step('4.2 Listar os carrinhos do usuário (GET /carrinhos?idUsuario=)', async () => {
      const resposta = await api.carrinhos.listarDoUsuario(idUsuario);
      expect(resposta.status()).toBe(200);
      expect(await resposta.json()).toEqual({ quantidade: 1, carrinhos: [carrinhoEsperado] });
    });
  }

  async function garantirQueCarrinhoFoiExcluido(api: ServeRest, idCarrinho: string) {
    await test.step('Carrinho não existe mais após o DELETE', async () => {
      const porId = await api.carrinhos.buscarPorId(idCarrinho);
      expect(porId.status()).toBe(400);
      expect(await porId.json()).toEqual({ message: MENSAGENS.carrinhoNaoEncontrado });

      const doUsuario = await api.carrinhos.listarDoUsuario(idUsuario);
      expect(doUsuario.status()).toBe(200);
      expect(await doUsuario.json()).toEqual({ quantidade: 0, carrinhos: [] });
    });
  }

  function precoDoProduto(idProduto: string) {
    const produto = produtos.find((p) => p._id === idProduto);
    if (!produto) throw new Error(`Produto ${idProduto} não foi cadastrado neste teste`);
    return produto.preco;
  }
});
