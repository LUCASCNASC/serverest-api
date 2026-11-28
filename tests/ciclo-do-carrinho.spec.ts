import { test, expect } from '../src/fixtures';
import { MENSAGENS } from '../src/dados/mensagens';
import { conferirEstoque } from '../src/verificacoes';

test.describe('Repetição de encerramento do carrinho', { tag: '@regression' }, () => {
  for (const operacao of ['concluir', 'cancelar'] as const) {
    test(`repetir ${operacao} compra não altera o estoque novamente`, async ({
      api,
      adminComProdutos,
      clienteLogado,
    }) => {
      const [produto] = adminComProdutos.produtos;
      const carrinho = await api.carrinhos.cadastrar(
        [{ idProduto: produto._id, quantidade: 2 }],
        clienteLogado.token,
      );
      expect(carrinho.status()).toBe(201);
      const { _id } = await carrinho.jsonSucesso();
      const encerrar = () =>
        operacao === 'concluir'
          ? api.carrinhos.concluirCompra(clienteLogado.token)
          : api.carrinhos.cancelarCompra(clienteLogado.token);
      const primeira = await encerrar();
      expect(primeira.status()).toBe(200);
      expect(await primeira.json()).toEqual({
        message: operacao === 'concluir' ? MENSAGENS.registroExcluido : MENSAGENS.compraCancelada,
      });
      const estoqueEsperado = operacao === 'concluir' ? produto.quantidade - 2 : produto.quantidade;
      await conferirEstoque(api, produto, estoqueEsperado);

      const segunda = await encerrar();
      expect(segunda.status()).toBe(200);
      expect(await segunda.json()).toEqual({ message: MENSAGENS.usuarioSemCarrinho });
      const consulta = await api.carrinhos.buscarPorId(_id);
      expect(consulta.status()).toBe(400);
      await conferirEstoque(api, produto, estoqueEsperado);
    });
  }
});

test.describe('Ciclo de vida do carrinho', { tag: ['@regression', '@critical'] }, () => {
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

      const { _id: idNovoCarrinho } = await resposta.jsonSucesso();
      const consulta = await api.carrinhos.buscarPorId(idNovoCarrinho);
      expect(consulta.status()).toBe(200);
      expect(await consulta.json()).toMatchObject({
        idUsuario: clienteLogado.idUsuario,
        produtos: [{ idProduto: produtoB._id, quantidade: 1 }],
      });
    });
  });

  test('deve permitir uma nova compra depois de cancelar a anterior e repor o estoque', async ({
    api,
    adminComProdutos,
    clienteLogado,
  }) => {
    const [produtoA, produtoB] = adminComProdutos.produtos;

    const primeiroCarrinho = await api.carrinhos.cadastrar(
      [{ idProduto: produtoA._id, quantidade: 2 }],
      clienteLogado.token,
    );
    expect(primeiroCarrinho.status()).toBe(201);
    const { _id: idPrimeiroCarrinho } = await primeiroCarrinho.jsonSucesso();
    await conferirEstoque(api, produtoA, produtoA.quantidade - 2);

    const cancelamento = await api.carrinhos.cancelarCompra(clienteLogado.token);
    expect(cancelamento.status()).toBe(200);
    expect(await cancelamento.json()).toEqual({ message: MENSAGENS.compraCancelada });
    await conferirEstoque(api, produtoA, produtoA.quantidade);

    const segundoCarrinho = await api.carrinhos.cadastrar(
      [{ idProduto: produtoB._id, quantidade: 1 }],
      clienteLogado.token,
    );
    expect(segundoCarrinho.status()).toBe(201);
    const { _id: idSegundoCarrinho } = await segundoCarrinho.jsonSucesso();

    expect(idSegundoCarrinho).not.toBe(idPrimeiroCarrinho);
    await conferirEstoque(api, produtoB, produtoB.quantidade - 1);
  });
});
