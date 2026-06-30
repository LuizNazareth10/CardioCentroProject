# CardioCentro — Sistema de Agenda e Prontuário

Sistema interno para a clínica **CardioCentro** (Juiz de Fora — MG), cobrindo:

- **Agenda visual** diária (médicos em colunas × horários em grade de 15min)
- **Agendamento** em poucos cliques, sem conflito de horários
- **Sessões consecutivas**: o sistema prioriza o mesmo médico para exames seguidos
- **Ficha médica e triagem** por exame (padrão cardiologia)
- **Agente de WhatsApp** que conversa com pacientes e agenda automaticamente

## Demo rápido (sem nuvem)

```bash
# Clone e instale
git clone <repo>
cd cardiocentro-agenda
npm install

# Rode no modo memória (sem credenciais de nuvem)
DATA_BACKEND=memory AUTH_SECRET=dev npm run dev
```

Acesse **http://localhost:3000**  
Login demo: `admin@cardiocentro.com` / `cardio123`

## Testes

```bash
# Motor de agendamento (9 cenários, incluindo exames consecutivos)
npm run test:engine

# Agente de WhatsApp (simulação end-to-end de uma conversa)
npx tsx scripts/test-agent.ts
```

## Documentação

| Arquivo | Conteúdo |
|---------|---------|
| `docs/ARQUITETURA.md` | Stack, motor, fluxo do agente |
| `docs/CUSTOS.md` | Estimativa mensal de custos (Vercel, Firestore, WhatsApp) |
| `docs/DEPLOY.md` | Passo a passo: GCP, Vercel, Meta WhatsApp |
| `docs/DECISOES.md` | Decisões técnicas e **pendências com a clínica** |

## Estrutura de pastas

```
src/
├── app/
│   ├── (app)/          # Páginas protegidas (agenda, pacientes, agendar…)
│   ├── api/            # Rotas de API + webhook do WhatsApp
│   └── login/
├── components/         # Logo, Sidebar
└── lib/
    ├── db/             # Abstração memory | firestore
    ├── scheduling/     # Motor de agendamento (puro TS)
    ├── whatsapp/       # Agente, cliente Meta API, sessões
    ├── auth.ts         # Sessão JWT
    ├── format.ts       # Data/hora
    ├── seed-data.ts    # ⚠️ Atualizar com dados reais dos médicos
    └── types.ts
docs/
scripts/
firestore.rules
firestore.indexes.json
vercel.json
```

## Variáveis de ambiente

Copie `.env.example` para `.env.local` e preencha. Veja `docs/DEPLOY.md`.

## Pendências antes de ir para produção

1. **Dados reais dos médicos e exames** → editar `src/lib/seed-data.ts`
2. **Conta Meta Business verificada** e número de WhatsApp Business
3. **Credenciais GCP** (service account, project id)
4. **Trocar senha admin** antes de fazer o seed do Firestore

Detalhes em `docs/DECISOES.md`.

---

> Build: `npm run build` | Typecheck: `npx tsc --noEmit`
