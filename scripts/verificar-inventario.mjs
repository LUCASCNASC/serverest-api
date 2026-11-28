import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

function assinatura(arquivo, titulo, tags) {
  return `${arquivo.replaceAll('\\', '/')}|${titulo}|${[...tags].sort().join(',')}`;
}

function incrementar(mapa, chave) {
  mapa.set(chave, (mapa.get(chave) ?? 0) + 1);
}

export function validarInventario(relatorio, html) {
  const esperados = new Map();
  function visitar(suite) {
    for (const spec of suite.specs ?? []) {
      for (let indice = 0; indice < spec.tests.length; indice++) {
        incrementar(esperados, assinatura(spec.file, spec.title, spec.tags));
      }
    }
    for (const filha of suite.suites ?? []) visitar(filha);
  }
  for (const suite of relatorio.suites) visitar(suite);

  const tabela = html.match(/<table id="casos">([\s\S]*?)<\/table>/);
  if (!tabela) throw new Error('Tabela de casos não encontrada no inventário');
  const encontrados = new Map();
  const ids = new Set();
  for (const [linha] of tabela[1].matchAll(/<tr\b[^>]*data-grupo="[^"]+"[^>]*>[\s\S]*?<\/tr>/g)) {
    const id = linha.match(/CT-\d+/)?.[0];
    const arquivo = linha.match(/href="tests\/([^"]+\.spec\.ts)"/)?.[1];
    const titulo = linha
      .match(/data-titulo="([^"]+)"/)?.[1]
      ?.replaceAll('&quot;', '"')
      .replaceAll('&lt;', '<')
      .replaceAll('&gt;', '>')
      .replaceAll('&amp;', '&');
    if (!id || !arquivo || !titulo || ids.has(id))
      throw new Error(`Caso inválido ou duplicado: ${id}`);
    ids.add(id);
    const tags = [...linha.matchAll(/class="tag">(@[^<]+)<\/span\s*>/g)].map((item) =>
      item[1].slice(1),
    );
    incrementar(encontrados, assinatura(arquivo, titulo, tags));
  }

  const diferencas = [...new Set([...esperados.keys(), ...encontrados.keys()])]
    .sort()
    .filter((chave) => esperados.get(chave) !== encontrados.get(chave))
    .map(
      (chave) =>
        `${chave}: Playwright=${esperados.get(chave) ?? 0}, inventário=${encontrados.get(chave) ?? 0}`,
    );
  const total = [...esperados.values()].reduce((soma, valor) => soma + valor, 0);
  if (!html.includes(`<strong>${total}</strong><span>casos descobertos`)) {
    diferencas.push(`Total de casos no cabeçalho deve ser ${total}`);
  }
  if (diferencas.length) throw new Error(`Inventário desatualizado:\n${diferencas.join('\n')}`);
  return total;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const saida = execFileSync(
    process.execPath,
    ['node_modules/@playwright/test/cli.js', 'test', '--list', '--reporter=json'],
    { encoding: 'utf8' },
  );
  const relatorio = JSON.parse(saida);
  const total = validarInventario(relatorio, readFileSync('inventario-testes.html', 'utf8'));
  process.stdout.write(
    `Inventário validado: ${total} casos, por título, arquivo e conjunto de tags.\n`,
  );
}
