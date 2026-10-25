import { test, expect } from '../src/fixtures';
import { MENSAGENS } from '../src/dados/mensagens';
import { conferirEstoque } from '../src/verificacoes';

/**
 * Regras de negócio do carrinho que, se quebrarem, geram prejuízo real:
 * venda sem estoque, carrinho de outra pessoa, compra sem autenticação.
 *
 * A fixture `adminComProdutos` já entrega um administrador logado (token) com 2 produtos
 * cadastrados (10 unidades cada), criados na hora para este teste.
 */
test.describe('Regras do carrinho', { tag: '@regressao' }, () => {
  test('não deve permitir mais de um carrinho por usuário', async ({ api, adminComProdutos }) => {
    const [produtoA, produtoB] = adminComProdutos.produtos;

    const primeiro = await api.carrinhos.cadastrar(
      [{ idProduto: produtoA._id, quantidade: 1 }],
      adminComProdutos.token,
    );
    expect(primeiro.status()).toBe(201);

    const segundo = await api.carrinhos.cadastrar(
      [{ idProduto: produtoB._id, quantidade: 1 }],
      adminComProdutos.token,
    );
    expect(segundo.status()).toBe(400);
    expect(await segundo.json()).toEqual({ message: MENSAGENS.maisDeUmCarrinho });

    // O segundo carrinho rejeitado não pode ter mexido no estoque.
    await conferirEstoque(api, produtoB, produtoB.quantidade);
  });

  test('não deve permitir comprar mais do que o estoque disponível', async ({
    api,
    adminComProdutos,
  }) => {
    const [produto] = adminComProdutos.produtos;

    const resposta = await api.carrinhos.cadastrar(
      [{ idProduto: produto._id, quantidade: produto.quantidade + 1 }],
      adminComProdutos.token,
    );

    expect(resposta.status()).toBe(400);
    expect(await resposta.json()).toMatchObject({ message: MENSAGENS.estoqueInsuficiente });
    await conferirEstoque(api, produto, produto.quantidade);
  });

  test('não deve permitir o mesmo produto repetido no carrinho', async ({
    api,
    adminComProdutos,
  }) => {
    const [produto] = adminComProdutos.produtos;

    const resposta = await api.carrinhos.cadastrar(
      [
        { idProduto: produto._id, quantidade: 1 },
        { idProduto: produto._id, quantidade: 1 },
      ],
      adminComProdutos.token,
    );

    expect(resposta.status()).toBe(400);
    expect(await resposta.json()).toMatchObject({ message: MENSAGENS.produtoDuplicado });
  });

  test('não deve permitir carrinho com produto inexistente', async ({ api, adminComProdutos }) => {
    const resposta = await api.carrinhos.cadastrar(
      [{ idProduto: 'produtoQueNaoExiste', quantidade: 1 }],
      adminComProdutos.token,
    );

    expect(resposta.status()).toBe(400);
    expect(await resposta.json()).toMatchObject({ message: MENSAGENS.produtoNaoEncontrado });
  });

  test('não deve criar carrinho sem token de autenticação', async ({ api, adminComProdutos }) => {
    const [produto] = adminComProdutos.produtos;

    const resposta = await api.carrinhos.cadastrar([{ idProduto: produto._id, quantidade: 1 }]);

    expect(resposta.status()).toBe(401);
    expect(await resposta.json()).toEqual({ message: MENSAGENS.tokenInvalido });
    await conferirEstoque(api, produto, produto.quantidade);
  });

  test('concluir compra sem carrinho responde 200, mas com mensagem diferente', async ({
    api,
    adminComProdutos,
  }) => {
    // Sem carrinho, a API mantém o status 200; a mensagem identifica o resultado real.
    const resposta = await api.carrinhos.concluirCompra(adminComProdutos.token);

    expect(resposta.status()).toBe(200);
    expect(await resposta.json()).toEqual({ message: MENSAGENS.usuarioSemCarrinho });
  });
});

test.describe('Limites do estoque', { tag: '@regressao' }, () => {
  // Quantidade zero ou negativa é o caso mais perigoso: se fosse aceita, criar o
  // carrinho "devolveria" unidades e o estoque AUMENTARIA sem nenhuma compra real.
  for (const quantidade of [0, -5]) {
    test(`não deve aceitar carrinho com quantidade ${quantidade}`, async ({
      api,
      adminComProdutos,
      clienteLogado,
    }) => {
      const [produto] = adminComProdutos.produtos;

      const resposta = await api.carrinhos.cadastrar(
        [{ idProduto: produto._id, quantidade }],
        clienteLogado.token,
      );

      expect(resposta.status()).toBe(400);
      expect(await resposta.json()).toMatchObject({
        'produtos[0].quantidade': MENSAGENS.quantidadeNaoPositiva,
      });
      await conferirEstoque(api, produto, produto.quantidade);
    });
  }

  // O valor limite superior (comprar exatamente todo o estoque) é coberto no
  // primeiro passo do teste de disputa de estoque, em integridade-do-carrinho.
});

test.describe('Ciclo de vida do carrinho', { tag: '@regressao' }, () => {
  test('deve permitir uma nova compra depois de concluir a anterior', async ({
    api,
    adminComProdutos,
    clienteLogado,
  }) => {
    // A regra de "1 carrinho por usuário" precisa ser liberada ao concluir;
    // senão o cliente só conseguiria comprar uma única vez na vida.
    const [produtoA, produtoB] = adminComProdutos.produtos;

    await test.step('Primeira compra: criar o carrinho e concluir', async () => {
      const carrinho = await api.carrinhos.cadastrar(
        [{ idProduto: produtoA._id, quantidade: 1 }],
        clienteLogado.token,
      );
      expect(carrinho.status()).toBe(201);

      const conclusao = await api.carrinhos.concluirCompra(clienteLogado.token);
      expect(conclusao.status()).toBe(200);
      expect(await conclusao.json()).toEqual({ message: MENSAGENS.registroExcluido });
    });

    await test.step('Segunda compra: um novo carrinho é aceito', async () => {
      const resposta = await api.carrinhos.cadastrar(
        [{ idProduto: produtoB._id, quantidade: 1 }],
        clienteLogado.token,
      );
      expect(resposta.status()).toBe(201);

      const { _id: idNovoCarrinho } = await resposta.json();
      const consulta = await api.carrinhos.buscarPorId(idNovoCarrinho);
      expect(consulta.status()).toBe(200);
      expect(await consulta.json()).toMatchObject({
        idUsuario: clienteLogado.idUsuario,
        produtos: [{ idProduto: produtoB._id, quantidade: 1 }],
      });
    });
  });
});
