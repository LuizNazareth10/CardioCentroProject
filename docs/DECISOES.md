# Decisões e pendências

## Decisões tomadas

### 1. WhatsApp: API Oficial da Meta (Cloud API)
**Motivo:** estável, legal, sem intermediário (BSP). Integração direta via webhook.
**Implicação:** precisa de conta Meta Business verificada e número dedicado.

### 2. Agente: modo híbrido (menus + IA)
**Motivo:** menus são gratuitos e rápidos para o fluxo normal; IA (Claude Haiku)
entra só para texto livre, mantendo o custo baixo.
**Implicação:** precisa de `ANTHROPIC_API_KEY`. Sem ela, o agente usa fallback
por palavras-chave e continua funcionando.

### 3. Banco de dados: Firestore (GCP)
**Motivo:** free tier generoso (50k leituras + 20k escritas/dia), real-time nativo,
sem gerenciar servidor, custo zero para o volume de uma clínica pequena.
**Alternativa descartada:** Cloud SQL (Postgres) custaria ~US$9-25/mês ocioso.

### 4. Abstração memory/firestore
**Motivo:** permite rodar o sistema completamente offline para demo e testes,
sem credenciais de nuvem. `DATA_BACKEND=memory` usa store em memória;
`DATA_BACKEND=firestore` usa GCP.

### 5. Sessão de agente em memória
**Motivo:** simplicidade de implementação. TTL de 30 min.
**Limitação:** reiniciando o servidor, sessões abertas de WhatsApp são perdidas.
**Evolução:** mover `wa_sessions` para Firestore com TTL quando necessário.

---

## Pendências do lado da clínica

### ⚠️ Dados reais dos médicos (PENDENTE)
O arquivo `src/lib/seed-data.ts` tem placeholders:
- `Dr. Exemplo Um`, `Dra. Exemplo Dois`, `Dr. Exemplo Três`
- Horários: seg-sex 08:00-12:00 / 13:00-18:00 / 08:00-14:00
- CRMs genéricos

**Para atualizar:** edite `MEDICOS` em `src/lib/seed-data.ts` com os dados reais.
Campos necessários por médico:
- `nome`, `crm`
- `examesHabilitados`: lista de IDs de exames que o médico realiza
- `disponibilidade`: dias da semana e horários (podendo ter múltiplos blocos por dia)

### ⚠️ Duração real dos exames (PENDENTE)
As durações em `EXAMES` são estimativas (múltiplos de 15 min).
Confirmar com a equipe clínica e atualizar `duracaoMin` de cada exame.

### ⚠️ Número de WhatsApp Business (PENDENTE)
Precisa de um número dedicado para a API (não pode ser o mesmo número do app
WhatsApp normal). Opções:
- Migrar o (32) 99995-2138 para a API (perde acesso ao app normal)
- Contratar um número virtual separado (~R$20-50/mês)

### ⚠️ Conta Meta Business verificada (PENDENTE)
Precisa completar a verificação de negócio no
[business.facebook.com](https://business.facebook.com).
Documentos exigidos: CNPJ e comprovante de endereço empresarial.

### ⚠️ Senha admin em produção (PENDENTE)
Antes do deploy, alterar a senha do usuário admin.
Opção 1: editar `store.ts` e gerar novo hash com `bcrypt.hashSync('nova-senha', 10)`.
Opção 2 (melhor): criar um usuário via script e popular diretamente no Firestore.

---

## Evoluções futuras sugeridas

- **Real-time na agenda**: trocar o polling atual por `onSnapshot` do Firestore SDK.
- **Edição de médicos/exames pela interface**: página de configurações com persistência.
- **Notificações proativas**: lembrete de exame 24h antes (mensagem utilitária do WhatsApp, ~R$0,05 por lembrete).
- **Relatórios**: dashboard de exames realizados, taxa de comparecimento, convênios mais usados.
- **Multi-usuário**: cada recepcionista com login próprio, com papel e log de ações.
- **Confirmação automática**: agente manda confirmação D-1 e atualiza status para "confirmado".
