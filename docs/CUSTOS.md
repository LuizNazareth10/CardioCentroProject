# Estimativa de custos — Sistema CardioCentro

> ⚠️ **Sistema SUSPENSO desde 17/08/2026** — ver [`SUSPENSAO.md`](SUSPENSAO.md).
> Só a landing page continua no ar. As seções 1 a 5 abaixo descrevem o custo
> da operação **completa**, para quando ela voltar.

> O corpo original deste documento é de **junho/2026** e era uma estimativa
> feita a partir de tabelas públicas. Os números do quadro abaixo foram
> **conferidos na Cloud Billing Catalog API em 17/08/2026** e substituem as
> estimativas onde houver divergência.
> Câmbio de referência: ~R$ 5,50/US$ (varia; ajuste conforme o dia).

## Resumo executivo — verificado em 17/08/2026

| Item | Situação real | Custo mensal |
|------|---------------|--------------|
| **Vercel** (hospedagem) | ⚠️ plano **não confirmado** — ver nota abaixo | **US$ 0 ou 20** |
| **GCP — VM `evolution-vps`** (e2-micro, us-east1) | dentro do free tier | **US$ 0** |
| **GCP — disco 30 GB pd-standard** | free tier cobre 30 GiB/mês | **US$ 0** |
| **GCP — IP externo** | grátis enquanto anexado a VM ligada (744 h/mês) | **US$ 0** |
| **GCP Firestore** | muito abaixo da cota gratuita | **US$ 0** |
| **WhatsApp Cloud API** (reativo) | direto com a Meta, sem BSP | **US$ 0** |
| **Anthropic API** (Haiku/Sonnet) | pay-as-you-go, só em texto livre | **poucos US$** |
| **Domínio próprio** | anual | ~R$ 40–60/ano |

**Conclusão que mudou em relação à versão de junho:** a infraestrutura de
nuvem inteira — VM da Evolution API inclusive, que nem existia quando este
documento foi escrito — cabe no **free tier da GCP** e custa **US$ 0**. O
único gasto recorrente possível é a **Vercel**.

### ⚠️ Sobre o plano da Vercel

A versão de junho deste documento **assumiu** o plano Pro (US$ 20/mês) por
causa da cláusula de uso comercial dos termos da Vercel. Isso nunca foi
verificado na conta. Para conferir de fato:

```bash
npx vercel login
curl -H "Authorization: Bearer $TOKEN" \
  "https://api.vercel.com/v2/teams/team_QuRNB4KIhHrZEZpjXnkJuNTU" \
  | jq '.billing.plan'
```

Se a resposta for `"hobby"`, o custo real de nuvem do projeto é **R$ 0/mês** —
com a ressalva de que os termos da Vercel restringem o plano Hobby a uso não
comercial, e um site de clínica se enquadra como comercial.

### 🪤 Armadilha do IP estático

Um IP externo é **grátis enquanto anexado a uma VM ligada** (744 h/mês
cobertas), mas custa **US$ 0,01/h ≈ US$ 7,44/mês** quando fica **reservado e
ocioso** — inclusive quando está preso a uma VM *parada*.

Consequência prática: **desligar a VM sem liberar o IP AUMENTA a fatura.** Foi
por isso que a suspensão de agosto liberou a reserva `evolution-ip` em vez de
apenas parar a máquina.

SKUs conferidos (serviço `6F81-5844-456A`, Compute Engine):
- `Static Ip Charge` — 1ª hora grátis, depois US$ 0,01/h
- `External IP Charge on a Standard VM` — 744 h grátis, depois US$ 0,005/h
- `Storage PD Capacity` — 30 GiB/mês grátis, depois US$ 0,04/GiB

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

- Vercel Pro: **R$ 110** — ⚠️ *supondo Pro; não confirmado, ver o resumo executivo*
- Firestore: **R$ 0**
- WhatsApp (reativo): **R$ 0**
- IA Haiku: **~R$ 5**
- **Total: ~R$ 115/mês** (ou **~R$ 5–10/mês** se hospedar no Cloud Run em vez da Vercel)

> Atualização de 17/08/2026: a VPS da Evolution API, criada depois desta
> estimativa, **não** somou custo — e2-micro em `us-east1`, disco de 30 GB e
> IP anexado cabem inteiros no free tier da GCP.

> Observação: estes números são estimativas de boa fé baseadas nos preços
> públicos de junho/2026. Preços de nuvem mudam; reveja antes de fechar contrato.
