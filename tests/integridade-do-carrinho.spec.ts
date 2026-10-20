import { test, expect } from '../src/fixtures';
import { MENSAGENS } from '../src/dados/mensagens';
import { conferirEstoque } from '../src/verificacoes';

/**
 * O carrinho se liga a outros dados: ao cliente dono dele e aos produtos que
 * contém. Esta suíte garante que essas ligações não se quebram:
 *   - entre clientes: o que um faz não afeta o carrinho do outro;
 *   - com os dados vinculados: produto e usuário não somem nem mudam por baixo
 *     de um carrinho em andamento.
 */
test.describe('Integridade entre clientes', { tag: '@regressao' }, () => {
  test('concluir a compra de um cliente não afeta o carrinho de outro', async ({
    api,
    adminComProdutos,
    clienteLogado,
    outroClienteLogado,
  }) => {
    // O DELETE do carrinho não recebe ID: o carrinho excluído é o do dono do
    // token. Se essa ligação falhar, um cliente apaga o carrinho de outro.
    const [produto] = adminComProdutos.produtos;
    let idCarrinhoDoOutro: string;

    await test.step('Os dois clientes criam seus carrinhos', async () => {
      const meu = await api.carrinhos.cadastrar(
        [{ idProduto: produto._id, quantidade: 1 }],
        clienteLogado.token,
      );
      expect(meu.status()).toBe(201);

      const doOutro = await api.carrinhos.cadastrar(
        [{ idProduto: produto._id, quantidade: 2 }],
        outroClienteLogado.token,
      );
      expect(doOutro.status()).toBe(201);
      idCarrinhoDoOutro = (await doOutro.json())._id;
    });

    await test.step('O primeiro cliente conclui a compra', async () => {
      const resposta = await api.carrinhos.concluirCompra(clienteLogado.token);
      expect(await resposta.json()).toEqual({ message: MENSAGENS.registroExcluido });
    });

    await test.step('O carrinho do outro cliente continua intacto', async () => {
      const resposta = await api.carrinhos.buscarPorId(idCarrinhoDoOutro);
      expect(resposta.status()).toBe(200);
      expect(await resposta.json()).toEqual({
        _id: idCarrinhoDoOutro,
        idUsuario: outroClienteLogado.idUsuario,
        produtos: [{ idProduto: produto._id, quantidade: 2, precoUnitario: produto.preco }],
        quantidadeTotal: 2,
        precoTotal: produto.preco * 2,
      });

      // E a reserva dele continua valendo: 1 unidade vendida + 2 reservadas.
      await conferirEstoque(api, produto, produto.quantidade - 3);
    });
  });

  test('o estoque reservado por um cliente só volta para venda quando ele cancela', async ({
    api,
    adminComProdutos,
    clienteLogado,
    outroClienteLogado,
  }) => {
    // Versão sequencial (e por isso confiável) da disputa pela última unidade.
    const [produto] = adminComProdutos.produtos;
    const umaUnidade = [{ idProduto: produto._id, quantidade: 1 }];

    // Este passo também cobre o valor limite: `estoque + 1` é recusado (em
    // regras-do-carrinho), e exatamente `estoque` tem que ser aceito. Erros de
    // ">" no lugar de ">=" aparecem justamente aqui.
    await test.step('O primeiro cliente reserva exatamente todo o estoque', async () => {
      const resposta = await api.carrinhos.cadastrar(
        [{ idProduto: produto._id, quantidade: produto.quantidade }],
        clienteLogado.token,
      );
      expect(resposta.status()).toBe(201);
      await conferirEstoque(api, produto, 0);
    });

    await test.step('O outro cliente não consegue comprar nenhuma unidade', async () => {
      const resposta = await api.carrinhos.cadastrar(umaUnidade, outroClienteLogado.token);
      expect(resposta.status()).toBe(400);
      expect(await resposta.json()).toMatchObject({ message: MENSAGENS.estoqueInsuficiente });
    });

    await test.step('O primeiro cliente cancela e o estoque volta', async () => {
      const resposta = await api.carrinhos.cancelarCompra(clienteLogado.token);
      expect(await resposta.json()).toEqual({ message: MENSAGENS.compraCancelada });
      await conferirEstoque(api, produto, produto.quantidade);
    });

    await test.step('Agora o outro cliente consegue comprar', async () => {
      const resposta = await api.carrinhos.cadastrar(umaUnidade, outroClienteLogado.token);
      expect(resposta.status()).toBe(201);
    });
  });
});

test.describe('Integridade dos dados vinculados ao carrinho', { tag: '@regressao' }, () => {
  test('não deve excluir produto que faz parte de um carrinho', async ({
    api,
    adminComProdutos,
    clienteLogado,
  }) => {
    // Se fosse permitido, o carrinho apontaria para um produto inexistente.
    const [produto] = adminComProdutos.produtos;
    const carrinho = await api.carrinhos.cadastrar(
      [{ idProduto: produto._id, quantidade: 1 }],
      clienteLogado.token,
    );
    const { _id: idCarrinho } = await carrinho.json();

    const resposta = await api.produtos.excluir(produto._id, adminComProdutos.token);

    expect(resposta.status()).toBe(400);
    // A API informa quais carrinhos impedem a exclusão.
    expect(await resposta.json()).toEqual({
      message: MENSAGENS.produtoEmCarrinho,
      idCarrinhos: [idCarrinho],
    });
    const consulta = await api.produtos.buscarPorId(produto._id);
    expect(consulta.status()).toBe(200);
  });

  test('não deve excluir usuário que tem carrinho', async ({
    api,
    adminComProdutos,
    clienteLogado,
  }) => {
    // Se fosse permitido, o carrinho ficaria sem dono e o estoque, preso.
    const [produto] = adminComProdutos.produtos;
    const carrinho = await api.carrinhos.cadastrar(
      [{ idProduto: produto._id, quantidade: 1 }],
      clienteLogado.token,
    );
    const { _id: idCarrinho } = await carrinho.json();

    const resposta = await api.usuarios.excluir(clienteLogado.idUsuario);

    expect(resposta.status()).toBe(400);
    expect(await resposta.json()).toEqual({
      message: MENSAGENS.usuarioComCarrinho,
      idCarrinho,
    });
    const consulta = await api.usuarios.buscarPorId(clienteLogado.idUsuario);
    expect(consulta.status()).toBe(200);
  });

  test('o carrinho mantém o preço do momento da compra quando o produto muda de preço', async ({
    api,
    adminComProdutos,
    clienteLogado,
  }) => {
    // Regra de negócio confirmada na API: o preço fica "congelado" no carrinho.
    // Se isso mudar, o cliente pode pagar um valor diferente do que viu.
    const [produto] = adminComProdutos.produtos;
    let idCarrinho: string;

    await test.step('Cliente coloca 2 unidades no carrinho', async () => {
      const resposta = await api.carrinhos.cadastrar(
        [{ idProduto: produto._id, quantidade: 2 }],
        clienteLogado.token,
      );
      expect(resposta.status()).toBe(201);
      idCarrinho = (await resposta.json())._id;
    });

    await test.step('Administrador aumenta o preço do produto', async () => {
      // O PUT substitui o produto inteiro: mantemos nome, descrição e o estoque
      // atual (já sem as 2 unidades reservadas), mudando só o preço.
      const produtoComNovoPreco = {
        nome: produto.nome,
        descricao: produto.descricao,
        preco: produto.preco + 500,
        quantidade: produto.quantidade - 2,
      };
      const resposta = await api.produtos.editar(
        produto._id,
        produtoComNovoPreco,
        adminComProdutos.token,
      );
      expect(resposta.status()).toBe(200);
      expect(await resposta.json()).toEqual({ message: MENSAGENS.registroAlterado });
    });

    await test.step('O carrinho continua com o preço original', async () => {
      const resposta = await api.carrinhos.buscarPorId(idCarrinho);
      expect(await resposta.json()).toMatchObject({
        produtos: [{ idProduto: produto._id, quantidade: 2, precoUnitario: produto.preco }],
        precoTotal: produto.preco * 2,
      });
    });
  });
});
