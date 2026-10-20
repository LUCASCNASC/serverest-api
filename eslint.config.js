import { defineConfig } from 'eslint/config';
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import playwright from 'eslint-plugin-playwright';
import prettier from 'eslint-config-prettier';

export default defineConfig(
  {
    ignores: [
      'node_modules/',
      'playwright-report/',
      'test-results/',
      'blob-report/',
      'evidencias/',
    ],
  },

  js.configs.recommended,

  // Regras que usam os tipos do TypeScript. A mais importante para testes é a
  // `no-floating-promises`: aponta chamada assíncrona sem `await`, que faz o
  // teste terminar antes da verificação e passar sem ter validado nada.
  tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
  },
  {
    // Arquivos de configuração em JS não fazem parte do projeto TypeScript.
    files: ['**/*.js'],
    extends: [tseslint.configs.disableTypeChecked],
  },

  // Boas práticas do Playwright: `expect` sem `await`, teste sem asserção,
  // `test.only` esquecido, condicionais dentro do teste etc.
  {
    files: ['tests/**/*.ts'],
    extends: [playwright.configs['flat/recommended']],
    rules: {
      // Só estas tags são aceitas. Uma tag digitada errada (ex.: "@regresao")
      // não daria erro nenhum: o teste sumiria em silêncio da execução filtrada.
      'playwright/valid-test-tags': [
        'error',
        { allowedTags: ['@regressao', '@smoke', '@desafio-tecnico'] },
      ],
    },
  },

  // Desliga regras de estilo que conflitam com o Prettier (ele cuida da formatação).
  prettier,
);
