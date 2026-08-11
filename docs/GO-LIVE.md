# Go-live — o que falta fazer fora do código

A aplicação está configurada. Restam três tarefas que dependem de contratar
serviço, provar identidade ou esperar verificação de terceiro — nenhuma delas
pode ser feita a partir do repositório.

| # | Tarefa | Tempo ativo | Espera | Bloqueia |
|---|---|---|---|---|
| 1 | Registrar `cardiocentrojf.com.br` | ~30 min | 1–24 h (DNS) | Indexação no Google, TLS da VPS |
| 2 | Criar e configurar a VPS (GCP) | ~2 h | — | Agente de WhatsApp em produção |
| 3 | Conectar o WhatsApp da clínica | ~40 min | — | Início do canary de 5% |
| 4 | Google Business Profile | ~1 h | 5–14 dias | Buscas "perto de mim" |

Comece pelo **1** e pelo **4** no mesmo dia: o domínio destrava o resto, e a
verificação do Business Profile é a que tem a espera mais longa e imprevisível.

O passo **3** — parear o WhatsApp da clínica sem derrubar os computadores da
recepção e com a IA limitada a 5% — tem roteiro próprio em
**[DIA-1-WHATSAPP.md](DIA-1-WHATSAPP.md)**.

---

## 1 · Registrar o domínio

`cardiocentro.com.br` **não é da clínica** — está registrado por terceiro desde
24/06/2026. O alvo é `cardiocentrojf.com.br`, verificado livre em 06/08/2026.

### 1.1 Registrar

**O que ter em mãos antes de abrir o site** (tudo do titular = a clínica):

| Dado | Observação |
|---|---|
| **CNPJ da clínica** | o domínio fica no CNPJ, não no seu CPF |
| **Razão social** | exatamente como na Receita — o registro.br valida contra a base |
| **CPF do responsável** | quem administra a conta (você ou o sócio administrador) |
| **E-mail da clínica** | vai receber aviso de expiração; use um que alguém lê |
| **Telefone** | (32) 3215-8744 |
| **Endereço completo + CEP** | Rua Delfim Moreira, 165 — Centro, Juiz de Fora/MG |
| **Forma de pagamento** | Pix libera em minutos; boleto leva 1–3 dias úteis |

1. Criar conta em **[registro.br](https://registro.br)**. Exige CPF ou CNPJ
   brasileiro — **registre no CNPJ da clínica**, não no seu CPF. Domínio no nome
   da pessoa errada vira um problema societário chato de desfazer depois.
2. Buscar `cardiocentrojf.com.br` e adicionar ao carrinho.
3. Pagar (~R$ 40/ano; boleto, Pix ou cartão). Pix libera em minutos.
4. Ativar a **renovação automática** e conferir se o e-mail de contato é um que
   a clínica realmente lê. Domínio que expira por e-mail esquecido derruba site
   e e-mail ao mesmo tempo.

### 1.2 Apontar para a Vercel

No painel da Vercel: **projeto `cardio-centro-project` → Settings → Domains →
Add**, e cadastre `cardiocentrojf.com.br` e `www.cardiocentrojf.com.br`.

A Vercel mostra os registros exatos a criar. Hoje são estes — **confira na tela,
os valores mudam**:

| Tipo | Nome | Valor |
|---|---|---|
| A | `@` | `76.76.21.21` |
| CNAME | `www` | `cname.vercel-dns.com` |

No registro.br isso fica em **Painel → seu domínio → DNS → Editar zona**.

Deixe a Vercel redirecionar `www` para o domínio raiz (ou o contrário — o que
importa é escolher **um** como oficial e redirecionar o outro; servir os dois
divide o sinal de SEO entre duas URLs).

### 1.3 Registro extra para a VPS

Aproveite e já crie o subdomínio da Evolution, que a etapa 2 vai usar:

| Tipo | Nome | Valor |
|---|---|---|
| A | `evo` | *(IP da VPS — preencher na etapa 2.1)* |

### 1.4 Fechar o ciclo na aplicação

Na Vercel, **Settings → Environment Variables**, defina:

```
APP_BASE_URL = https://cardiocentrojf.com.br
```

Sem barra no fim. Depois **redeploy** — variável nova só vale a partir do
próximo build. É essa variável que corrige a tag canônica, o sitemap e o Open
Graph de uma vez.

### 1.5 Conferir

```bash
curl -s https://cardiocentrojf.com.br | grep canonical
# esperado: <link rel="canonical" href="https://cardiocentrojf.com.br"/>

curl -s https://cardiocentrojf.com.br/sitemap.xml
# as URLs devem ser do domínio novo, não de cardio-centro-project.vercel.app
```

Se a canônica ainda mostrar o domínio antigo, `APP_BASE_URL` não subiu — o log
de boot vai ter uma linha `❌ [seo] APP_BASE_URL não definida`.

### 1.6 Google Search Console

Feito o acima, cadastre o site em
**[search.google.com/search-console](https://search.google.com/search-console)**:
adicione a propriedade por domínio, valide com o registro TXT que ele indicar
(no registro.br, mesma tela de DNS) e envie
`https://cardiocentrojf.com.br/sitemap.xml`. É assim que se acompanha se o
Google está de fato indexando — sem isso, você fica no escuro.

---

## 2 · Criar e configurar a VPS

O que sobe aqui é **só a Evolution API** (a ponte do WhatsApp). O agente em si
roda na Vercel e continua atualizando por `git push` — a VPS não é tocada nesses
deploys.

### 2.1 Criar a VM no GCP

Você já tem o projeto **`cardiocentro-pipeline`** com faturamento ativo (é onde
mora o Firestore), então a VM entra na mesma fatura e no mesmo IAM.

E dá para rodar de **graça**: o *Always Free* da GCP inclui 1 `e2-micro` por
mês, e a stack foi dimensionada para caber nele.

| | vCPU / RAM | Custo |
|---|---|---|
| **e2-micro · us-east1** (esta receita) | 2 burst / **1 GB** | **US$ 0** |
| e2-small · us-east1 | 2 / 2 GB | ~US$ 12/mês |
| e2-small · São Paulo | 2 / 2 GB | ~US$ 19/mês |

**Por que `us-east1` (Carolina do Sul)?** O free tier só vale em `us-west1`,
`us-central1` e `us-east1` — São Paulo não entra. Das três, `us-east1` é a mais
perto do Brasil. O custo disso é ~120 ms a mais no salto VPS → Vercel (que roda
em `gru1`), duas vezes por mensagem. Contra os 2–4 s da chamada de IA, é ruído:
~5% do tempo total de resposta.

**As três pegadinhas que fazem o "grátis" virar cobrança** — todas já tratadas
nos comandos abaixo:

1. Disco **`pd-standard`**, no máximo 30 GB. `pd-balanced` ou SSD **são
   cobrados** (era o erro da versão anterior deste documento).
2. **Network tier `STANDARD`**. O Premium (padrão) cobra egresso por outra
   tabela.
3. Só **1 GB de egresso/mês** da América do Norte. Texto não chega perto; foto
   de exame que o paciente manda, sim (~2 MB cada, ~500/mês no limite). Passar
   disso custa ~US$ 0,12/GB — irrelevante, mas não é zero.

```bash
gcloud config set project cardiocentro-pipeline

# IP estático em tier STANDARD — sem isso o IP muda a cada restart e o DNS
# (e o certificado TLS) quebram junto.
gcloud compute addresses create evolution-ip \
  --region=us-east1 \
  --network-tier=STANDARD

gcloud compute instances create evolution-vps \
  --zone=us-east1-b \
  --machine-type=e2-micro \
  --image-family=ubuntu-2404-lts-amd64 \
  --image-project=ubuntu-os-cloud \
  --boot-disk-size=30GB \
  --boot-disk-type=pd-standard \
  --network-tier=STANDARD \
  --address=evolution-ip \
  --tags=evolution-web

# firewall: só 80/443 entram. A Evolution (8080) NÃO fica exposta —
# quem publica para a internet é o Caddy, com TLS.
gcloud compute firewall-rules create evolution-web \
  --allow=tcp:80,tcp:443 \
  --target-tags=evolution-web \
  --source-ranges=0.0.0.0/0
```

Pegue o IP e volte na etapa 1.3 para preencher o registro `evo`:

```bash
gcloud compute addresses describe evolution-ip --region=us-east1 --format='value(address)'
```

> **Confira a primeira fatura.** O free tier é um crédito aplicado por uso, não
> um bloqueio: se algum parâmetro escapar (disco balanced, tier Premium), a GCP
> cobra em silêncio. Vale criar um **orçamento com alerta em US$ 1** em
> *Billing → Budgets & alerts* — leva 2 minutos e você descobre no primeiro dia,
> não no fim do mês.

### 2.1.1 Se 1 GB apertar

A stack foi enxugada para caber (sem Redis, Postgres com `shared_buffers=32MB`,
tetos de memória por container — ver `deploy/docker-compose.yml`). O consumo
esperado é ~600–700 MB dos ~960 MB úteis, com 2 GB de swap de rede de segurança.

Se ainda assim faltar memória (`docker stats` encostando nos limites, ou a
Evolution reiniciando sozinha), subir de máquina é um comando **sem perder o
pareamento** — os volumes ficam no disco:

```bash
gcloud compute instances stop evolution-vps --zone=us-east1-b
gcloud compute instances set-machine-type evolution-vps --zone=us-east1-b --machine-type=e2-small
gcloud compute instances start evolution-vps --zone=us-east1-b
```

A partir daí são ~US$ 12/mês — e a máquina sai do free tier.

> **Aguarde o DNS de `evo.cardiocentrojf.com.br` resolver antes de subir a
> stack.** O Caddy pede o certificado TLS na primeira subida e, se o domínio
> ainda não apontar para a máquina, a emissão falha e entra no limite de
> tentativas do Let's Encrypt (5 falhas/hora — depois você espera de castigo).
> Confira com `dig +short evo.cardiocentrojf.com.br`.

### 2.2 Preparar a máquina

Na GCP o SSH já vem por chave, gerenciado pelo gcloud — não há senha para
desligar nem usuário root para bloquear. Entre com:

```bash
gcloud compute ssh evolution-vps --zone=us-east1-b
```

O usuário que o gcloud cria já é sudo e sem senha. Use ele como o `deploy` do
roteiro genérico — não precisa criar outro:

```bash
# swap: rede de segurança da e2-micro (1 GB de RAM) — NÃO é opcional aqui
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile
sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# firewall do SO, além do da GCP (defesa em profundidade)
sudo ufw allow OpenSSH && sudo ufw allow 80 && sudo ufw allow 443 && sudo ufw --force enable

# atualizações de segurança automáticas + ferramentas do deploy.sh
# (jq monta o payload do webhook; qrencode desenha o QR de pareamento)
sudo apt update && sudo apt install -y unattended-upgrades jq qrencode
sudo dpkg-reconfigure -f noninteractive unattended-upgrades

# Docker
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
```

Saia e entre de novo (`exit`, depois o mesmo `gcloud compute ssh`) para o grupo
`docker` valer. Confirme com `docker ps` — se pedir sudo, o grupo não pegou.

### 2.3 Subir a stack

Copie da sua máquina os três arquivos da pasta `deploy/`:

```bash
gcloud compute scp deploy/docker-compose.yml deploy/Caddyfile deploy/deploy.sh \
  evolution-vps:~/cardiocentro/ --zone=us-east1-b
```

Se a pasta ainda não existir, crie antes pelo SSH: `mkdir -p ~/cardiocentro`.

Na VPS, crie o `.env` (a partir de `deploy/.env.example`):

```bash
cat > ~/cardiocentro/.env <<'EOF'
EVOLUTION_DOMINIO=evo.cardiocentrojf.com.br
SERVER_URL=https://evo.cardiocentrojf.com.br
EVOLUTION_API_KEY=<gere: openssl rand -hex 32>
POSTGRES_PASSWORD=<gere: openssl rand -hex 24>
WEBHOOK_URL=https://cardiocentrojf.com.br/api/whatsapp/evolution/webhook
EOF
chmod 600 ~/cardiocentro/.env
```

Suba a stack:

```bash
chmod +x deploy.sh
./deploy.sh up
```

> **Não leia o QR ainda.** Parear é o momento em que a IA passa a ver as
> conversas reais da clínica — só faça isso depois de confirmar o canary e
> avisar a recepção. O passo a passo está em
> [DIA-1-WHATSAPP.md](DIA-1-WHATSAPP.md).

Confirme o TLS:

```bash
curl -sI https://evo.cardiocentrojf.com.br | head -1   # esperado: HTTP/2 200
```

> **A regra de ouro:** nunca rode `docker compose down -v` nesta máquina. O `-v`
> apaga os volumes, e com eles a sessão do WhatsApp — obrigando a ler o QR de
> novo. O `deploy.sh` foi escrito para nunca usar essa flag.

### 2.4 Ligar na aplicação

Na Vercel, **Settings → Environment Variables**:

```
EVOLUTION_API_URL        = https://evo.cardiocentrojf.com.br
EVOLUTION_API_KEY        = <o mesmo valor do .env da VPS>
EVOLUTION_INSTANCE       = <nome da instância criada no pareamento>
EVOLUTION_WEBHOOK_SECRET = <gere: openssl rand -hex 32>
AGENTE_MODO              = canary
AGENTE_CANARY_PCT        = 5
```

E **apague `EVOLUTION_NUMEROS_TESTE`** — com ela preenchida o canal fica em modo
piloto e só os números da lista são atendidos. Vazia, o canal abre e quem passa a
segurar o volume é o canary. Detalhes em [DIA-1-WHATSAPP.md](DIA-1-WHATSAPP.md).

> `AGENTE_MODO`/`AGENTE_CANARY_PCT` são só o **piso**: o valor salvo em
> Configurações (Firestore) tem prioridade. Confirme o que está valendo de
> verdade com `npm run rollout` antes de parear.

O `EVOLUTION_WEBHOOK_SECRET` precisa ser cadastrado **também** no webhook da
instância Evolution, como header `x-evolution-secret`. Sem isso, em produção o
webhook rejeita tudo — é o comportamento fail-closed novo, e é proposital: antes,
a variável esquecida deixava o endpoint aberto sem avisar.

Redeploy na Vercel depois de salvar.

### 2.5 CI/CD

Em **GitHub → Settings → Secrets and variables → Actions**, cadastre:

| Secret | Valor |
|---|---|
| `VPS_HOST` | IP estático da VM (etapa 2.1) |
| `VPS_USER` | o usuário do `gcloud compute ssh` (rode `whoami` na VM) |
| `VPS_SSH_KEY` | conteúdo de `~/.ssh/google_compute_engine` (chave **privada**) |
| `VPS_DEPLOY_DIR` | `/home/<esse usuário>/cardiocentro` |

O `gcloud compute ssh` gera esse par de chaves na primeira conexão e registra a
pública no projeto — é ela que o GitHub Actions reusa.

Com isso, mudanças em `deploy/` passam a se aplicar sozinhas, preservando os
volumes (e o pareamento).

### 2.6 Antes de considerar pronto

- [ ] `https://evo.cardiocentrojf.com.br` responde com certificado válido
- [ ] Porta 8080 **não** responde de fora: `curl http://SEU_IP:8080` deve falhar
- [ ] `npm run rollout` mostra `canary 5%` (e não `full`)
- [ ] `docker compose restart` e confirmar que **não** pede QR de novo
- [ ] Painel em **Configurações → Rollout do agente** registrando os eventos
- [ ] `free -h` mostra o swap ativo (2 GB) e `docker stats` com folga nos limites
- [ ] Orçamento com alerta em US$ 1 criado em *Billing → Budgets & alerts*

---

## 3 · Google Business Profile

Esta é a maior alavanca de agendamentos novos, e não depende de nada no código.
Buscas como "cardiologista perto de mim" mostram primeiro o bloco de mapa — três
fichas, acima de qualquer resultado orgânico.

### 3.1 Verificar se a ficha já existe

Muita clínica antiga já tem ficha criada automaticamente pelo Google, sem dono.
Busque `Cardiocentro Juiz de Fora` no Google Maps antes de criar qualquer coisa.

- **Existe e diz "Reivindicar este estabelecimento"** → reivindique. É o melhor
  caso: avaliações e histórico já acumulados vêm junto.
- **Existe com outro dono** → em [business.google.com](https://business.google.com)
  peça acesso; o Google notifica quem controla hoje.
- **Não existe** → crie do zero.

### 3.2 Preencher

Em [business.google.com](https://business.google.com):

- **Nome:** `Cardiocentro — Métodos Diagnósticos em Cardiologia`.
  Exatamente como aparece na fachada. Enfiar palavra-chave no nome
  ("Cardiocentro Cardiologista Juiz de Fora") é violação e pode suspender a ficha.
- **Categoria principal:** `Cardiologista`.
  **Secundárias:** `Clínica médica`, `Serviço de exames diagnósticos`.
  A principal é a que mais pesa — não desperdice numa genérica.
- **Endereço:** Rua Delfim Moreira, 165 — Centro, Juiz de Fora — MG.
  Depois arraste o pino no mapa até a porta certa.
- **Telefone:** (32) 3215-8744 · **Site:** `https://cardiocentrojf.com.br`
- **Horário:** seg–qui 08h–18h, sex 08h–17h, sáb e dom fechado.

### 3.3 Verificação

O Google pede prova de que o negócio existe — por cartão postal, telefone,
e-mail ou vídeo. **Peça vídeo se oferecerem:** resolve em dias, enquanto o
postal leva de 5 a 14 dias e às vezes se perde.

No vídeo, mostre em uma tomada contínua: a fachada com a placa, a entrada, a
recepção e algum equipamento. É o que comprova que o endereço é real.

> Não edite a ficha enquanto a verificação estiver pendente — mudança nesse
> intervalo costuma reiniciar o processo.

### 3.4 Depois de verificada

- **Serviços:** cadastre cada exame separadamente — Ecocardiograma, Holter 24h,
  MAPA 24h, Teste ergométrico, Teste cardiopulmonar. São exatamente os termos
  que as pessoas digitam, e cada um vira uma porta de entrada.
- **Fotos:** fachada, recepção, salas, equipamentos, equipe. Fichas com foto
  recebem bem mais cliques. Suba algumas por mês em vez de tudo de uma vez.
- **Convênios:** liste na descrição — "atende Unimed, e mais de 20 convênios"
  responde à dúvida que trava a maioria das ligações.
- **Avaliações:** o fator mais forte depois de proximidade e categoria. Peça de
  forma sistemática — o WhatsApp da clínica já fala com o paciente no dia
  seguinte ao exame; incluir o link curto de avaliação nessa mensagem transforma
  isso num fluxo contínuo em vez de um esforço pontual.
  Responda **todas**, inclusive as negativas: resposta pública educada vale mais
  para quem está lendo do que para quem reclamou.
- **Perguntas e respostas:** você mesmo pode publicar as dúvidas mais comuns
  (preparo do exame, o que levar, se precisa de pedido médico) já respondidas.

### 3.5 Coerência com o site

O Google cruza os dados da ficha com os do site. Nome, endereço e telefone
precisam bater **caractere a caractere** entre a ficha, o rodapé do site e o
JSON-LD em `src/app/page.tsx`. Divergência enfraquece a associação entre os dois.

Aproveite e preencha `GEO_CLINICA` em `src/lib/seed-data.ts` — está como `null`
justamente para não chutar coordenada. Com a ficha pronta, clique com o botão
direito sobre o pino no Google Maps e copie o par de coordenadas.

---

## Checklist final de variáveis na Vercel

As marcadas **[fail-closed]** derrubam o serviço correspondente se faltarem —
por escolha de projeto, para não rodar desprotegido em silêncio.

| Variável | Observação |
|---|---|
| `APP_BASE_URL` | `https://cardiocentrojf.com.br` — sem ela o site não indexa |
| `AUTH_SECRET` | **[fail-closed]** `openssl rand -base64 32` |
| `DATA_BACKEND` | **[fail-closed]** precisa ser `firestore` |
| `GCP_PROJECT_ID` | `cardiocentro-pipeline` |
| `GOOGLE_SERVICE_ACCOUNT_B64` | **chave NOVA**, gerada após a revogação da que vazou |
| `CRON_SECRET` | **[fail-closed]** senão os lembretes não são enviados |
| `EVOLUTION_WEBHOOK_SECRET` | **[fail-closed]** e o mesmo valor no webhook da instância |
| `EVOLUTION_API_URL` · `_API_KEY` · `_INSTANCE` | ver etapa 2.4 |
| `EVOLUTION_NUMEROS_TESTE` | **apagar** para abrir o canal; preenchida = modo piloto |
| `AGENTE_MODO` · `AGENTE_CANARY_PCT` | `canary` · `5` — piso; a tela tem prioridade |
| `WHATSAPP_APP_SECRET` | **[fail-closed]** se usar o canal oficial da Meta |
| `ANTHROPIC_API_KEY` | sem ela o agente cai no fallback por palavras-chave |
| `NEXT_PUBLIC_GA_ID` | opcional; só carrega após consentimento no banner |

Depois de subir tudo, confira o log de boot na Vercel: qualquer linha começando
com `❌ [env]` aponta variável faltando com o impacto descrito.
