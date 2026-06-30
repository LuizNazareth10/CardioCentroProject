# Estimativa de custos — Sistema CardioCentro

> Valores verificados nas páginas oficiais de preços em **junho de 2026**.
> Câmbio usado como referência: ~R$ 5,50/US$ (varia; ajuste conforme o dia).

## Resumo executivo

| Item | Plano | Custo mensal estimado |
|------|-------|----------------------|
| **Vercel** (hospedagem do app) | Pro (uso comercial) | **~US$ 20 (~R$ 110)** |
| **GCP Firestore** (banco de dados) | Free tier | **~R$ 0** |
| **WhatsApp Cloud API** (conversas reativas) | Direto com a Meta | **~R$ 0** |
| **WhatsApp — lembretes proativos** (opcional) | Mensagem utilitária | **~R$ 0,05 por lembrete** |
| **Anthropic API** (IA do agente, modelo Haiku) | Pay-as-you-go | **poucos reais/mês** |
| **Domínio próprio** (opcional) | — | ~R$ 40–60/ano |
| | **TOTAL** | **≈ R$ 110–160/mês** |

O custo é **dominado pela assinatura da Vercel**. Toda a parte de dados e de
conversas de WhatsApp fica essencialmente **gratuita** no volume de uma clínica
pequena/média.

---

## 1. Banco de dados — GCP Firestore (≈ R$ 0)

Firestore (edição Standard) tem **cota gratuita diária**:
- 50.000 leituras/dia (~1,5 milhão/mês)
- 20.000 escritas/dia (~600 mil/mês)
- 20.000 exclusões/dia
- 1 GB de armazenamento

Uma clínica com, digamos, 40 exames/dia + recepção navegando na agenda gera, na
pior das hipóteses, alguns milhares de operações por dia — **muito abaixo** da
cota gratuita. Acima da cota (cenário improvável aqui), os preços são:
- Leituras: US$ 0,06 por 100.000
- Escritas: US$ 0,18 por 100.000
- Armazenamento: ~US$ 0,18/GB/mês

➡️ **Conclusão: praticamente R$ 0/mês.** Foi por isso que o Firestore foi
escolhido em vez de um Postgres gerenciado (Cloud SQL), que custaria a partir de
~US$ 9–25/mês mesmo ocioso.

## 2. Hospedagem do app — Vercel (~US$ 20/mês)

- **Hobby (grátis)**: não pode ser usado comercialmente pelos termos da Vercel.
- **Pro**: US$ 20/usuário/mês, inclui 1 TB de banda e 10 milhões de *edge
  requests* — folgado para o tráfego interno de uma clínica + o webhook do
  WhatsApp. O uso fica dentro do incluso, então o custo é o da assinatura.

### Alternativa para zerar este custo
Hospedar o app no próprio **GCP Cloud Run** (free tier generoso: 2 milhões de
requisições/mês) deixaria tudo numa nuvem só e o custo cairia para perto de
**R$ 0**. A troca é um deploy um pouco menos automático que o da Vercel. Veja
`DEPLOY.md` para essa opção.

## 3. WhatsApp — Meta Cloud API (≈ R$ 0 no uso reativo)

Mudança importante na política da Meta (vigente):
- **Conversas de atendimento (service) iniciadas pelo paciente são gratuitas.**
- Toda resposta em **texto livre / botões / listas dentro da janela de 24h** após
  a última mensagem do paciente é **gratuita**.

Como o nosso agente é **reativo** (o paciente manda "oi" e inicia a conversa),
**todas as mensagens do fluxo de agendamento são gratuitas**. Não há markup de
intermediário porque a integração é **direta com a Meta** (Cloud API), sem BSP.

Só há custo se a clínica quiser **enviar mensagens proativas fora da janela**
(ex.: lembrete "seu exame é amanhã às 9h"). Aí entra a tarifa de mensagem
**utilitária no Brasil ≈ R$ 0,05** cada. Mesmo enviando 1.000 lembretes/mês,
seriam ~R$ 50.

Custos únicos (não mensais): verificação da conta Meta Business (gratuita) e um
número de telefone dedicado ao WhatsApp Business.

## 4. IA do agente — Anthropic API (poucos reais/mês)

A IA (modelo **Claude Haiku**, barato) só é chamada quando o paciente escreve em
**texto livre** que os menus não resolvem. A maioria das interações usa os botões
e nem aciona a IA. No volume de uma clínica, o gasto fica em **centavos a poucos
reais por mês**. Pode-se até desligar a IA (o agente continua funcionando só com
menus) zerando este item.

## 5. Itens opcionais
- **Domínio próprio** (ex.: agenda.cardiocentro.com.br): ~R$ 40–60/ano.
- **Backup/export** do Firestore para o Cloud Storage: centavos/mês.

---

## Cenário realista para a CardioCentro

Assumindo ~40 atendimentos/dia, agenda consultada o dia todo, agente de WhatsApp
reativo e **sem** campanhas de marketing:

- Vercel Pro: **R$ 110**
- Firestore: **R$ 0**
- WhatsApp (reativo): **R$ 0**
- IA Haiku: **~R$ 5**
- **Total: ~R$ 115/mês** (ou **~R$ 5–10/mês** se hospedar no Cloud Run em vez da Vercel)

> Observação: estes números são estimativas de boa fé baseadas nos preços
> públicos de junho/2026. Preços de nuvem mudam; reveja antes de fechar contrato.
