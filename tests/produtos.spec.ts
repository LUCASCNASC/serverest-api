import { test, expect } from '../src/fixtures';
import { novoProduto } from '../src/dados/fabrica';
import { MENSAGENS } from '../src/dados/mensagens';

test.describe('Permissões do administrador', { tag: '@regression' }, () => {
  for (const campo of ['preco', 'quantidade'] as const) {
    test(`não deve cadastrar produto com ${campo} negativo`, async ({
      api,
      massa,
      adminLogado,
    }) => {
      const produto = { ...novoProduto(), [campo]: -1 };
      const resposta = await api.produtos.cadastrar(produto, adminLogado.token);
      if (resposta.status() === 201) {
        massa.guardarProduto((await resposta.jsonSucesso())._id, adminLogado.token);
      }

      expect(resposta.status()).toBe(400);
      expect(await resposta.json()).toMatchObject({ [campo]: expect.any(String) });
      const lista = await api.produtos.listar();
      expect(lista.status()).toBe(200);
      expect((await lista.jsonSucesso()).produtos.some((item) => item.nome === produto.nome)).toBe(
        false,
      );
    });

    test(`não deve atualizar produto com ${campo} negativo`, async ({ api, adminComProdutos }) => {
      const [produto] = adminComProdutos.produtos;
      const { _id, ...dados } = produto;
      const resposta = await api.produtos.editar(
        _id,
        { ...dados, [campo]: -1 },
        adminComProdutos.token,
      );

      expect(resposta.status()).toBe(400);
      expect(await resposta.json()).toMatchObject({ [campo]: expect.any(String) });
      const consulta = await api.produtos.buscarPorId(_id);
      expect(consulta.status()).toBe(200);
      expect(await consulta.json()).toEqual(produto);
    });
  }

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

      const corpo = await resposta.jsonSucesso();
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

  test('não deve atualizar produto para um nome que já pertence a outro produto', async ({
    api,
    adminComProdutos,
  }) => {
    const [produtoExistente, produtoAAtualizar] = adminComProdutos.produtos;
    const resposta = await api.produtos.editar(
      produtoAAtualizar._id,
      {
        nome: produtoExistente.nome,
        preco: produtoAAtualizar.preco,
        descricao: produtoAAtualizar.descricao,
        quantidade: produtoAAtualizar.quantidade,
      },
      adminComProdutos.token,
    );

    expect(resposta.status()).toBe(400);
    expect(await resposta.json()).toEqual({ message: MENSAGENS.nomeDeProdutoRepetido });

    const consulta = await api.produtos.buscarPorId(produtoAAtualizar._id);
    expect(consulta.status()).toBe(200);
    expect(await consulta.json()).toEqual(produtoAAtualizar);
  });
});

test.describe('Permissões do usuário comum', { tag: '@regression' }, () => {
  test('não deve permitir que usuário comum cadastre produto', async ({ api, clienteLogado }) => {
    // O token é válido (login funcionou), mas o perfil não tem permissão.
    // A diferença entre 401 (quem é você?) e 403 (sei quem é, mas não pode)
    // mostra que a API reconheceu o usuário e aplicou a regra de perfil.
    const resposta = await api.produtos.cadastrar(novoProduto(), clienteLogado.token);

    expect(resposta.status()).toBe(403);
    expect(await resposta.json()).toEqual({ message: MENSAGENS.rotaDeAdministrador });
  });

  test('não deve permitir que usuário comum altere produto', async ({
    api,
    adminComProdutos,
    clienteLogado,
  }) => {
    const [produto] = adminComProdutos.produtos;
    const { _id, ...dados } = produto;
    const resposta = await api.produtos.editar(
      _id,
      { ...dados, preco: dados.preco + 1 },
      clienteLogado.token,
    );

    expect(resposta.status()).toBe(403);
    expect(await resposta.json()).toEqual({ message: MENSAGENS.rotaDeAdministrador });
    const consulta = await api.produtos.buscarPorId(_id);
    expect(consulta.status()).toBe(200);
    expect(await consulta.json()).toEqual(produto);
  });

  test('não deve permitir que usuário comum exclua produto', async ({
    api,
    adminComProdutos,
    clienteLogado,
  }) => {
    const [produto] = adminComProdutos.produtos;
    const resposta = await api.produtos.excluir(produto._id, clienteLogado.token);

    expect(resposta.status()).toBe(403);
    expect(await resposta.json()).toEqual({ message: MENSAGENS.rotaDeAdministrador });
    const consulta = await api.produtos.buscarPorId(produto._id);
    expect(consulta.status()).toBe(200);
    expect(await consulta.json()).toEqual(produto);
  });

  test('deve comprar produtos cadastrados por um administrador', async ({
    api,
    adminComProdutos,
    clienteLogado,
  }) => {
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
      idCarrinho = (await resposta.jsonSucesso())._id;
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
  });
});
