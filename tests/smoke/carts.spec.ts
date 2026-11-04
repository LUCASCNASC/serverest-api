import { test, expect } from '../../src/fixtures';
import { MENSAGENS } from '../../src/dados/mensagens';
import { conferirEstoque } from '../../src/verificacoes';

test.describe('Smoke: carrinhos', { tag: ['@smoke', '@regression', '@critical'] }, () => {
  test('lista, cria, consulta e cancela um carrinho, repondo o estoque', async ({
    api,
    adminComProdutos,
    clienteLogado,
  }) => {
    const listaInicial = await api.carrinhos.listarDoUsuario(clienteLogado.idUsuario);
    expect(listaInicial.status()).toBe(200);
    expect(await listaInicial.json()).toEqual({ quantidade: 0, carrinhos: [] });

    const [produto] = adminComProdutos.produtos;
    const itens = [{ idProduto: produto._id, quantidade: 2 }];
    const cadastro = await api.carrinhos.cadastrar(itens, clienteLogado.token);
    expect(cadastro.status()).toBe(201);
    const carrinhoCriado = await cadastro.json();
    expect(carrinhoCriado).toEqual({
      message: MENSAGENS.cadastroComSucesso,
      _id: expect.any(String),
    });

    await conferirEstoque(api, produto, produto.quantidade - 2);

    const consulta = await api.carrinhos.buscarPorId(carrinhoCriado._id);
    expect(consulta.status()).toBe(200);
    const carrinhoEsperado = {
      _id: carrinhoCriado._id,
      idUsuario: clienteLogado.idUsuario,
      produtos: [{ ...itens[0], precoUnitario: produto.preco }],
      quantidadeTotal: 2,
      precoTotal: produto.preco * 2,
    };
    expect(await consulta.json()).toEqual(carrinhoEsperado);

    const lista = await api.carrinhos.listarDoUsuario(clienteLogado.idUsuario);
    expect(lista.status()).toBe(200);
    expect(await lista.json()).toEqual({ quantidade: 1, carrinhos: [carrinhoEsperado] });

    const cancelamento = await api.carrinhos.cancelarCompra(clienteLogado.token);
    expect(cancelamento.status()).toBe(200);
    expect(await cancelamento.json()).toEqual({ message: MENSAGENS.compraCancelada });

    const carrinhoCancelado = await api.carrinhos.buscarPorId(carrinhoCriado._id);
    expect(carrinhoCancelado.status()).toBe(400);
    expect(await carrinhoCancelado.json()).toEqual({
      message: MENSAGENS.carrinhoNaoEncontrado,
    });
    await conferirEstoque(api, produto, produto.quantidade);
  });

  test('conclui uma compra e mantém o estoque reservado', async ({
    api,
    adminComProdutos,
    clienteLogado,
  }) => {
    const [produto] = adminComProdutos.produtos;
    const cadastro = await api.carrinhos.cadastrar(
      [{ idProduto: produto._id, quantidade: 1 }],
      clienteLogado.token,
    );
    expect(cadastro.status()).toBe(201);
    const carrinhoCriado = await cadastro.json();

    const conclusao = await api.carrinhos.concluirCompra(clienteLogado.token);
    expect(conclusao.status()).toBe(200);
    expect(await conclusao.json()).toEqual({ message: MENSAGENS.registroExcluido });

    const carrinhoConcluido = await api.carrinhos.buscarPorId(carrinhoCriado._id);
    expect(carrinhoConcluido.status()).toBe(400);
    expect(await carrinhoConcluido.json()).toEqual({
      message: MENSAGENS.carrinhoNaoEncontrado,
    });
    await conferirEstoque(api, produto, produto.quantidade - 1);
  });
});
