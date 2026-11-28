import { test as base, expect, type TestInfo } from '@playwright/test';
import { ServeRest } from './api/serverest';
import { novoProduto, novoUsuarioAdministrador, novoUsuarioComum } from './dados/fabrica';
import type { ProdutoCadastrado, Usuario } from './tipos';

/**
 * Anota tudo o que o teste criou para apagar no final.
 *
 * Os dados são removidos ao final para evitar resíduos no ambiente e
 * manter cada execução independente da anterior.
 */
export class MassaDeTeste {
  private idsUsuarios: string[] = [];
  private tokensPorUsuario = new Map<string, string>();
  // Cada produto guarda o token do admin que o criou: só ele pode excluí-lo.
  private produtos: { idProduto: string; tokenAdmin: string }[] = [];

  guardarUsuario(idUsuario: string) {
    this.idsUsuarios.push(idUsuario);
  }

  guardarToken(idUsuario: string, token: string) {
    this.tokensPorUsuario.set(idUsuario, token);
  }

  guardarProduto(idProduto: string, tokenAdmin: string) {
    this.produtos.push({ idProduto, tokenAdmin });
  }

  async limpar(api: ServeRest): Promise<string[]> {
    const falhas: string[] = [];

    const executarLimpeza = async (
      descricao: string,
      operacao: () => Promise<{ status(): number }>,
    ) => {
      let ultimoErro = '';

      for (let tentativa = 1; tentativa <= 3; tentativa++) {
        try {
          const resposta = await operacao();
          const status = resposta.status();
          if (status === 200) return;

          ultimoErro = `HTTP ${status}`;
          if (status !== 429 && status < 500) break;
        } catch (erro) {
          ultimoErro = erro instanceof Error ? erro.message : String(erro);
        }

        if (tentativa < 3) {
          await new Promise((resolve) => setTimeout(resolve, 250 * tentativa));
        }
      }

      falhas.push(`${descricao}: ${ultimoErro}`);
    };

    // A ordem importa: a API não deixa excluir produto que está em carrinho,
    // nem usuário que tem carrinho. Então primeiro os carrinhos saem (cancelando,
    // para o estoque voltar), depois os produtos e por último os usuários.
    for (const token of this.tokensPorUsuario.values()) {
      await executarLimpeza('Cancelar carrinho do token de teste', () =>
        api.carrinhos.cancelarCompra(token),
      );
    }
    for (const { idProduto, tokenAdmin } of this.produtos) {
      await executarLimpeza(`Excluir produto ${idProduto}`, () =>
        api.produtos.excluir(idProduto, tokenAdmin),
      );
    }
    for (const idUsuario of this.idsUsuarios) {
      await executarLimpeza(`Excluir usuário ${idUsuario}`, () => api.usuarios.excluir(idUsuario));
    }

    return falhas;
  }
}

export async function reportarFalhasDeLimpeza(falhas: string[], testInfo: TestInfo) {
  if (falhas.length === 0) return;

  const detalhes = falhas.join('\n');
  console.warn(`Falha ao limpar dados de teste:\n${detalhes}`);
  testInfo.annotations.push({ type: 'falha de limpeza', description: detalhes });
  await testInfo.attach('falhas-limpeza-dados-de-teste', {
    body: detalhes,
    contentType: 'text/plain',
  });
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
  const { _id: idUsuario } = await cadastro.jsonSucesso();
  massa.guardarUsuario(idUsuario);

  const login = await api.login.entrar(usuario.email, usuario.password);
  expect(login.status(), 'pré-condição: fazer login').toBe(200);
  const { authorization: token } = await login.jsonSucesso();
  massa.guardarToken(idUsuario, token);

  return { dados: usuario, idUsuario, token };
}

export const test = base.extend<Fixtures>({
  api: async ({ request }, use) => {
    await use(new ServeRest(request));
  },

  massa: async ({ api }, use, testInfo) => {
    const massa = new MassaDeTeste();
    await use(massa);
    await reportarFalhasDeLimpeza(await massa.limpar(api), testInfo);
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
      const { _id } = await resposta.jsonSucesso();
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
