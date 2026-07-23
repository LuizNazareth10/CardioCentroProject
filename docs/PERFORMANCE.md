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
   `cpfDigitos` e `telefoneSufixo` permitem `where`/prefixo no banco. A lista é
   **paginada** ("Carregar mais"), 50 por vez.
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

## Limitação consciente

A busca de pacientes por **nome** é por **prefixo** (começo do nome), não por
substring — é o que permite não ler 19 mil documentos a cada tecla. Buscar
"silva" não encontra "José Silva"; buscar "josé s" encontra. Busca por telefone
e CPF é por dígitos. Para busca livre por substring no futuro, o caminho é um
serviço de indexação (Algolia/Typesense), fora do escopo desta correção.
