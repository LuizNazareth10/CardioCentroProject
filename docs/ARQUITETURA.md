# Arquitetura — Sistema CardioCentro

## Visão geral

```
Paciente (WhatsApp)
       │  Meta Cloud API  ┌─────────────────────────────┐
       └─────────────────►│  Next.js 14 (App Router)    │
                          │  Vercel / Cloud Run          │
Recepcionista (browser)──►│                             │
                          │  ┌──────────┐ ┌──────────┐  │
                          │  │ UI React │ │ API      │  │
                          │  │ (client) │ │ routes   │  │
                          │  └──────────┘ └────┬─────┘  │
                          │                    │         │
                          │  ┌─────────────────▼──────┐  │
                          │  │   Motor de agendamento  │  │
                          │  │   (puro TS, sem estado) │  │
                          │  └─────────────────┬───────┘  │
                          │                    │           │
                          │  ┌─────────────────▼───────┐  │
                          │  │   Camada de dados        │  │
                          │  │   memory | firestore     │  │
                          └──┴─────────────────────────-┘──┘
                                              │
                                    GCP Firestore
                                    (produção)
```

## Stack técnico

| Camada | Tecnologia | Motivo |
|--------|-----------|--------|
| Framework | Next.js 14 App Router | SSR nativo, API routes, rotas protegidas |
| Linguagem | TypeScript strict | Segurança de tipo em toda a base |
| Estilo | Tailwind CSS | Utility-first, zero runtime |
| Auth | JWT HS256 via `jose` + cookie httpOnly | Sem dependência de serviço externo |
| Banco | Firestore (GCP) | NoSQL, real-time nativo, free tier generoso |
| Banco local | In-memory (seed) | Demo instantânea, zero configuração |
| WhatsApp | Meta Cloud API (direto) | Estável, legal, sem intermediário |
| IA agente | Anthropic Claude Haiku | Barato, rápido; fallback por keywords |
| Deploy | Vercel Pro | Zero-config para Next.js |

## Motor de agendamento (`src/lib/scheduling/`)

Módulo **puro** (sem efeitos colaterais, sem I/O):

- `time.ts` — helpers de data/hora no fuso fixo BRT (-03:00)
- `engine.ts` — `gerarSlots()` e `proporSessao()`

### Regras do motor

1. Slots sempre em múltiplos de 15 min (grid = 15min).
2. Um médico nunca tem dois exames sobrepostos.
3. `proporSessao()` primeiro tenta encaixar todos os exames com o **mesmo médico**
   em bloco contíguo; se não der, distribui entre médicos mantendo sequência.
4. `naoAntesDe` garante que nunca se oferta slot no passado (importante no webhook).
5. A API `/api/agendamentos POST` **revalida conflito no servidor** antes de gravar
   (proteção contra condição de corrida se dois clientes submeterem simultaneamente).

## Agente de WhatsApp (`src/lib/whatsapp/`)

Arquitetura **híbrida** (menus + IA):

```
Paciente manda mensagem
       │
       ├── botão/lista selecionado  → máquina de estados (session.ts + agent.ts)
       │
       └── texto livre              → ai.ts (Claude Haiku interpreta)
                                          │
                                          └── retorna intenção estruturada
                                              → volta para a máquina de estados
```

### Etapas da conversa

```
inicio → menu → escolhendo_exames → escolhendo_medico
                                          │
                                   escolhendo_horario
                                          │
                                   identificacao
                                          │
                                   confirmando → gravar no banco
```

Estado de sessão fica em memória por 30 min de inatividade.
Em produção com Firestore, mover para coleção `wa_sessions` com TTL.

## Dados

### Coleções Firestore

| Coleção | Documento | Campos principais |
|---------|-----------|------------------|
| `pacientes` | `{id}` | nome, telefone, convenioId, fichaMedica |
| `agendamentos` | `{id}` | pacienteId, medicoId, exameId, inicio, fim, status, origem, grupoId |
| `triagens` | `{id}` | pacienteId, agendamentoId, PA, FC, sintomas, risco |
| `usuarios` | `{id}` | email, senhaHash, papel |
| `wa_sessions` | `{telefone}` | etapa, examesSelecionados, opcoes… (futuro) |

### Modo memória (desenvolvimento)

`DATA_BACKEND=memory` — dados em `src/lib/db/store.ts`.
Inclui 1 usuário admin e 1 paciente de demonstração.
**Dados resetam ao reiniciar o servidor — é esperado.**

## Segurança

- Senhas armazenadas com bcrypt (custo 10).
- Cookie de sessão `cc_session`: httpOnly, secure em produção, SameSite=lax.
- JWT expira em 12h.
- Rotas de API verificam sessão antes de qualquer operação.
- Firestore Security Rules bloqueiam acesso direto do browser (apenas server-side).
- Webhook do WhatsApp valida `WHATSAPP_VERIFY_TOKEN`.

## Real-time na agenda

Em desenvolvimento: a agenda faz polling ao navegar (fetch no useEffect).
Em produção com Firestore, pode-se substituir por `onSnapshot` do SDK web para
atualização em tempo real sem polling. Documentar e ativar quando necessário.
