import { test, expect } from '../src/fixtures';
import { novoProduto, novoUsuarioAdministrador, novoUsuarioComum } from '../src/dados/fabrica';
import { MENSAGENS } from '../src/dados/mensagens';
import { lerConteudoDoJwt } from '../src/verificacoes';

/**
 * A ServeRest tem dois perfis de usuário:
 *   - administrador: gerencia o catálogo (cadastra produtos);
 *   - comum: o cliente, que só compra.
 *
 * Cadastro e login funcionam igual para os dois, então rodam os mesmos testes
 * para cada perfil. O que muda entre eles são as permissões, que ficam em
 * blocos separados no final.
 */
const PERFIS = [
  { nome: 'administrador', novoUsuario: novoUsuarioAdministrador },
  { nome: 'comum', novoUsuario: novoUsuarioComum },
];

for (const perfil of PERFIS) {
  test.describe(`Usuário ${perfil.nome}: cadastro e login`, { tag: '@regressao' }, () => {
    test('deve cadastrar o usuário e persistir os dados enviados', async ({ api, massa }) => {
      const usuario = perfil.novoUsuario();
      let idUsuario: string;

      await test.step(`Cadastrar o usuário com administrador = "${usuario.administrador}"`, async () => {
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

      await test.step('Consultar o usuário pelo ID e conferir o que foi gravado', async () => {
        const resposta = await api.usuarios.buscarPorId(idUsuario);
        expect(resposta.status()).toBe(200);
        // Corpo inteiro: confirma nome, e-mail, senha e, principalmente,
        // que o perfil foi gravado como o esperado.
        expect(await resposta.json()).toEqual({ ...usuario, _id: idUsuario });
      });
    });

    test('deve fazer login e receber um token do próprio usuário', async ({ api, massa }) => {
      const usuario = perfil.novoUsuario();

      await test.step('Pré-condição: cadastrar o usuário', async () => {
        const resposta = await api.usuarios.cadastrar(usuario);
        expect(resposta.status()).toBe(201);
        massa.guardarUsuario((await resposta.json())._id);
      });

      await test.step('Fazer login com e-mail e senha cadastrados', async () => {
        const resposta = await api.login.entrar(usuario.email, usuario.password);
        expect(resposta.status()).toBe(200);

        const corpo = await resposta.json();
        expect(corpo).toEqual({
          message: MENSAGENS.loginComSucesso,
          authorization: expect.stringMatching(/^Bearer \S+$/),
        });
        massa.guardarToken(corpo.authorization);

        // O token é um JWT. Abrindo o conteúdo dele, conferimos que foi
        // emitido para o usuário que fez login, e não para qualquer outro.
        expect(lerConteudoDoJwt(corpo.authorization).email).toBe(usuario.email);
      });
    });
  });
}

test.describe('Regras de cadastro e login', { tag: '@regressao' }, () => {
  test('não deve cadastrar usuário com e-mail já utilizado', async ({ api, clienteLogado }) => {
    const outroUsuarioMesmoEmail = { ...novoUsuarioComum(), email: clienteLogado.dados.email };

    const resposta = await api.usuarios.cadastrar(outroUsuarioMesmoEmail);

    expect(resposta.status()).toBe(400);
    expect(await resposta.json()).toEqual({ message: MENSAGENS.emailJaUtilizado });
  });

  test('não deve fazer login com senha errada', async ({ api, clienteLogado }) => {
    const resposta = await api.login.entrar(clienteLogado.dados.email, 'senhaErrada123');

    expect(resposta.status()).toBe(401);
    expect(await resposta.json()).toEqual({ message: MENSAGENS.loginInvalido });
  });
});

test.describe('Permissões do administrador', { tag: '@regressao' }, () => {
  test('deve cadastrar produto e o produto ficar disponível para consulta', async ({
    api,
    massa,
    adminLogado,
  }) => {
    const produto = novoProduto();
    let idProduto: string;

    await test.step('Admin cadastra o produto com o próprio token', async () => {
      const resposta = await api.produtos.cadastrar(produto, adminLogado.token);
      expect(resposta.status()).toBe(201);

      const corpo = await resposta.json();
      expect(corpo).toEqual({
        message: MENSAGENS.cadastroComSucesso,
        _id: expect.any(String),
      });

      idProduto = corpo._id;
      massa.guardarProduto(idProduto, adminLogado.token);
    });

    await test.step('Consultar o produto pelo ID e conferir o que foi gravado', async () => {
      const resposta = await api.produtos.buscarPorId(idProduto);
      expect(resposta.status()).toBe(200);
      expect(await resposta.json()).toEqual({ ...produto, _id: idProduto });
    });
  });

  test('não deve cadastrar produto com nome já utilizado', async ({ api, adminComProdutos }) => {
    const [produtoExistente] = adminComProdutos.produtos;
    const produtoMesmoNome = { ...novoProduto(), nome: produtoExistente.nome };

    const resposta = await api.produtos.cadastrar(produtoMesmoNome, adminComProdutos.token);

    expect(resposta.status()).toBe(400);
    expect(await resposta.json()).toEqual({ message: MENSAGENS.nomeDeProdutoRepetido });
  });
});

test.describe('Permissões do usuário comum', { tag: '@regressao' }, () => {
  test('não deve permitir que usuário comum cadastre produto', async ({ api, clienteLogado }) => {
    // O token é válido (login funcionou), mas o perfil não tem permissão.
    // A diferença entre 401 (quem é você?) e 403 (sei quem é, mas não pode)
    // mostra que a API reconheceu o usuário e aplicou a regra de perfil.
    const resposta = await api.produtos.cadastrar(novoProduto(), clienteLogado.token);

    expect(resposta.status()).toBe(403);
    expect(await resposta.json()).toEqual({ message: MENSAGENS.rotaDeAdministrador });
  });

  // @smoke (além do @regressao herdado do describe): é a compra mais próxima do
  // uso real, um cliente comprando o que o administrador cadastrou.
  test(
    'deve comprar produtos cadastrados por um administrador',
    { tag: '@smoke' },
    async ({ api, adminComProdutos, clienteLogado }) => {
      // Integração entre os dois perfis: os IDs dos produtos vêm do admin,
      // e o carrinho é criado com o token do cliente.
      const [produto] = adminComProdutos.produtos;
      let idCarrinho: string;

      await test.step('Cliente cria o carrinho com o próprio token', async () => {
        const resposta = await api.carrinhos.cadastrar(
          [{ idProduto: produto._id, quantidade: 2 }],
          clienteLogado.token,
        );
        expect(resposta.status()).toBe(201);
        idCarrinho = (await resposta.json())._id;
      });

      await test.step('Carrinho pertence ao cliente, não ao administrador', async () => {
        const resposta = await api.carrinhos.buscarPorId(idCarrinho);
        expect(resposta.status()).toBe(200);
        expect(await resposta.json()).toEqual({
          _id: idCarrinho,
          idUsuario: clienteLogado.idUsuario,
          produtos: [{ idProduto: produto._id, quantidade: 2, precoUnitario: produto.preco }],
          quantidadeTotal: 2,
          precoTotal: produto.preco * 2,
        });
      });

      await test.step('Cliente conclui a compra', async () => {
        const resposta = await api.carrinhos.concluirCompra(clienteLogado.token);
        expect(resposta.status()).toBe(200);
        expect(await resposta.json()).toEqual({ message: MENSAGENS.registroExcluido });

        const carrinho = await api.carrinhos.buscarPorId(idCarrinho);
        expect(carrinho.status()).toBe(400);
      });
    },
  );
});
