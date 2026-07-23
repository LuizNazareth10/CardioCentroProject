import { NextRequest, NextResponse } from 'next/server';
import { lerSessao } from '@/lib/auth';
import { atualizarAgendamento, listarAgendamentos, listarAgendamentosDoMedico, criarAgendamentos } from '@/lib/db';
import type { Agendamento, StatusAgendamento } from '@/lib/types';
import { fromISO } from '@/lib/scheduling/time';

const STATUS_VALIDOS: StatusAgendamento[] = [
  'agendado', 'confirmado', 'chegou', 'em_atendimento', 'realizado', 'cancelado', 'faltou',
];

// GET /api/agendamentos?de=2026-07-06&ate=2026-07-07
export async function GET(req: NextRequest) {
  if (!(await lerSessao())) return NextResponse.json({ erro: 'não autorizado' }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const de = searchParams.get('de') || undefined;
  const ate = searchParams.get('ate') || undefined;
  const ags = await listarAgendamentos({ de, ate });
  return NextResponse.json({ agendamentos: ags });
}

// POST /api/agendamentos  { itens: [...] }
// Revalida conflito no servidor antes de gravar (defesa contra corrida).
export async function POST(req: NextRequest) {
  const sessao = await lerSessao();
  if (!sessao) return NextResponse.json({ erro: 'não autorizado' }, { status: 401 });

  const body = await req.json();
  const itens: Array<Omit<Agendamento, 'id' | 'criadoEm'>> = body.itens ?? [];
  if (itens.length === 0) return NextResponse.json({ erro: 'nada a agendar' }, { status: 400 });

  // revalida conflito lendo APENAS o dia de cada médico envolvido (query
  // indexada), não a coleção inteira. Cache por médico+dia evita releituras
  // quando vários itens caem no mesmo médico/data.
  const cacheDia = new Map<string, Awaited<ReturnType<typeof listarAgendamentosDoMedico>>>();
  for (const novo of itens) {
    const dia = fromISO(novo.inicio).date;
    const chave = `${novo.medicoId}|${dia}`;
    let doDia = cacheDia.get(chave);
    if (!doDia) {
      doDia = await listarAgendamentosDoMedico(novo.medicoId, `${dia}T00:00:00-03:00`, `${dia}T23:59:59-03:00`);
      cacheDia.set(chave, doDia);
    }
    const conflito = doDia.some(
      (e) => e.status !== 'cancelado' && novo.inicio < e.fim && e.inicio < novo.fim,
    );
    if (conflito) {
      return NextResponse.json(
        { erro: 'Horário acabou de ser ocupado. Atualize a disponibilidade.' },
        { status: 409 },
      );
    }
  }

  const criados = await criarAgendamentos(itens);
  return NextResponse.json({ agendamentos: criados });
}

// PATCH /api/agendamentos  { id, status } — muda o status (confirmar/realizado/faltou/cancelar)
export async function PATCH(req: NextRequest) {
  if (!(await lerSessao())) return NextResponse.json({ erro: 'não autorizado' }, { status: 401 });
  const body = await req.json();
  const id = typeof body.id === 'string' ? body.id : '';
  const status = body.status as StatusAgendamento;
  if (!id) return NextResponse.json({ erro: 'id obrigatório' }, { status: 400 });
  if (!STATUS_VALIDOS.includes(status)) return NextResponse.json({ erro: 'status inválido' }, { status: 400 });
  await atualizarAgendamento(id, { status });
  return NextResponse.json({ ok: true });
}
