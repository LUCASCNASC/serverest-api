import { test as base, expect } from '@playwright/test';
import { ServeRest } from './api/serverest';
import { novoProduto, novoUsuarioAdministrador, novoUsuarioComum } from './dados/fabrica';
import type { ProdutoCadastrado, Usuario } from './tipos';

/**
 * Anota tudo o que o teste criou para apagar no final.
 *
 * A base é zerada toda noite, mas durante o dia o ambiente é compartilhado:
 * limpar o que criamos evita deixar lixo para outras pessoas e mantém
 * cada execução independente da anterior.
 */
export class MassaDeTeste {
  private idsUsuarios: string[] = [];
  private tokens: string[] = [];
  // Cada produto guarda o token do admin que o criou: só ele pode excluí-lo.
  private produtos: { idProduto: string; tokenAdmin: string }[] = [];

  guardarUsuario(idUsuario: string) {
    this.idsUsuarios.push(idUsuario);
  }

  guardarToken(token: string) {
    this.tokens.push(token);
  }

  guardarProduto(idProduto: string, tokenAdmin: string) {
    this.produtos.push({ idProduto, tokenAdmin });
  }

  async limpar(api: ServeRest) {
    // A ordem importa: a API não deixa excluir produto que está em carrinho,
    // nem usuário que tem carrinho. Então primeiro os carrinhos saem (cancelando,
    // para o estoque voltar), depois os produtos e por último os usuários.
    // As respostas não são verificadas de propósito: limpeza não é o objeto do
    // teste e, se algo sobrar, a base é apagada à noite de qualquer forma.
    for (const token of this.tokens) {
      await api.carrinhos.cancelarCompra(token);
    }
    for (const { idProduto, tokenAdmin } of this.produtos) {
      await api.produtos.excluir(idProduto, tokenAdmin);
    }
    for (const idUsuario of this.idsUsuarios) {
      await api.usuarios.excluir(idUsuario);
    }
  }
}

/** Usuário já cadastrado e logado. */
export interface UsuarioLogado {
  dados: Usuario;
  idUsuario: string;
  token: string;
}

/** Administrador logado que já cadastrou produtos (10 unidades cada). */
export interface AdminComProdutos extends UsuarioLogado {
  produtos: ProdutoCadastrado[];
}

type Fixtures = {
  api: ServeRest;
  massa: MassaDeTeste;
  adminLogado: UsuarioLogado;
  adminComProdutos: AdminComProdutos;
  clienteLogado: UsuarioLogado;
  /** Um segundo cliente, para cenários com mais de um comprador. */
  outroClienteLogado: UsuarioLogado;
};

/** Pré-condição: cadastra e loga o usuário, já anotando tudo para a limpeza. */
async function cadastrarELogar(api: ServeRest, massa: MassaDeTeste, usuario: Usuario) {
  const cadastro = await api.usuarios.cadastrar(usuario);
  expect(cadastro.status(), 'pré-condição: cadastrar usuário').toBe(201);
  const { _id: idUsuario } = await cadastro.json();
  massa.guardarUsuario(idUsuario);

  const login = await api.login.entrar(usuario.email, usuario.password);
  expect(login.status(), 'pré-condição: fazer login').toBe(200);
  const { authorization: token } = await login.json();
  massa.guardarToken(token);

  return { dados: usuario, idUsuario, token };
}

export const test = base.extend<Fixtures>({
  api: async ({ request }, use) => {
    await use(new ServeRest(request));
  },

  massa: async ({ api }, use) => {
    const massa = new MassaDeTeste();
    await use(massa);
    await massa.limpar(api);
  },

  // As fixtures abaixo são pré-condições: cadastro, login e produto aqui são só
  // o caminho para chegar ao que o teste quer validar. Quem valida esses passos
  // em detalhe são o fluxo de compra e a suíte de usuários.

  adminLogado: async ({ api, massa }, use) => {
    await use(await cadastrarELogar(api, massa, novoUsuarioAdministrador()));
  },

  adminComProdutos: async ({ api, massa, adminLogado }, use) => {
    const produtos: ProdutoCadastrado[] = [];
    for (const produto of [novoProduto(), novoProduto()]) {
      const resposta = await api.produtos.cadastrar(produto, adminLogado.token);
      expect(resposta.status(), 'pré-condição: cadastrar produto').toBe(201);
      const { _id } = await resposta.json();
      massa.guardarProduto(_id, adminLogado.token);
      produtos.push({ ...produto, _id });
    }

    await use({ ...adminLogado, produtos });
  },

  clienteLogado: async ({ api, massa }, use) => {
    await use(await cadastrarELogar(api, massa, novoUsuarioComum()));
  },

  outroClienteLogado: async ({ api, massa }, use) => {
    await use(await cadastrarELogar(api, massa, novoUsuarioComum()));
  },
});

export { expect };
