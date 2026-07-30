# Diagnóstico e correção de performance da área restrita

> Contexto: após a retroalimentação (importação do histórico real),
> a área restrita passou a travar. Este documento explica **por que**,
> **o que foi corrigido** e **como medir**.

## O diagnóstico

Depois da importação, o banco de produção passou a ter:

- **~19.031 pacientes**
- **~94.514 agendamentos**

O código lia **coleções inteiras** e filtrava em memória. No Firestore, o
custo (tempo **e** dinheiro) é **por documento lido**. Resultado, por clique:

| Tela / ação | Como estava | Documentos lidos |
|---|---|---|
| **Agenda** (um dia) | `listarAgendamentos()` sem filtro → filtrava o dia em memória | **~94.514** |
| **Painel** | `listarAgendamentos()` + `listarPacientes()` inteiros | **~113.545** |
| **Disponibilidade** | lia todos os agendamentos | ~94.514 |
| **Novo agendamento** (conflito) | lia todos os agendamentos | ~94.514 |
| **Lista de pacientes** | lia todos e filtrava a busca em memória | ~19.031 |
| **Agente** (cada horário sugerido) | lia todos os agendamentos | ~94.514 |
| **Deduplicar paciente** (cada cadastro) | varria todos os pacientes | ~19.031 |

A cota **gratuita** do Firestore é **50.000 leituras/dia**. Ou seja: **abrir a
Agenda uma única vez já estourava a cota do dia inteiro** — e explicava tanto a
lentidão quanto o risco de custo.

## A correção

Regra nova, aplicada em `src/lib/db/index.ts`: **nenhuma função lê uma coleção
inteira**. Todo filtro vai **dentro da query** do Firestore.

1. **Agenda / Painel / Disponibilidade / Agente** — passam `de`/`ate` (e
   `pacienteId`, quando aplica) como cláusulas `where` na query. A Agenda de um
   dia lê **só os agendamentos daquele dia**.
2. **Contagens** (ex.: "pacientes cadastrados" no Painel) usam **agregação**
   (`.count()`) — **1 leitura** em vez de 19 mil.
3. **Busca de pacientes** é indexada: campos derivados `nomeBusca`,
   `nomeTokens`, `cpfDigitos`, `telefoneSufixo` e `telefonePrefixos` permitem
   `where`/prefixo/`array-contains` no banco. A lista é **paginada**
   ("Carregar mais"), 50 por vez. Ver "Como a busca funciona" abaixo.
4. **Deduplicação** de paciente e de lead do WhatsApp usa query por
   `cpfDigitos`/`telefoneSufixo` — não varre mais a coleção.
5. **Conflito de agendamento** lê **só o dia do médico** envolvido.
6. **Conversas / Leads** são ordenados e **limitados no banco**.
7. **Mensagens de atendimento** usam `arrayUnion` (append no servidor), sem
   reler e reenviar o histórico a cada mensagem.

### Novos índices do Firestore

Adicionados em `firestore.indexes.json` (fazer deploy deles):

- `pacientes`: `(nomeBusca ASC, id ASC)` — lista/busca paginada por nome.
- `leads`: `(telefoneSufixo ASC, origem ASC)` — dedupe do lead do WhatsApp.

> As buscas por `cpfDigitos`/`telefoneSufixo` (igualdade/prefixo em campo único)
> usam índice automático de campo — não precisam de índice composto.

### Backfill obrigatório (uma vez)

Os pacientes/leads já existentes foram gravados **antes** dos campos de busca.
Sem o backfill eles não apareceriam nas buscas:

```bash
npx tsx scripts/backfill-busca.ts --dry-run   # relatório
npx tsx scripts/backfill-busca.ts             # aplica (idempotente)
```

## Depois da correção

| Tela / ação | Documentos lidos agora |
|---|---|
| Agenda (um dia) | nº de agendamentos **daquele dia** (dezenas) |
| Painel | 1 (contagem) + agendamentos de hoje |
| Lista de pacientes | 50 (uma página) |
| Busca de paciente | ≤ 50 |
| Detalhe do paciente | histórico do paciente + suas triagens |
| Agente (marcar horário) | agendamentos da **janela futura** (~90 dias) |

Uma passada por **todas** as telas passa a custar da ordem de **centenas** de
leituras, não centenas de milhares — bem dentro da cota gratuita.

## Como medir (evidência objetiva)

```bash
DB_METRICS=1 npx tsx scripts/medir-performance.ts
```

O script exercita as operações de cada tela contra o Firestore real e imprime,
por operação, **quantos documentos** foram lidos e o **tempo**. Também é possível
ligar `DB_METRICS=1` no servidor para ver, nos logs, um aviso `⚠️ LEITURA EM
MASSA` sempre que alguma operação passar de 1.000 documentos — um alarme para
regressões futuras.

## Como a busca funciona (nome, CPF, telefone, nascimento)

Toda a normalização está em `src/lib/busca.ts`; as consultas, em
`listarPacientes` (`src/lib/db/index.ts`). Nenhuma delas usa índice composto.

**Texto (nome)** — duas consultas em paralelo, resultados somados:

1. prefixo de `nomeBusca` (nome completo normalizado) — cobre "ana s";
2. `array-contains` em `nomeTokens`, que guarda por paciente:
   - cada palavra do nome e seus **prefixos** a partir de 3 letras (`ferr`);
   - cada **par** de palavras em ordem alfabética (`ferreira|luiz`).

   É o par que faz **"luiz ferreira" achar "Luiz Gustavo Ferreira"** (pula o
   nome do meio) numa consulta só, em qualquer ordem. O que voltou é refinado
   em memória: cada palavra digitada precisa ser prefixo de alguma palavra do
   nome. Se as duas consultas voltarem vazias (alguém digitou palavras pela
   metade), há um plano B pela maior palavra, com teto de 300 documentos.

**Números (CPF · telefone · data de nascimento)** — o mesmo dígito pode ser as
três coisas, então as consultas rodam juntas e os resultados são somados:
prefixo de `cpfDigitos`, `array-contains` em `telefonePrefixos` e igualdade em
`dataNascimento` para cada leitura plausível da data (`10/05/1980`, `10-5-80`,
`10051980`, `1980-05-10`).

**Telefone com ou sem DDD** — o cadastro não é uniforme (alguns pacientes têm
o telefone salvo com DDD, outros só o número local — import antigo, cadastro
manual, agente do WhatsApp). `telefonePrefixos` (ver `ancorasDoTelefone`/
`prefixosDoTelefone` em `lib/busca.ts`) grava prefixos a partir de TODOS os
pontos de partida válidos do número (com DDI+DDD, só DDD, só local), inferidos
pelo COMPRIMENTO do que foi salvo (local 8/9 dígitos · com DDD 10/11 · com
DDI+DDD 12/13). Buscar "com ou sem DDD" funciona não importa como foi
cadastrado.

Isto substituiu um bug real: `telefoneSufixo` (últimos 8 dígitos, usado só
para DEDUPLICAR) corta pelo FIM — num celular local de 9 dígitos isso descarta
o "9" inicial, desalinhando qualquer busca por PREFIXO que comece do início
verdadeiro do número. `telefonePrefixos` corta cada âncora pelo INÍCIO, então
o "9" nunca se perde.

Custo: **≤ 50 documentos** por tecla no caminho comum (o plano B, raro, lê no
máximo 300). Testes em `npm run test:busca`.

## Limitação consciente

A busca por nome casa **palavras inteiras ou seus começos** — não é busca por
substring no meio da palavra: "ferreira" acha, "erreir" não. É o que permite
não ler 19 mil documentos a cada tecla. Para busca livre por substring no
futuro, o caminho é um serviço de indexação (Algolia/Typesense), fora do
escopo desta correção.
