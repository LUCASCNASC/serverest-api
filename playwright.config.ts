import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',

  // Cada teste cria a sua própria massa (usuário, produtos e carrinho),
  // então eles podem rodar em paralelo sem um interferir no outro.
  fullyParallel: true,

  // ...mas sem exagero: a ServeRest pública responde 429 (Too Many Requests)
  // quando recebe muitas requisições simultâneas. 2 workers é um bom equilíbrio
  // entre velocidade e respeito ao ambiente compartilhado.
  workers: 2,

  // Evita subir um `test.only` esquecido para a pipeline.
  forbidOnly: !!process.env.CI,

  // A ServeRest é um ambiente público e às vezes derruba conexões (ECONNRESET).
  // 1 nova tentativa absorve essa instabilidade de rede. Não esconde nada:
  // o Playwright marca como "flaky" o teste que só passou na segunda vez.
  retries: 1,

  // Na pipeline (GitHub Actions), o reporter "github" também marca as falhas
  // direto na tela do Pull Request, na linha do teste que quebrou.
  reporter: process.env.CI
    ? [['github'], ['list'], ['html', { open: 'never' }]]
    : [['list'], ['html', { open: 'never' }]],

  use: {
    baseURL: process.env.BASE_URL ?? 'https://serverest.dev',
    extraHTTPHeaders: { Accept: 'application/json' },
    // Quando um teste falha, guarda cada requisição e resposta (URL, headers e
    // corpo) no relatório. Para investigar, abra o relatório e clique no trace.
    trace: 'retain-on-failure',
  },
});
