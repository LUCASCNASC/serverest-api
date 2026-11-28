import { test, expect } from '../src/fixtures';
import { novoUsuarioAdministrador, novoUsuarioComum } from '../src/dados/fabrica';
import { MENSAGENS } from '../src/dados/mensagens';
import { lerConteudoDoJwt } from '../src/verificacoes';
import type { Usuario } from '../src/tipos';

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
  test.describe(`Usuário ${perfil.nome}: cadastro e login`, { tag: '@regression' }, () => {
    test('deve cadastrar o usuário e persistir os dados enviados', async ({ api, massa }) => {
      const usuario = perfil.novoUsuario();
      let idUsuario: string;

      await test.step(`Cadastrar o usuário com administrador = "${usuario.administrador}"`, async () => {
        const resposta = await api.usuarios.cadastrar(usuario);
        expect(resposta.status()).toBe(201);

        const corpo = await resposta.jsonSucesso();
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
        expect(await resposta.json()).toEqual({ ...usuario, _id: idUsuario });
      });
    });

    test('deve fazer login e receber um token do próprio usuário', async ({ api, massa }) => {
      const usuario = perfil.novoUsuario();
      let idUsuario: string;

      await test.step('Pré-condição: cadastrar o usuário', async () => {
        const resposta = await api.usuarios.cadastrar(usuario);
        expect(resposta.status()).toBe(201);
        ({ _id: idUsuario } = await resposta.jsonSucesso());
        massa.guardarUsuario(idUsuario);
      });

      await test.step('Fazer login com e-mail e senha cadastrados', async () => {
        const resposta = await api.login.entrar(usuario.email, usuario.password);
        expect(resposta.status()).toBe(200);

        const corpo = await resposta.jsonSucesso();
        expect(corpo).toEqual({
          message: MENSAGENS.loginComSucesso,
          authorization: expect.stringMatching(/^Bearer \S+$/),
        });
        massa.guardarToken(idUsuario, corpo.authorization);

        // O token é um JWT. Abrindo o conteúdo dele, conferimos que foi
        // emitido para o usuário que fez login, e não para qualquer outro.
        expect(lerConteudoDoJwt(corpo.authorization).email).toBe(usuario.email);
      });
    });
  });
}

test.describe('Regras de cadastro e login', { tag: '@regression' }, () => {
  test('não deve cadastrar usuário com e-mail inválido', async ({ api, massa }) => {
    const usuario = { ...novoUsuarioComum(), email: 'email-invalido' };
    const resposta = await api.usuarios.cadastrar(usuario);
    if (resposta.status() === 201) massa.guardarUsuario((await resposta.jsonSucesso())._id);

    expect(resposta.status()).toBe(400);
    expect(await resposta.json()).toMatchObject({ email: expect.any(String) });
    const lista = await api.usuarios.listar();
    expect(lista.status()).toBe(200);
    expect((await lista.jsonSucesso()).usuarios.some((item) => item.email === usuario.email)).toBe(
      false,
    );
  });

  for (const campo of ['nome', 'email', 'password', 'administrador'] as const) {
    test(`não deve cadastrar usuário sem ${campo}`, async ({ request, api, massa }) => {
      const usuario = novoUsuarioComum();
      const invalido: Partial<Usuario> = { ...usuario };
      delete invalido[campo];
      const resposta = await request.post('/usuarios', { data: invalido });
      if (resposta.status() === 201) {
        const corpo: unknown = await resposta.json();
        if (typeof corpo !== 'object' || corpo === null || !('_id' in corpo)) {
          throw new Error('Cadastro inesperado sem ID para limpeza');
        }
        if (typeof corpo._id !== 'string') throw new Error('ID inválido para limpeza');
        massa.guardarUsuario(corpo._id);
      }

      expect(resposta.status()).toBe(400);
      expect(await resposta.json()).toMatchObject({ [campo]: expect.any(String) });
      const lista = await api.usuarios.listar();
      expect(lista.status()).toBe(200);
      expect(
        (await lista.jsonSucesso()).usuarios.some((item) => item.email === usuario.email),
      ).toBe(false);
    });
  }

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

  test('deve permitir login com o novo e-mail depois de editar os dados do usuário', async ({
    api,
    massa,
    clienteLogado,
  }) => {
    const usuarioAtualizado = {
      ...clienteLogado.dados,
      email: novoUsuarioComum().email,
    };
    const atualizacao = await api.usuarios.editar(clienteLogado.idUsuario, usuarioAtualizado);

    expect(atualizacao.status()).toBe(200);
    expect(await atualizacao.json()).toEqual({ message: MENSAGENS.registroAlterado });

    const loginComEmailAntigo = await api.login.entrar(
      clienteLogado.dados.email,
      clienteLogado.dados.password,
    );
    expect(loginComEmailAntigo.status()).toBe(401);
    expect(await loginComEmailAntigo.json()).toEqual({ message: MENSAGENS.loginInvalido });

    const loginComEmailNovo = await api.login.entrar(
      usuarioAtualizado.email,
      usuarioAtualizado.password,
    );
    expect(loginComEmailNovo.status()).toBe(200);
    const corpo = await loginComEmailNovo.jsonSucesso();
    massa.guardarToken(clienteLogado.idUsuario, corpo.authorization);
    expect(corpo.message).toBe(MENSAGENS.loginComSucesso);
    expect(lerConteudoDoJwt(corpo.authorization).email).toBe(usuarioAtualizado.email);
  });
});
