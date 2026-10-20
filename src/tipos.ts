// Formatos dos dados que enviamos e recebemos da ServeRest.

export interface Usuario {
  nome: string;
  email: string;
  password: string;
  // A API espera o booleano como texto.
  administrador: 'true' | 'false';
}

export interface Produto {
  nome: string;
  preco: number;
  descricao: string;
  quantidade: number;
}

/** Produto já cadastrado na API, com o `_id` gerado por ela. */
export interface ProdutoCadastrado extends Produto {
  _id: string;
}

/** Item enviado no corpo do POST /carrinhos. */
export interface ItemDoCarrinho {
  idProduto: string;
  quantidade: number;
}

/** Item retornado pelo GET /carrinhos: a API acrescenta o preço unitário. */
export interface ItemDoCarrinhoRetornado extends ItemDoCarrinho {
  precoUnitario: number;
}

export interface Carrinho {
  _id: string;
  idUsuario: string;
  produtos: ItemDoCarrinhoRetornado[];
  precoTotal: number;
  quantidadeTotal: number;
}

// ---------------------------------------------------------------------------
// Corpos de resposta da API
// ---------------------------------------------------------------------------

/** Resposta só com mensagem: exclusões e erros (400, 401, 403). */
export interface RespostaComMensagem {
  message: string;
}

/** POST de usuário, produto ou carrinho com sucesso. */
export interface RespostaDeCadastro extends RespostaComMensagem {
  _id: string;
}

export interface RespostaDeLogin extends RespostaComMensagem {
  /** Token no formato "Bearer <jwt>", pronto para o header Authorization. */
  authorization: string;
}

export interface UsuarioCadastrado extends Usuario {
  _id: string;
}

export interface ListaDeCarrinhos {
  quantidade: number;
  carrinhos: Carrinho[];
}

/** Conteúdo do JWT devolvido no login. */
export interface ConteudoDoToken {
  email: string;
  password: string;
  /** Emitido em (segundos desde 1970). */
  iat: number;
  /** Expira em (segundos desde 1970). */
  exp: number;
}
