# ESTRATEGIA-TRAFEGO-PAGO.md — Cardiocentro JF

> Estratégia end-to-end de aquisição para a Cardiocentro (Juiz de Fora — MG). Valores em R$/mês. **Toda peça deve respeitar a Resolução CFM 2.336/2023**: sem promessa de resultado ou prazo de laudo, sem "antes/depois", sem depoimento de paciente sem autorização expressa, sem sensacionalismo/apelo ao medo, e anúncios identificando a clínica e o diretor técnico (nome + CRM — preencher os CRMs em `seed-data.ts` antes de veicular).

## 1. Diagnóstico e posicionamento

**Público-alvo primário:** 45–70 anos, Juiz de Fora e microrregião (Matias Barbosa, Santos Dumont, Bicas, Juiz de Fora rural), com convênio (Unimed, IPSEMG, CASSI, CEMIG Saúde, Bradesco, SulAmérica…) ou particular; motivadores: pedido médico em mãos, histórico familiar, check-up pré-cirúrgico, início de atividade física. **Público secundário:** filhos(as) 30–50 anos que agendam para os pais (decisores digitais — forte no WhatsApp).

**Posicionamento único (real e verificável):**
1. Linha completa de métodos diagnósticos em um só lugar no Centro (9 exames/serviços);
2. **Agendamento pelo WhatsApp em ~1 minuto, com assistente que lê a foto do pedido médico** — diferencial concreto que nenhum concorrente local comunica;
3. 5 médicos especialistas e 20+ convênios;
4. Atendimento humanizado (tom da marca).

**Mensagem-mestra:** "Exames do coração em Juiz de Fora, sem complicação: mande a foto do seu pedido médico no WhatsApp e saia com horário marcado."

## 2. Fundamentos de mensuração (fazer ANTES de investir)

1. **GA4**: criar propriedade, definir `NEXT_PUBLIC_GA_ID` (o site só carrega após consentimento — já implementado).
2. **Google Tag Manager** (opcional, se a agência preferir gerenciar tags sem deploy).
3. **Meta Pixel + API de conversões**: eventos `Lead` (sucesso do formulário), `Contact` (clique em botão WhatsApp). Observação: o clique de WhatsApp pode ser mensurado como evento de clique no GTM/GA4 apontando para `wa.me`.
4. **Conversões no Google Ads**: importar do GA4 (lead do formulário) + conversão de clique no WhatsApp.
5. **UTMs padronizados**: `?utm_source={meta|google}&utm_medium={cpc|display}&utm_campaign={nome}&utm_content={criativo}`. O painel `/leads` + exportação CSV fecham o ciclo (marcar lead como "agendado" = conversão offline; subir a lista como conversão aprimorada/público).
6. **Número de leads já é rastreável hoje**: todo formulário cai em `/leads` com data — taxa de conversão medida sem depender de pixel.

## 3. Meta Ads (Facebook + Instagram)

| Campanha | Objetivo | Público | Criativos | Budget |
|---|---|---|---|---|
| **M1 Topo — Consciência local** | Alcance/ThruPlay | JF + 20 km, 40–70, interesses saúde/plano de saúde | Vídeo 15–30s do espaço + médico explicando check-up (educativo, sem promessa); card "Você sabe quais exames o cardiologista pode pedir?" | 300–500 |
| **M2 Meio — Consideração** | Tráfego/Engajamento | Retargeting visitantes 30d + seguidores @cardiocentro.jf + envolvidos 90d | Carrossel dos exames (1 card por exame com explicação simples), card de convênios, bastidores da equipe | 400–600 |
| **M3 Fundo — Conversa no WhatsApp** | Mensagens (Click-to-WhatsApp) | Lookalike 1% de leads agendados (CSV do `/leads`) + interesses cardiologia/plano de saúde 45–70 | "Tem pedido de ecocardiograma/Holter/MAPA? Mande a foto no WhatsApp e agende em 1 minuto." CTA **Enviar mensagem** → wa.me com texto pré-preenchido "Olá, gostaria de agendar um exame" (o agente reconhece essa frase e inicia o fluxo sozinho) | 600–1.000 |
| **M4 Remarketing de leads mornos** | Alcance/Mensagens | Público personalizado: CSV de leads `status=contatado/novo` com >7 dias | "Ficou faltando marcar seu exame? A agenda da semana abriu — fale com a gente." (sem pressão artificial; NÃO usar "slots limitados" se não for verdade) | 300–500 |

**Boas práticas:** excluir públicos entre campanhas (funil limpo); horário de veiculação de M3/M4 dentro do horário de atendimento (o agente responde 24h, mas a conversão é maior com recepção ativa para handoff); criativos com rosto real da equipe performam melhor que banco de imagens (colher autorizações de imagem da equipe).

## 4. Google Ads

**Search (prioridade máxima — intenção pronta):** budget 600–800.

- Grupos de anúncio por exame (correspondência de frase): "ecocardiograma juiz de fora", "holter 24h juiz de fora", "mapa 24 horas juiz de fora", "teste ergométrico juiz de fora", "teste cardiopulmonar juiz de fora", "duplex de carótidas juiz de fora", "clínica de cardiologia jf", "cardiologista juiz de fora convênio {unimed|ipsemg|cassi}".
- **Negativas:** gratuito, sus, popular, emprego, vaga, curso, faculdade, residência, veterinário, "o que é" (informacional puro — deixar para o blog).
- **Anúncios (RSA)** — títulos: "Cardiocentro — Cardiologia em JF" · "Ecocardiograma no Centro de JF" · "Agende pelo WhatsApp em 1 Minuto" · "20+ Convênios e Particular" · "Equipe Especializada — CRM-MG". Descrições: "Linha completa de métodos diagnósticos em cardiologia. Mande a foto do pedido médico no WhatsApp e saia com horário marcado." (nada de prazo de laudo).
- **Extensões:** ligação (32) 3215-8744, local (Google Business), sitelinks (Exames, Convênios, Dúvidas, Como chegar), mensagem.
- **Lances:** iniciar com "Maximizar cliques" com CPC teto ~R$ 4; migrar para "Maximizar conversões" com ≥30 conversões/mês.

**Display/Demand Gen remarketing:** 200–300 — banners simples "Seu coração agradece: agende seu exame" para visitantes que não converteram (frequência ≤ 3/dia).

## 5. Orçamento consolidado e expectativa

| Canal | Budget | Leads/mês esperados* | CPL | Conversão p/ agendamento |
|---|---|---|---|---|
| Meta Ads (M1–M4) | R$ 1.600–2.600 | 40–70 | R$ 25–45 | 30–40% |
| Google Search | R$ 600–800 | 20–35 | R$ 22–35 | 40–55% (intenção alta) |
| Display/remarketing | R$ 200–300 | 5–12 | R$ 25–50 | 15–25% |
| **Total** | **R$ 2.400–3.700** | **65–115** | **~R$ 28–38** | **~35%** |

\*Faixas conservadoras para mercado local de saúde; calibrar após 60 dias de dados reais no `/leads` e `/metricas`. Com ticket médio de exame entre R$ 250–450 (confirmar valores reais com a clínica — **não publicar preços em anúncio sem tabela vigente**), 25–40 agendamentos/mês pagos ≈ R$ 7.500–16.000 de receita → ROAS esperado 2,5–5×. Reinvestir apenas após comparecimento confirmado (métrica "Realizados" no `/metricas`).

**Fases:** Mês 1 — só Google Search + M3 (fundo de funil, ~R$ 1.500). Mês 2 — adicionar M2/M4. Mês 3 — M1 topo de funil se CPL estiver saudável.

## 6. CRO (conversão) — estado atual e testes

Já implementado nesta revisão: formulário que grava lead de verdade, máscara de telefone, data/turno preferencial, FAQ (reduz fricção), seção de convênios (objeção nº 1), botão flutuante de WhatsApp, prova social com números reais, política de privacidade (confiança).

Testes A/B sugeridos (um por vez, medir no `/leads` por `utm_content`):
1. CTA hero: "Quero agendar meu exame" × "Agendar pelo WhatsApp" (posição primária).
2. Landing específica por exame para o Search (ex.: seção âncora #especialidades × página dedicada `/ecocardiograma` com conteúdo próprio — recomendado na fase 2 para Qualidade do Anúncio).
3. Formulário curto (nome+telefone) × atual completo.

## 7. Orgânico complementar (custo zero)

- **Google Business Profile** (maior ROI local): fotos reais, horários, serviços cadastrados (um por exame), posts semanais, responder 100% das avaliações, link de agendamento = wa.me oficial.
- **Instagram @cardiocentro.jf** — 12 posts/mês: 4 educativos (o que é cada exame, quando o médico pede), 4 institucionais (equipe, estrutura, bastidores), 2 de canal (como agendar pelo WhatsApp — screencast do agente), 2 sazonais (Setembro do Coração, Dia Mundial do Coração 29/09).
- **Blog/SEO** (fase 2): 2 artigos/mês respondendo buscas informacionais — "O que é ecocardiograma com Doppler e para que serve?", "Holter 24h: como funciona o exame", "MAPA: por que o médico pediu?", "Teste ergométrico: como se preparar" (já temos o preparo real no site). Cada artigo termina com CTA de WhatsApp.
- **WhatsApp como ativo**: o QR code do número oficial impresso na recepção e nos pedidos/laudos entregues ("agende seu retorno por aqui").

## 8. Governança

- Revisão quinzenal: CPL por campanha, taxa lead→agendado (painel `/leads`), taxa de comparecimento (`/metricas`).
- Pausar qualquer anúncio reprovado ou questionado por publicidade médica e revisar com o diretor técnico.
- LGPD: listas de remarketing só com dados coletados com aviso de privacidade (já no ar); nunca subir dados clínicos (apenas nome/telefone/e-mail) para plataformas de anúncio.
