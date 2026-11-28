# Testes de API – Fluxo de compra ServeRest

Automação do fluxo principal de negócio da [ServeRest](https://serverest.dev) com **Playwright + TypeScript**:
cadastro de usuário → login → cadastro de produtos → carrinho (criar, consultar e encerrar).

**Navegação rápida:** [Stack](#stack) · [Preparando o ambiente](#preparando-o-ambiente) · [Como rodar](#como-rodar) · [Pipeline](#pipeline-github-actions) · [Organização](#organização) · [Cenários automatizados](#cenários-automatizados) · [Análise de qualidade](#análise-de-qualidade) · [Desafio de investigação](#desafio-de-investigação) · [Evidências](#evidências)

## Stack

| Ferramenta                                | Versão    | Por que escolhi                                                                                                                                                                                                                                                                                          |
| ----------------------------------------- | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Playwright Test](https://playwright.dev) | 1.64      | Tem cliente HTTP próprio (`APIRequestContext`), fixtures para preparar e limpar a massa, `test.step` para deixar o fluxo legível no relatório, tags, paralelismo, novas tentativas e trace das requisições, tudo sem bibliotecas extras. Se o projeto crescer para testes de tela, é a mesma ferramenta. |
| TypeScript                                | 6.0       | Tipagem dos dados enviados e das respostas da API: o editor sugere os campos e um nome errado é acusado antes de rodar.                                                                                                                                                                                  |
| Node.js                                   | 22+       | Ambiente de execução.                                                                                                                                                                                                                                                                                    |
| [Faker](https://fakerjs.dev)              | 10        | Gera dados realistas em português (nomes, produtos), já que a base é zerada toda noite e tudo precisa ser criado na hora.                                                                                                                                                                                |
| ESLint + `eslint-plugin-playwright`       | 10 / 2.12 | Acusa `await` esquecido (que faz o teste passar sem validar nada) e tags inválidas.                                                                                                                                                                                                                      |
| Prettier                                  | 3         | Formatação padronizada entre as pessoas que mantêm o projeto.                                                                                                                                                                                                                                            |

## Preparando o ambiente

Funciona em Windows, Linux e macOS. Siga os passos na ordem.

### 1. Instale o que é necessário

| Ferramenta                               | Versão                                                       | Para quê                                 |
| ---------------------------------------- | ------------------------------------------------------------ | ---------------------------------------- |
| [Node.js](https://nodejs.org)            | **22 ou superior** (a versão de referência está no `.nvmrc`) | Executar os testes                       |
| [Git](https://git-scm.com)               | qualquer versão recente                                      | Baixar o projeto e versionar as mudanças |
| [VS Code](https://code.visualstudio.com) | opcional, mas recomendado                                    | Editar e rodar os testes pela interface  |

Para conferir se já estão instalados:

```bash
node -v   # deve mostrar v22.x.x ou maior
npm -v
git --version
```

> Usa vários projetos com versões diferentes do Node? Instale o [nvm](https://github.com/nvm-sh/nvm) (Linux/macOS) ou o [nvm-windows](https://github.com/coreybutler/nvm-windows) e rode `nvm use` na pasta do projeto para trocar para a versão certa.

### 2. Baixe o projeto e instale as dependências

```bash
git clone <url-do-repositorio>
cd serverest-api
npm ci
```

Use `npm ci` e não `npm install`. O `npm ci` instala exatamente as versões registradas no `package-lock.json`, então todo mundo roda com as mesmas versões e o resultado não muda de uma máquina para outra. Só use `npm install <pacote>` quando quiser **adicionar ou atualizar** uma dependência (e faça commit do `package-lock.json` alterado).

Como os testes são só de API, **não é preciso** rodar `npx playwright install` (esse comando baixa navegadores, que este projeto não usa).

### 3. Confirme que está tudo funcionando

```bash
npm run verificar   # tipos, lint, formatação, infraestrutura e inventário
npm test            # todos os testes devem passar
```

### 4. (Recomendado) Configure o VS Code

Ao abrir a pasta, o VS Code vai sugerir instalar três extensões (recomendadas em `.vscode/extensions.json`):

| Extensão                       | Para quê                                                            |
| ------------------------------ | ------------------------------------------------------------------- |
| **Playwright Test for VSCode** | Rodar ou depurar um teste específico clicando no ícone ao lado dele |
| **ESLint**                     | Mostrar os problemas do lint enquanto você escreve                  |
| **Prettier**                   | Formatar o arquivo automaticamente ao salvar                        |

As configurações compartilhadas do editor (`.vscode/settings.json`) já ativam a formatação e as correções automáticas do lint ao salvar.

## Como rodar

**Por categoria (tags)**

Cada teste tem uma ou mais categorias:

| Tag                | O que é                                                                      | Testes                                                      |
| ------------------ | ---------------------------------------------------------------------------- | ----------------------------------------------------------- |
| `@regression`      | A suíte completa. **Todo teste tem esta tag.**                               | Todos (56; um opt-in)                                       |
| `@critical`        | Caminhos de maior risco, repetidos na investigação semanal de flakiness      | Fluxo de compra e ciclo de vida do carrinho (4)             |
| `@smoke`           | Responde rápido à pergunta "o essencial do negócio está funcionando?"        | Smoke tests centralizados por recurso em `tests/smoke/` (5) |
| `@desafio-tecnico` | O fluxo obrigatório pedido no desafio: usuário → login → produtos → carrinho | Fluxo de compra: concluir e cancelar (2)                    |

```bash
npm run test:regression   # todos os testes com @regression
npm run test:critical     # cenários @critical
npm run test:smoke        # só @smoke (cerca de 15 segundos)
npm run test:desafio      # só @desafio-tecnico
```

O script antigo `test:regressao` continua disponível como alias de `test:regression`. Para combinar tags, use expressões do Playwright. Por exemplo, testes de regressão que não são smoke: `npx playwright test --grep @regression --grep-invert @smoke`.

**Outras formas**

```bash
npm test                                         # tudo
npx playwright test tests/usuarios.spec.ts       # um arquivo só
npx playwright test -g "cancelar a compra"       # um teste só, pelo nome
npm run report                                   # abre o relatório HTML da última execução
```

**Qualidade do código**

```bash
npm run verificar         # executa todas as verificações abaixo
npm run typecheck         # checagem de tipos do TypeScript
npm run lint              # ESLint: boas práticas de TypeScript e de Playwright
npm run format:check      # confere se o código segue a formatação padrão (Prettier)
npm run test:infra        # testa limpeza, diagnóstico e respostas HTTP sem API externa
npm run inventario:check  # confere títulos, arquivos e tags do inventário com o Playwright

npm run lint:fix          # corrige automaticamente o que o lint souber corrigir
npm run format            # formata todos os arquivos
```

### Investigando uma falha

Quando um teste falha, o Playwright guarda um **trace**: o registro de cada requisição e resposta do teste, com URL, headers e corpo. Para ver:

1. Rode `npm run report`.
2. Abra o teste que falhou.
3. Clique em **Traces**.

Assim dá para ver exatamente o que a API respondeu, sem precisar rodar o teste de novo e torcer para a falha se repetir.

### Rodando contra outro ambiente

Por padrão os testes apontam para `https://serverest.dev`. Para usar outro endereço, inicie, por exemplo, a versão da ServeRest fixada no lockfile com `npm exec -- serverest --nodoc` e defina a variável `BASE_URL`:

```bash
# Linux / macOS / Git Bash
BASE_URL=http://localhost:3000 npm test
```

```powershell
# Windows PowerShell
$env:BASE_URL="http://localhost:3000"; npm test
```

A ServeRest local é útil quando o ambiente público estiver fora do ar, lento ou recusando requisições.

O teste de concorrência da última unidade fica desativado por padrão: uma sondagem local com a
ServeRest 3.2.2 aceitou duas compras simultâneas para uma única unidade. Execute-o somente em
uma instância local isolada e descartável, depois de iniciá-la em `http://127.0.0.1:3000`:

```powershell
$env:BASE_URL="http://127.0.0.1:3000"; $env:TESTAR_CONCORRENCIA="1"
npx playwright test tests/integridade-do-carrinho.spec.ts --grep "última unidade" --retries=0
Remove-Item Env:TESTAR_CONCORRENCIA
```

```bash
BASE_URL=http://127.0.0.1:3000 TESTAR_CONCORRENCIA=1 npx playwright test tests/integridade-do-carrinho.spec.ts --grep "última unidade" --retries=0
```

O teste usa requisições HTTP concorrentes via `fetch` e verifica que só uma compra seja aceita.
Não há garantia de que uma única execução provoque a corrida; uma falha expõe um possível defeito
do serviço testado. Esse cenário não roda nos checks de PR: é monitorado em job informativo
semanal ou manual, com 10 repetições, e seu resultado real aparece no resumo e no relatório.

### Problemas comuns

| Sintoma                                 | Causa provável                                     | O que fazer                                                                                                    |
| --------------------------------------- | -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `ECONNRESET` ou timeout                 | Instabilidade do ambiente público                  | Fora da CI, o teste é repetido 1 vez. Na CI não há retry, para que falhas intermitentes não fiquem mascaradas. |
| Status `429` (Too Many Requests)        | Muitas requisições simultâneas ao ambiente público | Não aumente o número de `workers` ao testar contra o ambiente público. A CI usa uma instância local isolada.   |
| Teste marcado como `flaky` no relatório | Falhou na 1ª tentativa e passou na 2ª localmente   | Investigue se o mesmo teste falha repetidamente; a CI falha na primeira tentativa e mantém o sinal visível.    |
| Falhas perto da meia-noite              | A base da ServeRest é apagada toda noite           | Rode novamente depois do reset.                                                                                |
| Erro de sintaxe ao instalar ou rodar    | Versão do Node abaixo da 22                        | Atualize o Node (veja o passo 1).                                                                              |

## Pipeline (GitHub Actions)

A pipeline fica em [`.github/workflows/testes-api.yml`](.github/workflows/testes-api.yml). Cada job que executa testes inicia uma instância isolada do ServeRest `3.2.2` em `127.0.0.1`; assim, shards e workflows não compartilham massa nem dependem da disponibilidade, do rate limit ou do reset noturno da API pública. A checagem pública é apenas informativa. Na CI, retries são desativados para que não escondam falhas intermitentes.

```
Disponibilidade pública (informativa)
Lint e tipos ──► Smoke (PR) ──► Regressão em 2 shards
                         └────► Relatório consolidado
Agendada: regressão completa ou flaky hunt + monitoramento de concorrência
```

| Job                            | Gatilho                        | O que faz                                                                                                                                                                |
| ------------------------------ | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Disponibilidade da API**     | Todos                          | Verifica `/usuarios`, `/produtos` e `/carrinhos` no serviço público; é informativa e não bloqueia a suíte isolada.                                                       |
| **Lint e tipos**               | Todos                          | Executa `npm run verificar` e bloqueia a validação quando tipos, lint ou formatação falham.                                                                              |
| **Smoke**                      | Pull Request e execução manual | Executa `@smoke` com 1 worker na instância local efêmera.                                                                                                                |
| **Regressão**                  | Pull Request e push em `main`  | Executa `@critical` + `@regression` em 2 shards independentes; o caso de concorrência opt-in é ignorado por padrão.                                                      |
| **Regressão completa noturna** | Segunda a sexta                | Executa toda a suíte na instância local. Não há matriz de navegadores porque o projeto testa somente API HTTP.                                                           |
| **Investigação de flakiness**  | Domingo e execução manual      | Repete os cenários `@critical` 10 vezes, em sequência e sem retry, na instância local isolada.                                                                           |
| **Concorrência**               | Domingo e execução manual      | Repete a disputa pela última unidade 10 vezes em instância isolada; o resultado é informativo e fica visível no resumo.                                                  |
| **Consolidar resultados**      | Após os jobs                   | Mescla os relatórios Playwright, publica o HTML por 14 dias, escreve um resumo e atualiza um comentário no PR quando o token tem permissão (PRs do próprio repositório). |

**Quando roda:**

| Gatilho                                                             | Execuções                                                                                    |
| ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Pull Request                                                        | Lint/tipos, smoke e regressão em shards (smoke termina antes dos shards para reduzir carga). |
| Push em `main`                                                      | Lint/tipos e regressão em shards.                                                            |
| Segunda a sexta, às 9h (Brasília)                                   | Regressão completa noturna.                                                                  |
| Domingo, às 10h (Brasília)                                          | `@critical` repetidos 10 vezes e monitoramento isolado da concorrência.                      |
| Manual, pela aba **Actions** → **Testes de API** → **Run workflow** | Escolha `regression`, `smoke`, `desafio-tecnico`, `flaky-hunt` ou `concorrencia`.            |

**Por que 2 shards com 1 worker:** dividem a regressão sem aumentar a concorrência total de testes em relação aos 2 workers anteriores. Os shards só iniciam depois do smoke no PR e cada job usa sua própria instância local.

**Onde ver o relatório:** na execução, em **Summary** → **Artifacts** → `relatorio-playwright`. Baixe, descompacte e abra o `index.html`. Os traces são mantidos apenas nos relatórios dos testes que falharam; os artefatos HTML expiram em 14 dias.

**Bloqueio de merge:** configure nas regras da branch `main` os checks `Lint e tipos`, `Smoke tests` e os dois checks `Regressão (shard ...)`. A disponibilidade da API pública é somente informativa; não a marque como obrigatória. Também não marque `Consolidar resultados` como obrigatório: ele existe para publicar o diagnóstico mesmo quando algum job falha.

**Outro ambiente:** para rodar a pipeline contra outro endereço, crie a variável `BASE_URL` em **Settings** → **Secrets and variables** → **Actions** → **Variables**. Sem ela, a pipeline usa `https://serverest.dev`.

## Organização

```
src/
  api/serverest.ts      → uma classe por recurso (usuarios, login, produtos, carrinhos); só faz as requisições
  dados/fabrica.ts      → gera usuários e produtos novos, com dados únicos
  dados/mensagens.ts    → mensagens esperadas da API, em um só lugar
  fixtures.ts           → injeta a API nos testes, prepara massa e limpa tudo no final
  verificacoes.ts       → verificações reaproveitadas (conferir estoque, ler o conteúdo do token)
  tipos.ts              → formatos dos dados enviados e das respostas da API
tests/
  fluxo-de-compra.spec.ts         → fluxo do desafio e cenários críticos (@desafio-tecnico, @regression e @critical)
  regras-do-carrinho.spec.ts      → regras do carrinho, limites e autorização
  ciclo-do-carrinho.spec.ts       → repetição de operações e novas compras
  integridade-do-carrinho.spec.ts → isolamento entre clientes e proteção dos dados ligados ao carrinho
  usuarios.spec.ts                → cadastro e login dos perfis administrador e comum
  produtos.spec.ts                → validações, permissões e compra entre perfis
  smoke/
    login.spec.ts                 → autenticação e token
    users.spec.ts                 → listagem, cadastro, consulta, atualização e exclusão
    products.spec.ts              → listagem, cadastro, consulta, atualização e exclusão
    carts.spec.ts                 → listagem, cadastro, consulta, cancelamento e conclusão

.github/workflows/testes-api.yml  → pipeline: saúde da API e testes (GitHub Actions)
tests-infra/                      → testes isolados da infraestrutura da suíte
scripts/verificar-inventario.mjs  → compara inventário HTML à descoberta do Playwright
.vscode/                          → extensões e configurações do editor compartilhadas pelo time
eslint.config.js                  → regras do lint
.prettierrc.json                  → regras de formatação
playwright.config.ts              → URL da API, paralelismo, novas tentativas, trace e relatório
```

A ServeRest tem **dois perfis de usuário**. O **administrador** é o único que cadastra produtos. O **comum** (cliente) só compra. O fluxo de compra usa um administrador, porque o desafio pede que o mesmo usuário cadastre os produtos. As suítes de usuários e produtos:

- roda os mesmos testes de cadastro e login para os dois perfis;
- valida as permissões de cada um;
- cobre a integração entre eles: o admin cadastra os produtos e o cliente compra com o próprio token.

Decisões que vale explicar:

- **As asserções ficam nos testes, não nas classes de API.** As classes só devolvem a resposta. Assim, cada teste mostra claramente o que espera.
- **A passagem de dados entre as chamadas fica à vista.** No `fluxo-de-compra.spec.ts`, o `_id` do usuário, o `token` do login e os `_id` dos produtos são guardados em variáveis e passados como parâmetro para as chamadas seguintes. O relatório do Playwright mostra cada passo numerado (`test.step`).
- **Status HTTP e corpo são validados em conjunto.** Nos pontos críticos, o corpo é comparado por inteiro (`toEqual`). No carrinho, o objeto esperado é calculado a partir do que foi cadastrado: preço unitário, quantidade total e preço total.
- **Cada teste cria a própria massa.** Por isso eles rodam em paralelo sem interferir uns nos outros.
- **As respostas distinguem sucesso de erro.** `json()` retorna `unknown`, adequado a respostas não verificadas; `jsonSucesso()` exige status HTTP de sucesso e retorna o tipo declarado em `src/tipos.ts`. Isso não valida o schema em tempo de execução: os testes continuam responsáveis pelas asserções do corpo.
- **O lint protege contra falso positivo.** O erro mais perigoso em testes assíncronos é esquecer um `await`: o teste termina antes de a verificação acontecer e passa sem validar nada. As regras `no-floating-promises` (TypeScript) e `missing-playwright-await` (Playwright) acusam esse erro no editor, no `npm run verificar` e na pipeline, antes de o código chegar à branch principal.
- **O TypeScript está fixado na versão 6.0.** O `typescript-eslint` ainda não suporta o TypeScript 7. Quando suportar, basta atualizar os dois juntos.

## Cenários automatizados

São 56 testes descobertos, incluindo um cenário de concorrência opt-in que é ignorado por padrão.
Todos têm a tag `@regression`. A tag `@critical` seleciona um subconjunto para repetição semanal;
as outras tags aparecem na coluna ao lado. Veja também o [inventário de testes](inventario-testes.html).

**Smoke tests por recurso** (`tests/smoke/`)

| Arquivo            | Operações cobertas                                                                        |
| ------------------ | ----------------------------------------------------------------------------------------- |
| `login.spec.ts`    | Login válido e emissão de token para o usuário autenticado                                |
| `users.spec.ts`    | Listar, cadastrar, consultar, atualizar e excluir usuário                                 |
| `products.spec.ts` | Listar, cadastrar, consultar, atualizar e excluir produto                                 |
| `carts.spec.ts`    | Listar, cadastrar, consultar, cancelar e concluir compra, incluindo os efeitos no estoque |

**Fluxo de compra**, o fluxo obrigatório do desafio (`fluxo-de-compra.spec.ts`)

| Cenário                                                                                                                  | Tags extras        |
| ------------------------------------------------------------------------------------------------------------------------ | ------------------ |
| Cadastrar usuário, fazer login, cadastrar produtos, criar, consultar e **concluir** a compra, mantendo o estoque baixado | `@desafio-tecnico` |
| Cadastrar usuário, fazer login, cadastrar produtos, criar, consultar e **cancelar** a compra, devolvendo o estoque       | `@desafio-tecnico` |

**Regras do carrinho** (`regras-do-carrinho.spec.ts`)

| Cenário                                                                                    |
| ------------------------------------------------------------------------------------------ |
| Não permite mais de um carrinho por usuário                                                |
| Não permite comprar mais do que o estoque disponível                                       |
| Não permite o mesmo produto repetido no carrinho                                           |
| Não permite carrinho com produto inexistente                                               |
| Não baixa parcialmente o estoque quando um item do carrinho é inválido ou está sem estoque |
| Não cria carrinho sem token de autenticação                                                |
| Não cria carrinho com token malformado, adulterado ou de usuário excluído                  |
| Não cria carrinho com lista vazia de produtos                                              |
| Não permite cancelar carrinho sem token; o carrinho e o estoque permanecem inalterados     |
| Concluir compra sem carrinho responde 200, mas com mensagem diferente                      |
| Cancelar compra sem carrinho responde 200, mas com mensagem diferente                      |
| Não aceita carrinho com quantidade 0                                                       |
| Não aceita carrinho com quantidade -5                                                      |

**Ciclo do carrinho** (`ciclo-do-carrinho.spec.ts`)

| Cenário                                                                 |
| ----------------------------------------------------------------------- |
| Repetir conclusão ou cancelamento não altera o estoque novamente        |
| Permite uma nova compra depois de concluir a anterior                   |
| Permite uma nova compra depois de cancelar a anterior e repõe o estoque |

**Integridade do carrinho** (`integridade-do-carrinho.spec.ts`)

| Cenário                                                                                                              |
| -------------------------------------------------------------------------------------------------------------------- |
| Concluir a compra de um cliente não afeta o carrinho de outro                                                        |
| O estoque reservado por um cliente só volta para venda quando ele cancela (inclui comprar exatamente todo o estoque) |
| Dois clientes disputam simultaneamente a última unidade (opt-in; ServeRest local isolada)                            |
| Não exclui produto que faz parte de um carrinho                                                                      |
| Não exclui usuário que tem carrinho                                                                                  |
| O carrinho mantém o preço do momento da compra quando o produto muda de preço                                        |

**Usuários: administrador e comum** (`usuarios.spec.ts`)

| Cenário                                                                  | Tags extras |
| ------------------------------------------------------------------------ | ----------- |
| Cadastra o usuário administrador e persiste os dados enviados            |             |
| Administrador faz login e recebe um token do próprio usuário             |             |
| Cadastra o usuário comum e persiste os dados enviados                    |             |
| Usuário comum faz login e recebe um token do próprio usuário             |             |
| Não cadastra usuário com e-mail já utilizado                             |             |
| Não cadastra usuário com e-mail inválido ou campos obrigatórios ausentes |             |
| Não faz login com senha errada                                           |             |
| Após editar o e-mail, rejeita o antigo e permite login com o novo        |             |

**Produtos e permissões** (`produtos.spec.ts`)

| Cenário                                                                   | Tags extras |
| ------------------------------------------------------------------------- | ----------- |
| Administrador cadastra produto, e o produto fica disponível para consulta |             |
| Não cadastra produto com nome já utilizado                                |             |
| Não atualiza produto para um nome já utilizado e preserva seus dados      |             |
| Não cadastra ou atualiza produto com preço ou quantidade negativos        |             |
| Usuário comum não pode cadastrar produto (403)                            |             |
| Usuário comum não pode alterar ou excluir produto (403)                   |             |
| Usuário comum compra produtos cadastrados por um administrador            |             |

## Análise de qualidade

### Contexto que influenciou as decisões

A base da ServeRest **é apagada toda noite**. Daí vêm três consequências:

1. Nenhum teste pode depender de dados existentes (IDs fixos, usuário "de teste" cadastrado antes). Tudo é criado na hora, a cada execução.
2. Os dados são únicos (e-mail e nome de produto com sufixo aleatório), porque durante o dia outras pessoas usam o mesmo ambiente, e a API não aceita e-mail nem nome de produto repetidos.
3. Ao final de cada teste, o que foi criado é apagado (carrinho → produtos → usuário, nessa ordem, porque a API bloqueia a exclusão de produto em carrinho e de usuário com carrinho). A limpeza é repetida até três vezes em erros transitórios; falhas persistentes são anotadas e anexadas ao relatório e avisadas no log, sem substituir o resultado do teste. Os testes de infraestrutura exercitam esses caminhos.

### Cenários mais críticos e por quê

| Cenário                                                                                     | Por que é crítico                                                                                                                                                             |
| ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fluxo completo até **concluir** a compra                                                    | É o caminho que gera receita. Se ele quebra, o negócio para.                                                                                                                  |
| **Estoque** baixa ao criar o carrinho, continua baixado ao concluir e **volta** ao cancelar | Erro de estoque significa vender o que não existe ou travar produto que estaria disponível. É o efeito colateral mais caro do fluxo, e o status code sozinho não mostra isso. |
| Consulta do carrinho com **valores corretos** (preço unitário, totais, usuário dono)        | Total errado é cobrança errada.                                                                                                                                               |
| Só **1 carrinho por usuário** e nada de quantidade **acima do estoque**                     | São as travas que impedem vender além do disponível. Também confirmo que a tentativa rejeitada não mexeu no estoque.                                                          |
| Carrinho **sem token** é recusado                                                           | Sem isso, qualquer pessoa compraria em nome de qualquer usuário.                                                                                                              |
| **Usuário comum** cadastra, faz login e compra, mas **não** cadastra produto (403)          | O cliente é quem gera a venda, e a separação de perfis impede que qualquer cliente altere o catálogo.                                                                         |
| Carrinho com quantidade **zero ou negativa** é recusado                                     | Se fosse aceito, criar o carrinho faria o estoque _aumentar_ sem nenhuma compra real.                                                                                         |
| Comprar **exatamente todo o estoque** é aceito                                              | É o valor limite: `estoque + 1` é recusado, `estoque` tem que passar. Erros de `>` no lugar de `>=` aparecem aqui. Coberto no primeiro passo do teste de disputa de estoque.  |
| A ação de um cliente **não afeta o carrinho de outro**                                      | O DELETE do carrinho não recebe ID, só o token. Se essa ligação falhar, um cliente apaga o carrinho de outro.                                                                 |
| O estoque reservado **só volta para venda quando o cliente cancela**                        | Versão sequencial (e por isso confiável) da disputa pela última unidade entre dois clientes.                                                                                  |
| Produto ou usuário com carrinho **não pode ser excluído**                                   | Se pudesse, ficaria um carrinho apontando para um produto que não existe ou sem dono: um pedido quebrado.                                                                     |
| O carrinho **mantém o preço** do momento da compra                                          | Se o preço mudar depois, o cliente não pode pagar um valor diferente do que viu.                                                                                              |
| **Comprar de novo** depois de concluir                                                      | A trava de "1 carrinho por usuário" precisa ser liberada; senão o cliente compra uma única vez.                                                                               |

### Riscos identificados no mapeamento

- **O DELETE devolve 200 nos dois casos.** `concluir-compra` e `cancelar-compra` respondem 200 tanto quando excluem quanto quando _não existe carrinho_. Um teste que olhe só o status passa mesmo sem excluir nada (falso positivo). Por isso valido a mensagem e, depois, confirmo que o carrinho sumiu (`GET /carrinhos/{id}` → 400). Há um teste dedicado a esse comportamento.
- **Defeitos identificados no Swagger:** há divergências entre os exemplos documentados e as respostas observadas na API:
  - `DELETE /carrinhos/cancelar-compra`: o Swagger informa `"Registro excluído com sucesso"`, mas a API retorna `"Registro excluído com sucesso. Estoque dos produtos reabastecido"`.
  - Exclusões de produto ou usuário bloqueadas por um carrinho: a API inclui o identificador do carrinho na resposta (`idCarrinhos` para produto e `idCarrinho` para usuário), campos ausentes dos exemplos do Swagger.

  São defeitos da documentação, não critérios para alterar o comportamento da API. Os testes registram o status HTTP e o corpo efetivamente observado; os casos de exclusão bloqueada confirmam também que o recurso continua disponível.

- **O ambiente público usado por execuções locais é compartilhado.** Ele pode derrubar conexões (`ECONNRESET`), responder `429 Too Many Requests` ou ser reiniciado à noite. Para reduzir a exposição, a CI executa em instâncias locais efêmeras e independentes; execuções locais continuam podendo apontar para o serviço público por padrão.
- **Retries não devem mascarar instabilidade.** Localmente, um retry ajuda a investigar: o Playwright marca como `flaky` o teste que passa na segunda tentativa. Na CI, retries são zero e a primeira falha fica visível, inclusive no flaky-hunt.
- **Dados expostos sem autenticação.** O `GET /carrinhos` é público e lista os carrinhos de _todos_ os usuários, e o `GET /usuarios` devolve inclusive a senha de cada usuário. Como a ServeRest é uma ferramenta de estudo, isso deve ser intencional, mas num sistema real seria um problema grave de privacidade e segurança, e eu reportaria.
- **O token carrega a senha em texto aberto.** O JWT do login traz no conteúdo o e-mail **e a senha** do usuário, legíveis por qualquer pessoa que tenha o token. Num sistema real, isso seria um achado de segurança grave.
- **O token vale 600 segundos.** Os testes não são afetados porque cada um faz login novo e termina em segundos.

### O que decidi testar

O critério foi priorizar o que, se quebrar, causa prejuízo ao negócio ou ao cliente, na ordem da tabela de cenários críticos. Na prática:

- **O fluxo obrigatório completo, nas duas formas de encerrar** (concluir e cancelar). As duas fazem parte do desafio ("conclusão ou cancelamento") e cada uma tem um efeito diferente no estoque.
- **O estado do sistema depois de cada ação, e não só a resposta.** Confiro o estoque antes e depois, consulto o carrinho por ID e pela lista do usuário e confirmo que o carrinho deixou de existir depois do DELETE.
- **As regras e os limites que protegem o estoque e o dinheiro:** um carrinho por usuário, estoque insuficiente, quantidade zero ou negativa, produto e usuário que não podem ser excluídos, preço congelado no carrinho.
- **A interação entre dois clientes e entre os dois perfis**, porque é onde aparecem os erros de "dado de uma pessoa afetando outra".

A lista dos cenários está em [Cenários automatizados](#cenários-automatizados).

### O que decidi não testar (e por quê)

| Fora do escopo                                                                                     | Justificativa                                                                                                                                                                                                                        |
| -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| CRUD completo de usuários e produtos (editar usuário, listagens com filtros, exclusão com sucesso) | O objetivo é a integração do fluxo de compra. De usuários e produtos, testei o que o fluxo usa ou o que afeta o carrinho: cadastro, login, permissões, alteração de preço e exclusões bloqueadas. O restante seriam suítes próprias. |
| Expiração real do token                                                                            | Exigiria esperar 10 minutos a cada execução. O custo é alto para pouco ganho, e o caso "sem token" já cobre a rejeição.                                                                                                              |
| Carga e performance                                                                                | Gerar carga num serviço público e gratuito prejudica outras pessoas e não daria medições confiáveis.                                                                                                                                 |
| Validação formal de schema (JSON Schema)                                                           | As comparações de corpo inteiro com `toEqual` já pegam campo faltando, sobrando ou com valor errado nos pontos críticos. Uma biblioteca de schema traria mais complexidade do que valor para este escopo.                            |
| Segurança aprofundada (injeção, força bruta, varredura de vulnerabilidades)                        | Foge do escopo funcional do desafio. Os achados de exposição de dados estão registrados nos riscos.                                                                                                                                  |

### Próximos passos

Investigar a condição de corrida observada na instância local e avaliar outras validações de
entrada e autorização conforme o contrato e os riscos do produto.

## Desafio de investigação

> **Cenário:** "Às vezes, o cliente paga, mas o pedido não aparece na tela de 'Meus Pedidos'." Sem acesso ao código-fonte; com acesso ao ambiente de produção, logs básicos e apoio dos times de Produto e Backend.

### Minha primeira ação

**Pegar casos reais e seguir um deles do começo ao fim.** Peço ao time de Produto ou de Suporte de 2 a 3 reclamações concretas, com o identificador do cliente, o horário do pagamento, o valor e o meio de pagamento. Com um caso em mãos, sigo o rastro nos logs: o pagamento foi confirmado → o pedido foi criado → o pedido está ligado a esse cliente → a tela "Meus Pedidos" consulta e mostra esse pedido.

**Por quê:** "às vezes" é a palavra mais importante do relato. Um problema intermitente não se resolve tentando reproduzir às cegas, porque posso fazer dez compras e todas funcionarem. Um caso real que **já falhou** transforma uma reclamação vaga em um rastro que dá para seguir. E me mostra **em que elo da cadeia** o pedido se perde, que é o que define quem investiga o quê.

### Hipótese inicial

**O pedido depende de uma confirmação de pagamento que chega depois, e às vezes essa confirmação falha, atrasa ou chega fora de ordem.**

Na maioria das lojas, o pagamento é confirmado pela operadora por uma notificação assíncrona (um "aviso" que chega ao sistema depois). Se esse aviso dá erro, demora, é perdido ou chega duplicado, o dinheiro sai da conta do cliente, mas o pedido fica preso em um estado intermediário (por exemplo, "aguardando pagamento") ou nem é criado. Se a tela "Meus Pedidos" mostra só pedidos confirmados, ele "some" para o cliente.

Escolhi essa hipótese porque ela explica bem o "às vezes". Um erro de lógica comum falharia sempre; falhas intermitentes costumam vir de processos assíncronos, tempo limite de resposta e novas tentativas.

Não descarto outras hipóteses, em ordem do que eu verificaria:

1. **O pedido existe, mas a tela não mostra:** cache, banco de leitura com atraso, filtro por status ou paginação.
2. **O pedido foi criado para outra conta:** compra sem login, conta duplicada, sessão trocada. É o mesmo tipo de risco que cobri nos testes de isolamento entre clientes.
3. **O pedido só seria criado quando o cliente volta da página de pagamento**, e ele fechou o navegador ou o app antes disso.

### Como reduziria a incerteza rapidamente

A ideia é dividir o caminho ao meio a cada pergunta, como uma busca binária. Cada resposta descarta metade das hipóteses:

1. **O pedido existe?** Com o time de Backend, consulto o pedido do caso real direto na API ou no banco, sem passar pela tela.
   - **Existe:** o problema está na **exibição**. Confiro o status do pedido, a qual cliente ele pertence e se a API de "Meus Pedidos" o retorna. Se a API retorna e a tela não mostra, é front-end ou cache. Hipóteses 1 e 2.
   - **Não existe:** o problema está na **criação**. Busco nos logs, no horário do pagamento, se a confirmação da operadora chegou, se deu erro, demorou ou foi repetida. Hipótese inicial e hipótese 3.
2. **Qual é o padrão?** Comparo os casos afetados: meio de pagamento (PIX e boleto são mais assíncronos que cartão), horário (picos de acesso), app ou navegador e versão, tempo entre o pagamento e a confirmação. Um ponto em comum entre os casos costuma apontar a causa.
3. **Qual é o tamanho?** Peço ao Backend que cruze, em um período, os **pagamentos aprovados na operadora** com os **pedidos criados**. A diferença entre as duas listas mostra a taxa de ocorrência e **todos** os clientes afetados, não só os que reclamaram. Isso define a prioridade: cliente que pagou e não recebeu é impacto financeiro, jurídico e de reputação.

Em paralelo, combino com Produto e Suporte o tratamento dos clientes já afetados (conciliar os pedidos manualmente ou estornar), porque a investigação não pode deixar quem já pagou esperando.

Depois de achar a causa, eu garantiria que o problema não volta:

- **Teste automatizado do cenário:** por exemplo, confirmação de pagamento atrasada ou duplicada.
- **Alerta em produção:** quando houver pagamento aprovado sem pedido correspondente depois de X minutos.

É o mesmo princípio que segui nesta automação. Uma resposta de sucesso não basta: confiro o **estado** do sistema depois da ação. Foi assim que tratei o `DELETE` do carrinho, que responde 200 até quando não exclui nada.

## Evidências

A pasta [`evidencias/`](evidencias/) contém evidências arquivadas de uma execução anterior contra `https://serverest.dev` (**26 testes, 26 passando, 0 flaky**). A suíte atual tem 56 testes descobertos, incluindo um opt-in; o relatório atualizado é publicado como artefato pela pipeline.

| Arquivo                                                                         | O que é                                                                                                    |
| ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| [`relatorio-html/index.html`](evidencias/relatorio-html/index.html)             | Relatório interativo do Playwright. Abra no navegador para ver cada teste, os passos, as tags e a duração. |
| [`execucao.log`](evidencias/execucao.log)                                       | Saída do terminal da execução.                                                                             |
| [`01-visao-geral.png`](evidencias/01-visao-geral.png)                           | Todos os testes, com resultado, tags e duração.                                                            |
| [`02-tag-desafio-tecnico.png`](evidencias/02-tag-desafio-tecnico.png)           | Relatório filtrado pela tag `@desafio-tecnico`.                                                            |
| [`03-passos-do-fluxo-concluir.png`](evidencias/03-passos-do-fluxo-concluir.png) | O fluxo do desafio aberto passo a passo: usuário → login → produtos → carrinho.                            |
| [`04-tag-smoke.png`](evidencias/04-tag-smoke.png)                               | Relatório filtrado pela tag `@smoke`.                                                                      |

**O fluxo do desafio, passo a passo:**

![Passos do fluxo de compra no relatório do Playwright](evidencias/03-passos-do-fluxo-concluir.png)

**A suíte completa:**

![Visão geral do relatório arquivado com 26 testes passando](evidencias/01-visao-geral.png)

Para gerar um novo relatório de evidências na mesma pasta:

```bash
# Linux / macOS / Git Bash
PLAYWRIGHT_HTML_OUTPUT_DIR=evidencias/relatorio-html npx playwright test
```

```powershell
# Windows PowerShell
$env:PLAYWRIGHT_HTML_OUTPUT_DIR="evidencias/relatorio-html"; npx playwright test
```
