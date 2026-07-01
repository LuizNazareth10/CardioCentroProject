// =============================================================
// Validação de variáveis de ambiente na inicialização do servidor.
// Não derruba a aplicação (para não quebrar o modo demo), mas registra
// avisos claros no log quando algo essencial está faltando em produção.
// Executa UMA vez por processo (efeito colateral no import).
// =============================================================

type Nivel = 'erro' | 'aviso' | 'info';

export interface ProblemaAmbiente {
  nivel: Nivel;
  variavel: string;
  mensagem: string;
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
    p.push({ nivel: 'aviso', variavel: 'DATA_BACKEND', mensagem: 'está em "memory" em produção — os dados NÃO persistem entre requisições/cold starts.' });
  }

  // WhatsApp (opcional, mas coerente entre si)
  const temToken = !!process.env.WHATSAPP_ACCESS_TOKEN;
  const temPhone = !!process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (temToken !== temPhone) {
    p.push({ nivel: 'aviso', variavel: 'WHATSAPP_ACCESS_TOKEN/PHONE_NUMBER_ID', mensagem: 'configure ambas para o envio funcionar.' });
  }
  if (temToken && temPhone && !process.env.WHATSAPP_APP_SECRET) {
    p.push({ nivel: 'aviso', variavel: 'WHATSAPP_APP_SECRET', mensagem: 'ausente — o webhook não valida a assinatura HMAC da Meta (recomendado em produção).' });
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
