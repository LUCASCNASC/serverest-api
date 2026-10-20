// Mensagens retornadas pela ServeRest, centralizadas para não espalhar textos
// pelos testes. Se a API mudar uma mensagem, o ajuste é feito em um só lugar.

export const MENSAGENS = {
  cadastroComSucesso: 'Cadastro realizado com sucesso',
  loginComSucesso: 'Login realizado com sucesso',
  registroExcluido: 'Registro excluído com sucesso',
  // O Swagger documenta só "Registro excluído com sucesso" para o cancelamento,
  // mas a API real devolve o texto completo abaixo.
  compraCancelada: 'Registro excluído com sucesso. Estoque dos produtos reabastecido',
  carrinhoNaoEncontrado: 'Carrinho não encontrado',
  usuarioSemCarrinho: 'Não foi encontrado carrinho para esse usuário',
  maisDeUmCarrinho: 'Não é permitido ter mais de 1 carrinho',
  produtoDuplicado: 'Não é permitido possuir produto duplicado',
  produtoNaoEncontrado: 'Produto não encontrado',
  registroAlterado: 'Registro alterado com sucesso',
  produtoEmCarrinho: 'Não é permitido excluir produto que faz parte de carrinho',
  usuarioComCarrinho: 'Não é permitido excluir usuário com carrinho cadastrado',
  // Erro de validação de campo: a chave da resposta é o caminho do campo.
  quantidadeNaoPositiva: 'produtos[0].quantidade deve ser um número positivo',
  nomeDeProdutoRepetido: 'Já existe produto com esse nome',
  estoqueInsuficiente: 'Produto não possui quantidade suficiente',
  emailJaUtilizado: 'Este email já está sendo usado',
  loginInvalido: 'Email e/ou senha inválidos',
  rotaDeAdministrador: 'Rota exclusiva para administradores',
  tokenInvalido: 'Token de acesso ausente, inválido, expirado ou usuário do token não existe mais',
} as const;
