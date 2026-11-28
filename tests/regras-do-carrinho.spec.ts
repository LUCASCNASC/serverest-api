import { test, expect } from '../src/fixtures';
import { MENSAGENS } from '../src/dados/mensagens';
import { conferirEstoque } from '../src/verificacoes';
import { novoUsuarioComum } from '../src/dados/fabrica';

/**
 * Regras de negócio do carrinho que, se quebrarem, geram prejuízo real:
 * venda sem estoque, carrinho de outra pessoa, compra sem autenticação.
 *
 * A fixture `adminComProdutos` já entrega um administrador logado (token) com 2 produtos
 * cadastrados (10 unidades cada), criados na hora para este teste.
 */
test.describe('Regras do carrinho', { tag: '@regression' }, () => {
  for (const tipo of ['malformado', 'adulterado'] as const) {
    test(`não deve criar carrinho com token ${tipo}`, async ({
      api,
      adminComProdutos,
      clienteLogado,
    }) => {
      const [produto] = adminComProdutos.produtos;
      const partes = clienteLogado.token.split('.');
      const token =
        tipo === 'malformado'
          ? 'Bearer token-invalido'
          : `${partes[0]}.${partes[1]}.${partes[2][0] === 'A' ? 'B' : 'A'}${partes[2].slice(1)}`;

      const resposta = await api.carrinhos.cadastrar(
        [{ idProduto: produto._id, quantidade: 1 }],
        token,
      );
      expect(resposta.status()).toBe(401);
      expect(await resposta.json()).toEqual({ message: MENSAGENS.tokenInvalido });
      const carrinhos = await api.carrinhos.listarDoUsuario(clienteLogado.idUsuario);
      expect(carrinhos.status()).toBe(200);
      expect(await carrinhos.json()).toEqual({ quantidade: 0, carrinhos: [] });
      await conferirEstoque(api, produto, produto.quantidade);
    });
  }

  test('não deve criar carrinho com token de usuário excluído', async ({
    api,
    massa,
    adminComProdutos,
  }) => {
    const usuario = novoUsuarioComum();
    const cadastro = await api.usuarios.cadastrar(usuario);
    expect(cadastro.status()).toBe(201);
    const { _id } = await cadastro.jsonSucesso();
    massa.guardarUsuario(_id);
    const login = await api.login.entrar(usuario.email, usuario.password);
    expect(login.status()).toBe(200);
    const { authorization } = await login.jsonSucesso();
    const exclusao = await api.usuarios.excluir(_id);
    expect(exclusao.status()).toBe(200);
    expect(await exclusao.json()).toEqual({ message: MENSAGENS.registroExcluido });

    const [produto] = adminComProdutos.produtos;
    const resposta = await api.carrinhos.cadastrar(
      [{ idProduto: produto._id, quantidade: 1 }],
      authorization,
    );
    if (resposta.status() === 201) {
      const limpeza = await api.carrinhos.cancelarCompra(authorization);
      expect(limpeza.status(), 'limpeza de carrinho criado com token de usuário excluído').toBe(
        200,
      );
    }
    expect(resposta.status()).toBe(401);
    expect(await resposta.json()).toEqual({ message: MENSAGENS.tokenInvalido });
    const carrinhos = await api.carrinhos.listarDoUsuario(_id);
    expect(carrinhos.status()).toBe(200);
    expect(await carrinhos.json()).toEqual({ quantidade: 0, carrinhos: [] });
    await conferirEstoque(api, produto, produto.quantidade);
  });

  test('não deve criar carrinho com lista vazia de produtos', async ({
    api,
    adminComProdutos,
    clienteLogado,
  }) => {
    const resposta = await api.carrinhos.cadastrar([], clienteLogado.token);

    expect(resposta.status()).toBe(400);
    expect(await resposta.json()).toMatchObject({ produtos: expect.any(String) });
    const carrinhos = await api.carrinhos.listarDoUsuario(clienteLogado.idUsuario);
    expect(carrinhos.status()).toBe(200);
    expect(await carrinhos.json()).toEqual({ quantidade: 0, carrinhos: [] });
    for (const produto of adminComProdutos.produtos) {
      await conferirEstoque(api, produto, produto.quantidade);
    }
  });

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

  test('não deve baixar o estoque dos itens válidos quando outro produto não existe', async ({
    api,
    adminComProdutos,
    clienteLogado,
  }) => {
    const [produto] = adminComProdutos.produtos;

    const resposta = await api.carrinhos.cadastrar(
      [
        { idProduto: produto._id, quantidade: 2 },
        { idProduto: 'produtoQueNaoExiste', quantidade: 1 },
      ],
      clienteLogado.token,
    );

    expect(resposta.status()).toBe(400);
    expect(await resposta.json()).toMatchObject({ message: MENSAGENS.produtoNaoEncontrado });
    await conferirEstoque(api, produto, produto.quantidade);
  });

  test('não deve baixar parcialmente o estoque quando um item do carrinho está sem estoque', async ({
    api,
    adminComProdutos,
    clienteLogado,
  }) => {
    const [produtoDisponivel, produtoSemEstoqueSuficiente] = adminComProdutos.produtos;

    const resposta = await api.carrinhos.cadastrar(
      [
        { idProduto: produtoDisponivel._id, quantidade: 1 },
        {
          idProduto: produtoSemEstoqueSuficiente._id,
          quantidade: produtoSemEstoqueSuficiente.quantidade + 1,
        },
      ],
      clienteLogado.token,
    );

    expect(resposta.status()).toBe(400);
    expect(await resposta.json()).toMatchObject({ message: MENSAGENS.estoqueInsuficiente });
    await conferirEstoque(api, produtoDisponivel, produtoDisponivel.quantidade);
    await conferirEstoque(api, produtoSemEstoqueSuficiente, produtoSemEstoqueSuficiente.quantidade);
  });

  test('não deve criar carrinho sem token de autenticação', async ({ api, adminComProdutos }) => {
    const [produto] = adminComProdutos.produtos;

    const resposta = await api.carrinhos.cadastrar([{ idProduto: produto._id, quantidade: 1 }]);

    expect(resposta.status()).toBe(401);
    expect(await resposta.json()).toEqual({ message: MENSAGENS.tokenInvalido });
    await conferirEstoque(api, produto, produto.quantidade);
  });

  test('não deve permitir cancelar um carrinho sem token e nem alterar seu estoque', async ({
    api,
    adminComProdutos,
    clienteLogado,
  }) => {
    const [produto] = adminComProdutos.produtos;
    const cadastro = await api.carrinhos.cadastrar(
      [{ idProduto: produto._id, quantidade: 2 }],
      clienteLogado.token,
    );
    expect(cadastro.status()).toBe(201);
    const { _id: idCarrinho } = await cadastro.jsonSucesso();

    const resposta = await api.carrinhos.cancelarCompra('');

    expect(resposta.status()).toBe(401);
    expect(await resposta.json()).toEqual({ message: MENSAGENS.tokenInvalido });
    const carrinho = await api.carrinhos.buscarPorId(idCarrinho);
    expect(carrinho.status()).toBe(200);
    await conferirEstoque(api, produto, produto.quantidade - 2);
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

  test('cancelar compra sem carrinho responde 200, mas com mensagem diferente', async ({
    api,
    clienteLogado,
  }) => {
    const resposta = await api.carrinhos.cancelarCompra(clienteLogado.token);

    expect(resposta.status()).toBe(200);
    expect(await resposta.json()).toEqual({ message: MENSAGENS.usuarioSemCarrinho });
  });
});

test.describe('Limites do estoque', { tag: '@regression' }, () => {
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
