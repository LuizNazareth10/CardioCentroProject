// =============================================================
// Validação de variáveis de ambiente na inicialização do servidor.
// Não derruba a aplicação (para não quebrar o modo demo), mas registra
// avisos claros no log quando algo essencial está faltando em produção.
// Executa UMA vez por processo (efeito colateral no import).
// =============================================================

import { timingSafeEqual } from 'crypto';

type Nivel = 'erro' | 'aviso' | 'info';

export interface ProblemaAmbiente {
  nivel: Nivel;
  variavel: string;
  mensagem: string;
}

/**
 * O que fazer quando o segredo de um endpoint NÃO está configurado.
 *
 * Produção → nega (fail-closed). Uma variável esquecida no painel da Vercel
 * deixaria o endpoint aberto sem emitir erro nenhum: no cron isso significa
 * qualquer um disparar o lembrete de WhatsApp para a agenda inteira; nos
 * webhooks, aceitar mensagens forjadas como se fossem de pacientes.
 * Dev → libera, para não exigir configuração no ambiente local.
 *
 * Usado por /api/cron/lembretes e pelos dois webhooks de WhatsApp.
 */
export function liberarSemSegredo(): boolean {
  return process.env.NODE_ENV !== 'production';
}

/**
 * Compara um segredo recebido com o esperado em tempo constante, para não
 * vazar quantos caracteres iniciais estavam certos. Trata null/undefined
 * como "não confere".
 */
export function segredoConfere(esperado: string, recebido: string | null | undefined): boolean {
  if (!recebido) return false;
  const a = Buffer.from(esperado);
  const b = Buffer.from(recebido);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function checarAmbiente(): ProblemaAmbiente[] {
  const p: ProblemaAmbiente[] = [];
  const prod = process.env.NODE_ENV === 'production';
  const backend = process.env.DATA_BACKEND ?? 'memory';

  // sessão
  if (!process.env.AUTH_SECRET) {
    p.push({
      nivel: prod ? 'erro' : 'aviso',
      variavel: 'AUTH_SECRET',
      mensagem: 'ausente — os cookies de sessão usarão um segredo de dev inseguro. Gere com "openssl rand -base64 32".',
    });
  }

  // backend de dados
  if (backend === 'firestore') {
    for (const v of ['GCP_PROJECT_ID', 'GOOGLE_SERVICE_ACCOUNT_B64']) {
      if (!process.env[v]) p.push({ nivel: 'erro', variavel: v, mensagem: 'obrigatória com DATA_BACKEND=firestore.' });
    }
  } else if (prod) {
    p.push({
      nivel: 'erro',
      variavel: 'DATA_BACKEND',
      mensagem: 'está em "memory" em produção — os dados NÃO persistem entre cold starts. O acesso ao banco derruba o processo até que DATA_BACKEND=firestore seja definido.',
    });
  }

  // WhatsApp (opcional, mas coerente entre si)
  const temToken = !!process.env.WHATSAPP_ACCESS_TOKEN;
  const temPhone = !!process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (temToken !== temPhone) {
    p.push({ nivel: 'aviso', variavel: 'WHATSAPP_ACCESS_TOKEN/PHONE_NUMBER_ID', mensagem: 'configure ambas para o envio funcionar.' });
  }
  if (temToken && temPhone && !process.env.WHATSAPP_APP_SECRET) {
    p.push({
      nivel: prod ? 'erro' : 'aviso',
      variavel: 'WHATSAPP_APP_SECRET',
      mensagem: 'ausente — em produção o webhook da Meta REJEITA todas as mensagens (fail-closed). Configure o App Secret do app na Meta.',
    });
  }

  // Segredos que protegem endpoints sem sessão. Sem eles, em produção o
  // endpoint responde 401 a tudo (ver liberarSemSegredo) — o serviço fica
  // indisponível, que é o modo de falha correto para estes casos.
  if (!process.env.CRON_SECRET) {
    p.push({
      nivel: prod ? 'erro' : 'aviso',
      variavel: 'CRON_SECRET',
      mensagem: 'ausente — em produção /api/cron/lembretes rejeita tudo e os lembretes de confirmação NÃO são enviados.',
    });
  }
  if (process.env.EVOLUTION_API_URL && !process.env.EVOLUTION_WEBHOOK_SECRET) {
    p.push({
      nivel: prod ? 'erro' : 'aviso',
      variavel: 'EVOLUTION_WEBHOOK_SECRET',
      mensagem: 'ausente — em produção o webhook da Evolution rejeita tudo e o agente não responde. Defina o mesmo valor no webhook da instância (header x-evolution-secret).',
    });
  }
  if ((temToken || process.env.DATA_BACKEND) && !process.env.ANTHROPIC_API_KEY) {
    p.push({ nivel: 'info', variavel: 'ANTHROPIC_API_KEY', mensagem: 'ausente — o agente usa fallback por palavras-chave e não lê pedidos por imagem.' });
  }

  return p;
}

// executa uma vez ao subir o servidor
if (typeof window === 'undefined') {
  const probs = checarAmbiente();
  for (const { nivel, variavel, mensagem } of probs) {
    const linha = `[env] ${variavel}: ${mensagem}`;
    if (nivel === 'erro') console.error('❌ ' + linha);
    else if (nivel === 'aviso') console.warn('⚠️  ' + linha);
    else console.info('ℹ️  ' + linha);
  }
}
