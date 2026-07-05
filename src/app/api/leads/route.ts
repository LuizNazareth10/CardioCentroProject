import { NextRequest, NextResponse } from 'next/server';
import { lerSessao } from '@/lib/auth';
import { atualizarLead, criarLead, listarLeads } from '@/lib/db';
import { ipDoRequest, permitir } from '@/lib/rate-limit';
import { sanitizarLeadFormulario, ValidationError } from '@/lib/validation';
import type { StatusLead, TemperaturaLead } from '@/lib/types';

const STATUS_VALIDOS: StatusLead[] = ['novo', 'contatado', 'agendado', 'arquivado'];
const TEMPERATURAS_VALIDAS: TemperaturaLead[] = ['quente', 'morno', 'frio'];

// POST /api/leads — PÚBLICO (formulário da landing page).
// Protegido por rate limit por IP + honeypot anti-bot + validação estrita.
export async function POST(req: NextRequest) {
  const ip = ipDoRequest(req);
  if (!permitir(`leads:${ip}`, 5, 10 * 60 * 1000)) {
    return NextResponse.json(
      { erro: 'Muitas solicitações. Aguarde alguns minutos ou fale conosco pelo WhatsApp.' },
      { status: 429 },
    );
  }

  let raw: Record<string, unknown>;
  try {
    raw = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ erro: 'Requisição inválida.' }, { status: 400 });
  }

  // honeypot: campo invisível para humanos; bots que preencherem são
  // silenciosamente aceitos (sem gravar) para não revelar a defesa.
  if (typeof raw.site === 'string' && raw.site.trim() !== '') {
    return NextResponse.json({ ok: true });
  }

  try {
    const dados = sanitizarLeadFormulario(raw);
    await criarLead(dados);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof ValidationError) {
      return NextResponse.json({ erro: e.message }, { status: 400 });
    }
    console.error('[api/leads] erro ao criar lead:', e);
    return NextResponse.json(
      { erro: 'Não foi possível enviar agora. Tente novamente ou fale conosco pelo WhatsApp.' },
      { status: 500 },
    );
  }
}

// GET /api/leads — equipe logada
export async function GET() {
  if (!(await lerSessao())) return NextResponse.json({ erro: 'não autorizado' }, { status: 401 });
  const leads = await listarLeads();
  return NextResponse.json({ leads });
}

// PATCH /api/leads { id, status?, temperatura?, observacao? } — equipe logada
export async function PATCH(req: NextRequest) {
  if (!(await lerSessao())) return NextResponse.json({ erro: 'não autorizado' }, { status: 401 });
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ erro: 'Requisição inválida.' }, { status: 400 });
  }
  const id = typeof body.id === 'string' ? body.id : '';
  if (!id) return NextResponse.json({ erro: 'id obrigatório' }, { status: 400 });

  const patch: { status?: StatusLead; temperatura?: TemperaturaLead; observacao?: string } = {};
  if (body.status !== undefined) {
    if (!STATUS_VALIDOS.includes(body.status as StatusLead)) {
      return NextResponse.json({ erro: 'status inválido' }, { status: 400 });
    }
    patch.status = body.status as StatusLead;
  }
  if (body.temperatura !== undefined) {
    if (!TEMPERATURAS_VALIDAS.includes(body.temperatura as TemperaturaLead)) {
      return NextResponse.json({ erro: 'temperatura inválida' }, { status: 400 });
    }
    patch.temperatura = body.temperatura as TemperaturaLead;
  }
  if (typeof body.observacao === 'string') patch.observacao = body.observacao.slice(0, 2000);

  await atualizarLead(id, patch);
  return NextResponse.json({ ok: true });
}
