import { fakerPT_BR as faker } from '@faker-js/faker';
import type { Produto, Usuario } from '../tipos';

// A base da ServeRest é apagada toda noite, então nenhum teste pode contar
// com dados pré-existentes. Tudo é criado na hora, com valores únicos para
// não colidir com o que outras pessoas cadastram no mesmo ambiente durante o dia
// (e-mail de usuário e nome de produto não podem se repetir).

function sufixoUnico(): string {
  return `${Date.now()}${faker.string.alphanumeric(6)}`;
}

function novoUsuario(administrador: Usuario['administrador']): Usuario {
  return {
    nome: faker.person.fullName(),
    email: `qa.${sufixoUnico()}@teste.com.br`.toLowerCase(),
    password: faker.internet.password({ length: 12 }),
    administrador,
  };
}

/** Administrador: o único perfil que pode cadastrar produtos. */
export function novoUsuarioAdministrador(): Usuario {
  return novoUsuario('true');
}

/** Usuário comum (cliente): pode comprar, mas não pode cadastrar produtos. */
export function novoUsuarioComum(): Usuario {
  return novoUsuario('false');
}

export function novoProduto(quantidadeEmEstoque = 10): Produto {
  return {
    nome: `${faker.commerce.productName()} ${sufixoUnico()}`,
    preco: faker.number.int({ min: 10, max: 1000 }),
    descricao: faker.commerce.productDescription(),
    quantidade: quantidadeEmEstoque,
  };
}
