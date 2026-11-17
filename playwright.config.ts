import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',

  // Cada teste cria a sua própria massa (usuário, produtos e carrinho),
  // então eles podem rodar em paralelo sem um interferir no outro.
  fullyParallel: true,

  // Limita a concorrência local; os jobs da CI ajustam workers conforme a suíte.
  workers: 2,

  // Evita subir um `test.only` esquecido para a pipeline.
  forbidOnly: !!process.env.CI,

  // CI deve falhar na primeira tentativa para não mascarar instabilidade.
  // Fora da CI, uma repetição ajuda durante o desenvolvimento e fica marcada como flaky.
  retries: process.env.CI ? 0 : 1,

  // Na pipeline (GitHub Actions), o reporter "github" também marca as falhas
  // direto na tela do Pull Request, na linha do teste que quebrou.
  reporter: process.env.CI
    ? [['github'], ['list'], ['blob']]
    : [['list'], ['html', { open: 'never' }]],

  use: {
    baseURL: process.env.BASE_URL ?? 'https://serverest.dev',
    extraHTTPHeaders: { Accept: 'application/json' },
    // Quando um teste falha, guarda cada requisição e resposta (URL, headers e
    // corpo) no relatório. Para investigar, abra o relatório e clique no trace.
    trace: 'retain-on-failure',
  },
});
