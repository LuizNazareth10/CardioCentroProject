import { NextRequest, NextResponse } from 'next/server';
import { lerSessao } from '@/lib/auth';
import { listarAgendamentos } from '@/lib/db';
import { APARELHOS, EXAMES, MEDICOS } from '@/lib/seed-data';
import { gerarSlots, gerarSlotsAparelho, proporSessao } from '@/lib/scheduling/engine';

// GET /api/disponibilidade?exames=ecg,ecg,mapa&medico=med-1&data=2026-07-06
// - 1 exame  -> retorna { slots: [...] }
// - N exames -> retorna { proposta: {...} } (sessão consecutiva, mesmo médico)
export async function GET(req: NextRequest) {
  if (!(await lerSessao())) return NextResponse.json({ erro: 'não autorizado' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const idsParam = searchParams.get('exames') ?? '';
  const ids = idsParam.split(',').filter(Boolean);
  const medicoPreferidoId = searchParams.get('medico') || undefined;
  const dataInicio = searchParams.get('data') || hojeJF();

  if (ids.length === 0) return NextResponse.json({ erro: 'informe ao menos um exame' }, { status: 400 });

  const examesSeq = ids.map((id) => EXAMES.find((e) => e.id === id)).filter(Boolean) as typeof EXAMES;
  if (examesSeq.length !== ids.length) {
    return NextResponse.json({ erro: 'exame inválido' }, { status: 400 });
  }

  const agendamentos = await listarAgendamentos();

  if (examesSeq.length === 1) {
    const exame = examesSeq[0];
    // exame de aparelho (Mapa/Holter) → slots fixos, sem médico
    if (exame.aparelho) {
      const slots = gerarSlotsAparelho(APARELHOS[exame.aparelho], agendamentos, {
        dataInicio,
        dias: 21,
        naoAntesDe: agoraJF(),
        limite: 80,
      });
      return NextResponse.json({ slots });
    }
    const slots = gerarSlots(exame, MEDICOS, agendamentos, {
      dataInicio,
      dias: 14,
      medicoPreferidoId,
      naoAntesDe: agoraJF(),
      limite: 80,
    });
    return NextResponse.json({ slots });
  }

  const proposta = proporSessao(examesSeq, MEDICOS, agendamentos, {
    dataInicio,
    dias: 14,
    medicoPreferidoId,
    naoAntesDe: agoraJF(),
  });
  return NextResponse.json({ proposta });
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
