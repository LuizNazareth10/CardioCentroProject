import { NextRequest, NextResponse } from 'next/server';
import { lerSessao } from '@/lib/auth';
import { listarAgendamentos } from '@/lib/db';
import { carregarClinicConfig } from '@/lib/clinic-config';
import { APARELHOS } from '@/lib/seed-data';
import { gerarSlots, gerarSlotsAparelho, proporSessao } from '@/lib/scheduling/engine';

// GET /api/disponibilidade?exames=eco-doppler,mapa&medico=med-1&data=2026-07-06&dias=28
export async function GET(req: NextRequest) {
  if (!(await lerSessao())) return NextResponse.json({ erro: 'não autorizado' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const idsParam = searchParams.get('exames') ?? '';
  const ids = idsParam.split(',').filter(Boolean);
  const medicoPreferidoId = searchParams.get('medico') || undefined;
  const dataInicio = searchParams.get('data') || hojeJF();
  const diasParam = parseInt(searchParams.get('dias') ?? '', 10);

  if (ids.length === 0) return NextResponse.json({ erro: 'informe ao menos um exame' }, { status: 400 });

  const { exames: EXAMES, medicos: MEDICOS } = await carregarClinicConfig();
  const examesSeq = ids.map((id) => EXAMES.find((e) => e.id === id)).filter(Boolean) as typeof EXAMES;
  if (examesSeq.length !== ids.length) {
    return NextResponse.json({ erro: 'exame inválido' }, { status: 400 });
  }

  const agendamentos = await listarAgendamentos();
  const temAparelho = examesSeq.some((e) => e.aparelho);
  const dias = Number.isFinite(diasParam) && diasParam > 0
    ? Math.min(diasParam, 90)
    : temAparelho ? 42 : 28;

  if (examesSeq.length === 1) {
    const exame = examesSeq[0];
    if (exame.aparelho) {
      const slots = gerarSlotsAparelho(APARELHOS[exame.aparelho], agendamentos, {
        dataInicio,
        dias,
        naoAntesDe: agoraJF(),
        limite: 120,
      });
      return NextResponse.json({ slots, dataInicio, dias });
    }
    const slots = gerarSlots(exame, MEDICOS, agendamentos, {
      dataInicio,
      dias,
      medicoPreferidoId,
      naoAntesDe: agoraJF(),
      limite: 120,
    });
    return NextResponse.json({ slots, dataInicio, dias });
  }

  const proposta = proporSessao(examesSeq, MEDICOS, agendamentos, {
    dataInicio,
    dias,
    medicoPreferidoId,
    naoAntesDe: agoraJF(),
  });
  return NextResponse.json({ proposta, dataInicio, dias });
}

function hojeJF(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}
function agoraJF(): string {
  const d = new Date();
  const date = d.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
  const time = d.toLocaleTimeString('en-GB', { timeZone: 'America/Sao_Paulo' });
  return `${date}T${time}-03:00`;
}
