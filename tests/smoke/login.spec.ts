import { test, expect } from '../../src/fixtures';
import { MENSAGENS } from '../../src/dados/mensagens';
import { lerConteudoDoJwt } from '../../src/verificacoes';

test.describe('Smoke: login', { tag: ['@smoke', '@regressao'] }, () => {
  test('POST /login autentica um usuário cadastrado', async ({ api, clienteLogado }) => {
    const resposta = await api.login.entrar(
      clienteLogado.dados.email,
      clienteLogado.dados.password,
    );

    expect(resposta.status()).toBe(200);
    const corpo = await resposta.json();
    expect(corpo).toEqual({
      message: MENSAGENS.loginComSucesso,
      authorization: expect.stringMatching(/^Bearer \S+\.\S+\.\S+$/),
    });
    expect(lerConteudoDoJwt(corpo.authorization).email).toBe(clienteLogado.dados.email);
  });
});
