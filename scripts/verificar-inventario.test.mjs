import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validarInventario } from './verificar-inventario.mjs';

const relatorio = {
  suites: [
    {
      specs: [{ file: 'exemplo.spec.ts', title: 'exemplo', tags: ['regression'], tests: [{}] }],
      suites: [],
    },
  ],
};
const html = `<strong>1</strong><span>casos descobertos</span>
<table id="casos"><tr data-grupo="Exemplo" data-titulo="exemplo"><td>CT-01</td>
<td><span class="tag">@regression</span><a href="tests/exemplo.spec.ts">teste</a></td></tr></table>`;

test('confere o inventário e identifica divergências de fonte ou tag', () => {
  assert.equal(validarInventario(relatorio, html), 1);
  assert.throws(
    () =>
      validarInventario(relatorio, html.replace('data-titulo="exemplo"', 'data-titulo="alterado"')),
    /desatualizado/,
  );
  assert.throws(
    () => validarInventario(relatorio, html.replace('@regression', '@smoke')),
    /desatualizado/,
  );
  assert.throws(
    () => validarInventario(relatorio, html.replace('exemplo.spec.ts', 'outro.spec.ts')),
    /desatualizado/,
  );
  assert.throws(() => validarInventario(relatorio, html.replace('CT-01', 'inválido')), /inválido/);
});
