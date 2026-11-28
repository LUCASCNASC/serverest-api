import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { test, expect, request, type APIRequestContext } from '@playwright/test';
import { ServeRest } from '../src/api/serverest';
import { MassaDeTeste, reportarFalhasDeLimpeza } from '../src/fixtures';

let server: Server;
let context: APIRequestContext;
let chamadas: string[];
let responder: (caminho: string, tentativa: number) => number;

test.beforeEach(async () => {
  chamadas = [];
  responder = () => 200;
  server = createServer((req, res) => {
    const caminho = req.url ?? '';
    chamadas.push(caminho);
    const tentativa = chamadas.filter((item) => item === caminho).length;
    res.writeHead(responder(caminho, tentativa), { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ message: 'resultado' }));
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const { port } = server.address() as AddressInfo;
  context = await request.newContext({ baseURL: `http://127.0.0.1:${port}` });
});

test.afterEach(async () => {
  await context.dispose();
  await new Promise<void>((resolve, reject) =>
    server.close((erro) => (erro ? reject(erro) : resolve())),
  );
});

test('repete erros transitórios e mantém a ordem da limpeza', async () => {
  responder = (caminho, tentativa) =>
    caminho === '/carrinhos/cancelar-compra' && tentativa === 1 ? 429 : 200;
  const massa = new MassaDeTeste();
  massa.guardarToken('usuario', 'Bearer token');
  massa.guardarProduto('produto', 'Bearer token');
  massa.guardarUsuario('usuario');

  expect(await massa.limpar(new ServeRest(context))).toEqual([]);
  expect(chamadas).toEqual([
    '/carrinhos/cancelar-compra',
    '/carrinhos/cancelar-compra',
    '/produtos/produto',
    '/usuarios/usuario',
  ]);
});

test('registra falhas persistentes, não repete 4xx e anexa o diagnóstico', async () => {
  const testInfo = test.info();
  responder = (caminho) => (caminho.startsWith('/produtos/') ? 503 : 400);
  const massa = new MassaDeTeste();
  massa.guardarProduto('produto', 'Bearer token');
  massa.guardarUsuario('usuario');

  const falhas = await massa.limpar(new ServeRest(context));
  expect(falhas).toEqual([
    'Excluir produto produto: HTTP 503',
    'Excluir usuário usuario: HTTP 400',
  ]);
  expect(chamadas).toEqual([
    '/produtos/produto',
    '/produtos/produto',
    '/produtos/produto',
    '/usuarios/usuario',
  ]);
  await reportarFalhasDeLimpeza(falhas, testInfo);
  expect(testInfo.annotations).toContainEqual({
    type: 'falha de limpeza',
    description: falhas.join('\n'),
  });
  expect(testInfo.attachments.some((item) => item.name === 'falhas-limpeza-dados-de-teste')).toBe(
    true,
  );
});

test('expõe corpo de erro sem tratá-lo como sucesso tipado', async () => {
  responder = () => 400;
  const resposta = await new ServeRest(context).usuarios.listar();
  expect(await resposta.json()).toEqual({ message: 'resultado' });
  await expect(resposta.jsonSucesso()).rejects.toThrow('HTTP 400');
});
