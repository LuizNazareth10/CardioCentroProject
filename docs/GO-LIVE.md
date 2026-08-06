# Go-live — o que falta fazer fora do código

A aplicação está configurada. Restam três tarefas que dependem de contratar
serviço, provar identidade ou esperar verificação de terceiro — nenhuma delas
pode ser feita a partir do repositório.

| # | Tarefa | Tempo ativo | Espera | Bloqueia |
|---|---|---|---|---|
| 1 | Registrar `cardiocentrojf.com.br` | ~30 min | 1–24 h (DNS) | Indexação no Google, TLS da VPS |
| 2 | Criar e configurar a VPS | ~2 h | — | Agente de WhatsApp em produção |
| 3 | Google Business Profile | ~1 h | 5–14 dias | Buscas "perto de mim" |

Comece pelo **1** e pelo **3** no mesmo dia: o domínio destrava o resto, e a
verificação do Business Profile é a que tem a espera mais longa e imprevisível.

---

## 1 · Registrar o domínio

`cardiocentro.com.br` **não é da clínica** — está registrado por terceiro desde
24/06/2026. O alvo é `cardiocentrojf.com.br`, verificado livre em 06/08/2026.

### 1.1 Registrar

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

### 2.1 Contratar

Qualquer provedor serve; o porte necessário é modesto.

| Provedor | Plano | Preço aprox. |
|---|---|---|
| **Hetzner** | CX22 — 2 vCPU / 4 GB / 40 GB | ~€4/mês |
| Contabo | VPS S | ~€5/mês |
| DigitalOcean | Basic 2 GB | ~US$ 12/mês |

Escolha **Ubuntu 24.04 LTS** e cadastre sua **chave SSH pública** na criação —
não use senha. Anote o IP e volte na etapa 1.3 para preencher o registro `evo`.

> Aguarde o DNS de `evo.cardiocentrojf.com.br` resolver antes de subir a stack.
> O Caddy pede o certificado TLS na primeira subida e, se o domínio ainda não
> apontar para a máquina, a emissão falha e entra no limite de tentativas do
> Let's Encrypt. Confira com `dig +short evo.cardiocentrojf.com.br`.

### 2.2 Preparar a máquina

```bash
ssh root@SEU_IP

# usuário sem privilégio para a operação do dia a dia
adduser --disabled-password --gecos "" deploy
usermod -aG sudo deploy
rsync --archive --chown=deploy:deploy ~/.ssh /home/deploy/

# firewall: só SSH e web. A Evolution NÃO fica exposta — o Caddy publica por ela.
ufw allow OpenSSH && ufw allow 80 && ufw allow 443 && ufw --force enable

# desligar login por senha e login direto de root
sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin no/' /etc/ssh/sshd_config
sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
systemctl restart ssh

# atualizações de segurança automáticas
apt update && apt install -y unattended-upgrades && dpkg-reconfigure -f noninteractive unattended-upgrades
```

Instalar o Docker:

```bash
curl -fsSL https://get.docker.com | sh
usermod -aG docker deploy
```

**Abra uma nova sessão SSH como `deploy` e confirme que funciona antes de fechar
a sessão de root** — se algo saiu errado no SSH, essa é sua única chance de
consertar sem console de recuperação.

### 2.3 Subir a stack

```bash
ssh deploy@SEU_IP
mkdir -p ~/cardiocentro && cd ~/cardiocentro
```

Copie da sua máquina os três arquivos da pasta `deploy/`:

```bash
scp deploy/docker-compose.yml deploy/Caddyfile deploy/deploy.sh deploy@SEU_IP:~/cardiocentro/
```

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

Suba e pareie:

```bash
chmod +x deploy.sh
./deploy.sh up
./deploy.sh qr     # leia o QR no WhatsApp da clínica — só nesta primeira vez
```

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
EVOLUTION_NUMEROS_TESTE  = 5532XXXXXXXXX
```

O `EVOLUTION_WEBHOOK_SECRET` precisa ser cadastrado **também** no webhook da
instância Evolution, como header `x-evolution-secret`. Sem isso, em produção o
webhook rejeita tudo — é o comportamento fail-closed novo, e é proposital: antes,
a variável esquecida deixava o endpoint aberto sem avisar.

Redeploy na Vercel depois de salvar.

### 2.5 CI/CD

Em **GitHub → Settings → Secrets and variables → Actions**, cadastre:

| Secret | Valor |
|---|---|
| `VPS_HOST` | IP da VPS |
| `VPS_USER` | `deploy` |
| `VPS_SSH_KEY` | chave **privada** SSH com acesso ao usuário `deploy` |
| `VPS_DEPLOY_DIR` | `/home/deploy/cardiocentro` |

Com isso, mudanças em `deploy/` passam a se aplicar sozinhas, preservando os
volumes (e o pareamento).

### 2.6 Antes de considerar pronto

- [ ] `https://evo.cardiocentrojf.com.br` responde com certificado válido
- [ ] Porta 8080 **não** responde de fora: `curl http://SEU_IP:8080` deve falhar
- [ ] Mandar mensagem do número em `EVOLUTION_NUMEROS_TESTE` e receber resposta
- [ ] `docker compose restart` e confirmar que **não** pede QR de novo
- [ ] Painel em **Configurações → Rollout do agente** registrando os eventos

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
| `EVOLUTION_NUMEROS_TESTE` | allowlist do piloto, só dígitos |
| `WHATSAPP_APP_SECRET` | **[fail-closed]** se usar o canal oficial da Meta |
| `ANTHROPIC_API_KEY` | sem ela o agente cai no fallback por palavras-chave |
| `NEXT_PUBLIC_GA_ID` | opcional; só carrega após consentimento no banner |

Depois de subir tudo, confira o log de boot na Vercel: qualquer linha começando
com `❌ [env]` aponta variável faltando com o impacto descrito.
