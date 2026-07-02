import { NextRequest, NextResponse } from 'next/server';
import { lerSessao } from '@/lib/auth';
import { processarMensagem, type Entrada } from '@/lib/whatsapp/agent';
import { capturarEnvios, type EnvioCapturado } from '@/lib/whatsapp/client';
import { getSessao } from '@/lib/whatsapp/session';

// =============================================================
// SIMULADOR do agente de WhatsApp (sem depender da Meta).
// Roda o MESMO motor do webhook real, mas captura as respostas em
// vez de enviá-las. Só a equipe logada acessa. Ideal para validar o
// comportamento do agente antes de conectar um número oficial.
// =============================================================

// POST { telefone, tipo, valor, mime? }
export async function POST(req: NextRequest) {
  if (!(await lerSessao())) return NextResponse.json({ erro: 'não autorizado' }, { status: 401 });
  const body = await req.json();
  const telefone = String(body.telefone ?? '').replace(/\D/g, '');
  if (!telefone) return NextResponse.json({ erro: 'telefone obrigatório' }, { status: 400 });

  const entrada: Entrada = {
    tipo: body.tipo === 'interativo' || body.tipo === 'imagem' ? body.tipo : 'texto',
    valor: String(body.valor ?? ''),
    mime: body.mime,
  };

  const capturados = await capturarEnvios(() => processarMensagem(telefone, entrada));
  const mensagens = capturados.map(normalizar);
  const etapa = getSessao(telefone).etapa;

  return NextResponse.json({ mensagens, etapa });
}

// converte o payload da Cloud API numa forma simples para a UI do chat
function normalizar(p: EnvioCapturado) {
  const inter = p.interactive as any;
  if (p.type === 'text') return { tipo: 'texto', texto: (p.text as any)?.body ?? '' };
  if (p.type === 'interactive' && inter?.type === 'button') {
    return {
      tipo: 'botoes',
      texto: inter.body?.text ?? '',
      botoes: (inter.action?.buttons ?? []).map((b: any) => ({ id: b.reply.id, titulo: b.reply.title })),
    };
  }
  if (p.type === 'interactive' && inter?.type === 'list') {
    return {
      tipo: 'lista',
      texto: inter.body?.text ?? '',
      botaoLista: inter.action?.button ?? 'Ver opções',
      secoes: (inter.action?.sections ?? []).map((s: any) => ({
        titulo: s.title,
        itens: (s.rows ?? []).map((r: any) => ({ id: r.id, titulo: r.title, descricao: r.description })),
      })),
    };
  }
  return { tipo: 'texto', texto: JSON.stringify(p) };
}
