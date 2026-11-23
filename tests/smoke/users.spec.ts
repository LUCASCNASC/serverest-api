import { test, expect } from '../../src/fixtures';
import { novoUsuarioComum } from '../../src/dados/fabrica';
import { MENSAGENS } from '../../src/dados/mensagens';

test.describe('Smoke: usuários', { tag: ['@smoke', '@regression'] }, () => {
  test('lista, cadastra, consulta, atualiza e exclui um usuário', async ({ api, massa }) => {
    const lista = await api.usuarios.listar();
    expect(lista.status()).toBe(200);
    const usuarios = await lista.json();
    expect(usuarios).toEqual({
      quantidade: expect.any(Number),
      usuarios: expect.any(Array),
    });

    const usuario = novoUsuarioComum();
    const cadastro = await api.usuarios.cadastrar(usuario);
    expect(cadastro.status()).toBe(201);
    const usuarioCriado = await cadastro.json();
    expect(usuarioCriado).toEqual({
      message: MENSAGENS.cadastroComSucesso,
      _id: expect.any(String),
    });
    massa.guardarUsuario(usuarioCriado._id);

    const consulta = await api.usuarios.buscarPorId(usuarioCriado._id);
    expect(consulta.status()).toBe(200);
    expect(await consulta.json()).toEqual({ ...usuario, _id: usuarioCriado._id });

    const usuarioAtualizado = { ...usuario, nome: `${usuario.nome} atualizado` };
    const atualizacao = await api.usuarios.editar(usuarioCriado._id, usuarioAtualizado);
    expect(atualizacao.status()).toBe(200);
    expect(await atualizacao.json()).toEqual({ message: MENSAGENS.registroAlterado });

    const consultaAtualizada = await api.usuarios.buscarPorId(usuarioCriado._id);
    expect(consultaAtualizada.status()).toBe(200);
    expect(await consultaAtualizada.json()).toEqual({
      ...usuarioAtualizado,
      _id: usuarioCriado._id,
    });

    const exclusao = await api.usuarios.excluir(usuarioCriado._id);
    expect(exclusao.status()).toBe(200);
    expect(await exclusao.json()).toEqual({ message: MENSAGENS.registroExcluido });

    const consultaExcluida = await api.usuarios.buscarPorId(usuarioCriado._id);
    expect(consultaExcluida.status()).toBe(400);
    expect(await consultaExcluida.json()).toEqual({
      message: MENSAGENS.usuarioNaoEncontrado,
    });
  });
});
