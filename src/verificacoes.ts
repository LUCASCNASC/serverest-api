import { expect } from '@playwright/test';
import type { ServeRest } from './api/serverest';
import type { ConteudoDoToken, ProdutoCadastrado } from './tipos';

/** Busca o produto na API e confere a quantidade em estoque. */
export async function conferirEstoque(
  api: ServeRest,
  produto: ProdutoCadastrado,
  quantidadeEsperada: number,
) {
  const resposta = await api.produtos.buscarPorId(produto._id);
  expect(resposta.status()).toBe(200);

  const { quantidade } = await resposta.json();
  expect(quantidade, `estoque de "${produto.nome}"`).toBe(quantidadeEsperada);
}

/** Decodifica a parte central (payload) de um token "Bearer <jwt>". */
export function lerConteudoDoJwt(authorization: string): ConteudoDoToken {
  const payload = authorization.replace('Bearer ', '').split('.')[1];
  return JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8')) as ConteudoDoToken;
}
