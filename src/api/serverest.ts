import type { APIRequestContext, APIResponse } from '@playwright/test';
import type {
  Carrinho,
  ItemDoCarrinho,
  ListaDeCarrinhos,
  ListaDeProdutos,
  ListaDeUsuarios,
  Produto,
  ProdutoCadastrado,
  RespostaComMensagem,
  RespostaDeCadastro,
  RespostaDeLogin,
  Usuario,
  UsuarioCadastrado,
} from '../tipos';

// Uma classe por recurso da API. Elas só fazem as requisições e devolvem a
// resposta crua: quem decide o que é certo ou errado (as asserções) é o teste.
// O token sempre entra como parâmetro, para que fique visível no teste de onde
// ele vem e para onde vai.

/**
 * O corpo bruto pode representar sucesso ou erro. Para acessar o tipo esperado
 * de sucesso, use `jsonSucesso()`, que rejeita respostas HTTP não bem-sucedidas.
 * Os tipos descrevem o contrato esperado, sem validar o formato em runtime.
 */
export type Resposta<CorpoDeSucesso> = Omit<APIResponse, 'json'> & {
  json(): Promise<unknown>;
  jsonSucesso(): Promise<CorpoDeSucesso>;
};

async function tipada<CorpoDeSucesso>(
  promessa: Promise<APIResponse>,
): Promise<Resposta<CorpoDeSucesso>> {
  const resposta = await promessa;
  return Object.assign(resposta, {
    async jsonSucesso(): Promise<CorpoDeSucesso> {
      if (!resposta.ok()) {
        throw new Error(`Esperada resposta de sucesso, recebida HTTP ${resposta.status()}`);
      }
      return (await resposta.json()) as CorpoDeSucesso;
    },
  });
}

function cabecalhoDeAutorizacao(token?: string): Record<string, string> {
  return token ? { Authorization: token } : {};
}

class UsuariosApi {
  constructor(private readonly request: APIRequestContext) {}

  listar() {
    return tipada<ListaDeUsuarios>(this.request.get('/usuarios'));
  }

  cadastrar(usuario: Usuario) {
    return tipada<RespostaDeCadastro>(this.request.post('/usuarios', { data: usuario }));
  }

  buscarPorId(idUsuario: string) {
    return tipada<UsuarioCadastrado>(this.request.get(`/usuarios/${idUsuario}`));
  }

  editar(idUsuario: string, usuario: Usuario) {
    return tipada<RespostaComMensagem>(
      this.request.put(`/usuarios/${idUsuario}`, { data: usuario }),
    );
  }

  excluir(idUsuario: string) {
    return tipada<RespostaComMensagem>(this.request.delete(`/usuarios/${idUsuario}`));
  }
}

class LoginApi {
  constructor(private readonly request: APIRequestContext) {}

  entrar(email: string, password: string) {
    return tipada<RespostaDeLogin>(this.request.post('/login', { data: { email, password } }));
  }
}

class ProdutosApi {
  constructor(private readonly request: APIRequestContext) {}

  listar() {
    return tipada<ListaDeProdutos>(this.request.get('/produtos'));
  }

  cadastrar(produto: Produto, token: string) {
    return tipada<RespostaDeCadastro>(
      this.request.post('/produtos', {
        data: produto,
        headers: cabecalhoDeAutorizacao(token),
      }),
    );
  }

  buscarPorId(idProduto: string) {
    return tipada<ProdutoCadastrado>(this.request.get(`/produtos/${idProduto}`));
  }

  editar(idProduto: string, produto: Produto, token: string) {
    return tipada<RespostaComMensagem>(
      this.request.put(`/produtos/${idProduto}`, {
        data: produto,
        headers: cabecalhoDeAutorizacao(token),
      }),
    );
  }

  excluir(idProduto: string, token: string) {
    return tipada<RespostaComMensagem>(
      this.request.delete(`/produtos/${idProduto}`, {
        headers: cabecalhoDeAutorizacao(token),
      }),
    );
  }
}

class CarrinhosApi {
  constructor(private readonly request: APIRequestContext) {}

  /** O token é opcional apenas para permitir testar a chamada sem autenticação. */
  cadastrar(produtos: ItemDoCarrinho[], token?: string) {
    return tipada<RespostaDeCadastro>(
      this.request.post('/carrinhos', {
        data: { produtos },
        headers: cabecalhoDeAutorizacao(token),
      }),
    );
  }

  buscarPorId(idCarrinho: string) {
    return tipada<Carrinho>(this.request.get(`/carrinhos/${idCarrinho}`));
  }

  listarDoUsuario(idUsuario: string) {
    return tipada<ListaDeCarrinhos>(this.request.get('/carrinhos', { params: { idUsuario } }));
  }

  /** Exclui o carrinho do usuário do token. O estoque continua baixado. */
  concluirCompra(token: string) {
    return tipada<RespostaComMensagem>(
      this.request.delete('/carrinhos/concluir-compra', {
        headers: cabecalhoDeAutorizacao(token),
      }),
    );
  }

  /** Exclui o carrinho do usuário do token e devolve os produtos ao estoque. */
  cancelarCompra(token: string) {
    return tipada<RespostaComMensagem>(
      this.request.delete('/carrinhos/cancelar-compra', {
        headers: cabecalhoDeAutorizacao(token),
      }),
    );
  }
}

export class ServeRest {
  readonly usuarios: UsuariosApi;
  readonly login: LoginApi;
  readonly produtos: ProdutosApi;
  readonly carrinhos: CarrinhosApi;

  constructor(request: APIRequestContext) {
    this.usuarios = new UsuariosApi(request);
    this.login = new LoginApi(request);
    this.produtos = new ProdutosApi(request);
    this.carrinhos = new CarrinhosApi(request);
  }
}
