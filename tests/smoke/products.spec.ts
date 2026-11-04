import { test, expect } from '../../src/fixtures';
import { novoProduto } from '../../src/dados/fabrica';
import { MENSAGENS } from '../../src/dados/mensagens';

test.describe('Smoke: produtos', { tag: ['@smoke', '@regression'] }, () => {
  test('lista, cadastra, consulta, atualiza e exclui um produto', async ({
    api,
    massa,
    adminLogado,
  }) => {
    const lista = await api.produtos.listar();
    expect(lista.status()).toBe(200);
    expect(await lista.json()).toEqual({
      quantidade: expect.any(Number),
      produtos: expect.any(Array),
    });

    const produto = novoProduto();
    const cadastro = await api.produtos.cadastrar(produto, adminLogado.token);
    expect(cadastro.status()).toBe(201);
    const produtoCriado = await cadastro.json();
    expect(produtoCriado).toEqual({
      message: MENSAGENS.cadastroComSucesso,
      _id: expect.any(String),
    });
    massa.guardarProduto(produtoCriado._id, adminLogado.token);

    const consulta = await api.produtos.buscarPorId(produtoCriado._id);
    expect(consulta.status()).toBe(200);
    expect(await consulta.json()).toEqual({ ...produto, _id: produtoCriado._id });

    const produtoAtualizado = { ...produto, preco: produto.preco + 1 };
    const atualizacao = await api.produtos.editar(
      produtoCriado._id,
      produtoAtualizado,
      adminLogado.token,
    );
    expect(atualizacao.status()).toBe(200);
    expect(await atualizacao.json()).toEqual({ message: MENSAGENS.registroAlterado });

    const consultaAtualizada = await api.produtos.buscarPorId(produtoCriado._id);
    expect(consultaAtualizada.status()).toBe(200);
    expect(await consultaAtualizada.json()).toEqual({
      ...produtoAtualizado,
      _id: produtoCriado._id,
    });

    const exclusao = await api.produtos.excluir(produtoCriado._id, adminLogado.token);
    expect(exclusao.status()).toBe(200);
    expect(await exclusao.json()).toEqual({ message: MENSAGENS.registroExcluido });

    const consultaExcluida = await api.produtos.buscarPorId(produtoCriado._id);
    expect(consultaExcluida.status()).toBe(400);
    expect(await consultaExcluida.json()).toEqual({
      message: MENSAGENS.produtoNaoEncontrado,
    });
  });
});
