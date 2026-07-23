// =============================================================
// ROLLOUT do agente — decide, para cada mensagem recebida, se a IA deve
// atender aquele número, com base no modo de operação configurado.
//
// Objetivo (pedido do produto): testar com clientes REAIS sem risco de
// perder lead. A estratégia é um canary pegajoso: uma fração pequena e
// crescente das leads é atendida pela IA; o restante segue com a recepção
// humana exatamente como hoje. Tudo controlável em runtime (sem redeploy)
// pela tela de Configurações.
//
// Modos (ver ModoAgente em clinic-config.ts): full · shadow · canary · paused.
// =============================================================

import type { AgenteConfig, ModoAgente } from '../clinic-config';
import type { TransporteExterno } from './client';

export interface DecisaoRollout {
  /** a IA deve responder de verdade a este número? */
  atende: boolean;
  /** true no modo shadow: roda o agente mas o resultado é rascunho (não enviado) */
  shadow: boolean;
  modo: ModoAgente;
  /** bucket 0–99 do número (estável) — útil no monitoramento */
  bucket: number;
  /** motivo legível da decisão (para logs/painel) */
  motivo: string;
}

/**
 * Hash estável de um número de telefone → bucket 0–99. Determinístico: o
 * MESMO número cai SEMPRE no mesmo bucket, então uma pessoa nunca "pula"
 * entre IA e humano no meio da conversa quando o modo é canary. Usa só os
 * últimos 8 dígitos (ignora DDI/DDD/9º dígito, que variam na origem).
 */
export function bucketDoNumero(telefone: string): number {
  const d = telefone.replace(/\D/g, '').slice(-8);
  // FNV-1a 32 bits — barato e bem distribuído
  let h = 0x811c9dc5;
  for (let i = 0; i < d.length; i++) {
    h ^= d.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0) % 100;
}

/**
 * Decide o atendimento para um número.
 *
 * `sempreAtende` = números da allowlist de teste (EVOLUTION_NUMEROS_TESTE):
 * são os seus próprios números de QA e entram sempre (exceto em `paused`),
 * independentemente do percentual — assim você testa o fluxo completo sem
 * depender da loteria do canary.
 */
export function decidirRollout(
  telefone: string,
  agente: Pick<AgenteConfig, 'modo' | 'canaryPct'>,
  sempreAtende: boolean,
): DecisaoRollout {
  const bucket = bucketDoNumero(telefone);
  const modo = agente.modo ?? 'full';

  if (modo === 'paused') {
    return { atende: false, shadow: false, modo, bucket, motivo: 'kill-switch (paused): IA desligada' };
  }

  if (modo === 'shadow') {
    // roda o agente para produzir rascunho, mas não envia nada ao paciente
    return { atende: true, shadow: true, modo, bucket, motivo: 'shadow: rascunho (não enviado)' };
  }

  if (sempreAtende) {
    return { atende: true, shadow: false, modo, bucket, motivo: 'número de teste (allowlist)' };
  }

  if (modo === 'canary') {
    const pct = Math.max(0, Math.min(100, agente.canaryPct ?? 0));
    const dentro = bucket < pct;
    return {
      atende: dentro,
      shadow: false,
      modo,
      bucket,
      motivo: dentro ? `canary: bucket ${bucket} < ${pct}%` : `canary: bucket ${bucket} ≥ ${pct}% (humano)`,
    };
  }

  // full
  return { atende: true, shadow: false, modo, bucket, motivo: 'full: atende todos' };
}

// -------------------------------------------------------------
// Transporte de CAPTURA (modo shadow)
// -------------------------------------------------------------

/**
 * Um TransporteExterno que NÃO envia nada — só coleta o que o agente
 * produziria, no array `sink`. Como o agente checa o transporte antes de
 * qualquer caminho de envio real (Meta/Evolution), usar isto via
 * `comTransporte(...)` garante que, em shadow, nenhuma mensagem chega ao
 * paciente. A leitura de mídia é desativada (rascunho não baixa imagem).
 */
export function transporteCaptura(sink: Array<Record<string, unknown>>): TransporteExterno {
  return {
    async enviarTexto(to, texto) {
      sink.push({ to, type: 'text', text: { body: texto } });
    },
    async enviarBotoes(to, texto, botoes) {
      sink.push({ to, type: 'interactive', interactive: { body: { text: texto } }, botoes });
    },
    async enviarLista(to, texto, _botaoLista, secoes) {
      sink.push({ to, type: 'interactive', interactive: { body: { text: texto } }, secoes });
    },
    async baixarMidia() {
      return null;
    },
  };
}

// -------------------------------------------------------------
// Encaminhamento do rascunho (modo shadow) para observação
// -------------------------------------------------------------

/**
 * Envia o rascunho que a IA teria mandado para um webhook de observação
 * (Slack ou Discord), definido em SHADOW_WEBHOOK_URL. Fire-and-forget:
 * nunca quebra o fluxo se o webhook falhar.
 */
export async function encaminharRascunhoShadow(
  telefone: string,
  entradaTexto: string,
  envios: Array<Record<string, unknown>>,
): Promise<void> {
  const url = process.env.SHADOW_WEBHOOK_URL?.trim();
  if (!url) return;
  const linhas = envios.map((e) => resumoEnvio(e)).filter(Boolean);
  const corpo = [
    `🕵️ *Shadow* — rascunho do agente para \`${mascarar(telefone)}\``,
    `_Paciente disse:_ ${entradaTexto || '(interativo/mídia)'}`,
    '',
    ...linhas.map((l) => `→ ${l}`),
  ].join('\n');

  const payload = url.includes('discord') ? { content: corpo } : { text: corpo };
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    console.error('[shadow] falha ao encaminhar rascunho:', e);
  }
}

/** transforma um payload de envio capturado em uma linha legível */
function resumoEnvio(e: Record<string, unknown>): string {
  const texto = (e as { text?: { body?: string } }).text?.body;
  if (typeof texto === 'string') return texto;
  const interactive = (e as { interactive?: { body?: { text?: string }; action?: unknown } }).interactive;
  if (interactive?.body?.text) return `${interactive.body.text}  [menu]`;
  return JSON.stringify(e).slice(0, 200);
}

/** mascara o número no observador (privacidade): mantém DDD e 2 últimos */
function mascarar(telefone: string): string {
  const d = telefone.replace(/\D/g, '');
  if (d.length < 6) return '***';
  return `${d.slice(0, 4)}…${d.slice(-2)}`;
}
