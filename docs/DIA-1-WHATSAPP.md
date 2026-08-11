# Dia 1 — conectar o WhatsApp da clínica com o canary em 5%

Roteiro do dia em que a IA passa a falar com paciente de verdade. O objetivo é
que **95% do atendimento continue exatamente como hoje** e que os computadores
da recepção não parem em nenhum momento.

Pré-requisito: a VPS já no ar com TLS válido (etapas 2.1–2.3 do
[GO-LIVE.md](GO-LIVE.md)), mas **sem ter lido o QR ainda**.

---

## 1 · Como o WhatsApp da clínica funciona hoje

Isso responde a dúvida central: *"a clínica tem um celular e vários computadores
no mesmo WhatsApp — preciso configurar só o celular?"*

**Sim, só o celular** — mas com uma ressalva que decide o dia.

O WhatsApp é **1 celular principal + até 4 dispositivos vinculados**. Os
computadores da recepção são dispositivos vinculados (WhatsApp Web/Desktop). A
Evolution API entra como **mais um dispositivo vinculado** — o quinto na fila,
usando o mesmo mecanismo do WhatsApp Web.

```
        📱 celular da clínica  (principal — nunca é desconectado)
                 │
    ┌────────────┼────────────┬────────────┬────────────┐
    │            │            │            │            │
  💻 PC 1     💻 PC 2      💻 PC 3      💻 PC 4    🤖 Evolution
  ─────────── vinculados: no máximo 4 no total ───────────
```

Três consequências práticas:

1. **A recepção continua vendo 100% das conversas.** A Evolution não "assume" o
   número — ela é só mais uma tela conectada. Inclusive as respostas que a IA
   mandar aparecem no celular e em todos os PCs, como se a recepção tivesse
   digitado.
2. **Só o celular lê o QR.** Os computadores não são tocados, não precisam ser
   reconfigurados e não caem.
3. **Se os 4 slots já estiverem ocupados, você precisa liberar um** — senão o
   pareamento derruba um PC da recepção no meio do expediente.

### 1.1 Antes de qualquer coisa: conte os dispositivos

No **celular da clínica**: `WhatsApp → Configurações → Dispositivos conectados`.

- **3 ou menos** → tudo certo, siga em frente.
- **4 (lotado)** → desconecte o menos usado **agora**, com a recepção sabendo.
  Costuma haver um PC antigo ou um celular de ex-funcionário ali. Se todos os 4
  estiverem em uso real, a saída é o **Meta Verified** (eleva para 10
  dispositivos) ou migrar para a API oficial da Meta.

> Dispositivo vinculado **cai sozinho após ~14 dias sem o celular abrir o
> WhatsApp**. O celular da clínica precisa ficar ligado, com internet e com o
> WhatsApp instalado — se ele passar semanas desligado numa gaveta, a Evolution
> se desconecta e o QR terá que ser lido de novo.

---

## 2 · Travar o canary ANTES de parear

Esta é a ordem que importa. Parear primeiro e configurar depois deixa uma janela
em que a IA pode atender 100% dos pacientes.

### 2.1 Limpar o que era teste

Na Vercel, **Settings → Environment Variables**:

- **Apague `EVOLUTION_NUMEROS_TESTE`.** Enquanto ela existir, o canal fica em
  *modo piloto*: só os números da lista são atendidos e o canary nem é
  consultado. Vazia, o canal abre e o rollout passa a mandar.
- Defina `AGENTE_MODO = canary` e `AGENTE_CANARY_PCT = 5`.

Depois, **Redeploy** — variável nova só vale a partir do próximo build.

### 2.2 Confirmar o que está valendo de verdade

O valor salvo na tela de Configurações fica no Firestore e **tem prioridade
sobre as variáveis de ambiente**. Um `full` esquecido lá de um teste antigo
continuaria valendo mesmo com `AGENTE_MODO=canary` na Vercel.

```bash
npm run rollout
```

Leia a linha `→ Vale o ...`. Se não for `canary 5%`, fixe:

```bash
npm run rollout canary 5
```

Rode `npm run rollout` de novo e confirme. **Não avance enquanto não estiver
escrito `canary 5%`.**

### 2.3 Conferir também o interruptor geral

Na mesma saída, se aparecer `agente.ativo=false`, o agente está em modo manual e
**nada** será atendido — toda mensagem vai para a fila humana. É um interruptor
diferente do rollout. Ligue em **Configurações → Agente de WhatsApp**.

---

## 3 · Parear (ler o QR)

Faça em **horário de baixo movimento** — começo da manhã, antes de abrir, é o
ideal. Com a recepção avisada.

```bash
gcloud compute ssh evolution-vps --zone=us-east1-b
cd ~/cardiocentro
./deploy.sh qr
```

No **celular da clínica**: `Configurações → Dispositivos conectados → Conectar
dispositivo` e aponte para o QR no terminal.

> O QR expira em ~40 segundos. Se perder, rode `./deploy.sh qr` de novo.

Confirme que conectou:

```bash
./deploy.sh status
```

E no celular, a Evolution deve aparecer na lista de dispositivos conectados.

### 3.1 Cadastrar o webhook com o segredo

**Não pule este passo** — é a causa mais provável de "conectou mas o agente não
responde nada".

O `docker-compose.yml` entrega a URL do webhook, mas não manda header nenhum. O
app na Vercel exige o header `x-evolution-secret` e, sem ele, responde **401 a
todas as mensagens** — em silêncio, do lado da Evolution.

Com `EVOLUTION_WEBHOOK_SECRET` preenchido no `deploy/.env` (o **mesmo** valor da
Vercel):

```bash
./deploy.sh webhook
```

Confira nos logs da Vercel que as chamadas passaram a responder 200.

### 3.2 O que NÃO vai acontecer (e por quê)

Ao parear, a Evolution sincroniza o histórico do aparelho. Sem proteção, isso
faria o agente responder de uma vez a semanas de conversas antigas já tratadas
pela recepção — na frente de centenas de pacientes.

O webhook descarta mensagens com mais de **10 minutos**
(`EVOLUTION_JANELA_FRESCOR_MIN`). Nos logs da Vercel você vai ver várias linhas
`ignorado: mensagem fora da janela de frescor` logo após o pareamento. **É o
comportamento correto** — é a proteção funcionando.

---

## 4 · Validar com uma mensagem real

Mande uma mensagem de um celular **seu** para o WhatsApp da clínica.

Só que agora você é um paciente comum: seu número tem ~5% de chance de cair na
IA. Para saber de que lado você caiu sem ficar adivinhando, olhe o painel em
**Configurações → Rollout do agente** — cada mensagem que a IA tocou aparece no
feed com o bucket e o motivo.

Se quiser garantir uma resposta da IA para conferir o fluxo ponta a ponta, suba
o canary por dois minutos e volte:

```bash
npm run rollout canary 100   # só para o teste
# … manda a mensagem, confere a resposta …
npm run rollout canary 5     # VOLTA IMEDIATAMENTE
```

Vale nas próximas mensagens, sem redeploy. **Não esqueça de voltar para 5.**

---

## 5 · O que a recepção precisa saber

Combine isso com a equipe **antes** de parear. É a parte que mais dá errado, e
não é técnica.

1. **Algumas conversas vão ser respondidas sozinhas.** Cerca de 1 em cada 20.
   As respostas aparecem no celular e nos PCs como se a clínica tivesse
   digitado — porque, do ponto de vista do WhatsApp, foi.
2. **Não responder por cima.** Se a conversa já tem resposta automática, deixe
   a IA seguir. Duas respostas diferentes para o mesmo paciente é o pior
   resultado possível.
3. **Quando assumir:** se o paciente pedir atendente, se ficar confuso, ou se
   for reclamação/urgência, o agente já transborda sozinho para a fila em
   `/atendimentos`. A recepção pode assumir a qualquer momento — basta
   responder; o agente para naquela conversa.
4. **Como saber se é o robô:** a mesma pessoa é *sempre* IA ou *sempre* humano
   (o sorteio é fixo por número). Não alterna no meio da conversa.
5. **Se algo der errado:** avise imediatamente. O kill-switch é 1 clique.

---

## 6 · Botão de pânico

Qualquer susto, em ordem de preferência:

| Situação | Ação | Efeito |
|---|---|---|
| Resposta ruim, mas pontual | **Configurações → paused** | IA para; tudo volta para a recepção |
| Sem acesso ao painel | `npm run rollout paused` | idem, pelo terminal |
| Quer parar o canal inteiro | Desconectar a Evolution no celular | volta ao WhatsApp de sempre |

`paused` com o canal aberto é **silêncio total** — não há allowlist para poupar
ninguém. Nada é perdido: as conversas continuam chegando normalmente no celular
e nos PCs, só sem resposta automática.

Para religar: `npm run rollout canary 5`.

---

## 7 · A semana

| Dia | Ação | O que observar |
|---|---|---|
| 1 (amanhã) | parear + canary 5% | painel de monitoramento a cada 2 h; zero erro? |
| 2–3 | manter 5% | ler as conversas que a IA atendeu, ponta a ponta |
| 4–5 | 10% se estiver limpo | taxa de transbordo para humano |
| Semana 2 | 25% → 50% | tempo de resposta, agendamentos concluídos |
| Semana 3+ | 100% | só depois de uma semana inteira sem susto |

Subir o percentual **nunca tira** um paciente da IA que já estava nela — o
rollout é monotônico (há teste para isso em `npm run test:rollout`). Quem estava
com a recepção pode passar para a IA ao subir; o contrário não acontece.

---

## 8 · O risco que continua sendo seu

Rodar a **Evolution (API não-oficial)** no **número principal** da clínica
contraria os termos do WhatsApp e tem risco de **banimento do número** — e o
estrago seria a linha inteira, não os 5%. O canary limita o risco de *resposta
ruim*, não o de ban.

As duas saídas, se isso preocupar:

- **Número dedicado** para o piloto (um chip novo), mantendo o principal intacto.
- **API oficial da Meta Cloud** — já implementada no projeto, com a mesma
  lógica de modos e percentual. Custa por conversa e exige verificação do
  negócio, mas não tem risco de ban.

É uma decisão de negócio, não técnica. Só não vale tomá-la sem saber que existe.
