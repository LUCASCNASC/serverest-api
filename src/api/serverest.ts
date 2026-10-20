import type { APIRequestContext, APIResponse } from '@playwright/test';
import type {
  Carrinho,
  ItemDoCarrinho,
  ListaDeCarrinhos,
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
 * A mesma APIResponse do Playwright, mas com o `json()` já tipado com o corpo
 * de SUCESSO da rota. Assim o editor sugere os campos (`_id`, `authorization`...)
 * e o TypeScript acusa nome de campo errado antes de rodar.
 *
 * Nas respostas de erro a API devolve só `{ message }`; nesses casos o teste
 * compara o corpo inteiro com `toEqual`, que funciona com qualquer tipo.
 */
export type Resposta<CorpoDeSucesso> = Omit<APIResponse, 'json'> & {
  json(): Promise<CorpoDeSucesso>;
};

function tipada<CorpoDeSucesso>(resposta: Promise<APIResponse>) {
  return resposta as Promise<Resposta<CorpoDeSucesso>>;
}

function cabecalhoDeAutorizacao(token?: string): Record<string, string> {
  return token ? { Authorization: token } : {};
}

class UsuariosApi {
  constructor(private readonly request: APIRequestContext) {}

  cadastrar(usuario: Usuario) {
    return tipada<RespostaDeCadastro>(this.request.post('/usuarios', { data: usuario }));
  }

  buscarPorId(idUsuario: string) {
    return tipada<UsuarioCadastrado>(this.request.get(`/usuarios/${idUsuario}`));
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
