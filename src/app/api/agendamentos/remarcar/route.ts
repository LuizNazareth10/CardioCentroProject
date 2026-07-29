import { NextRequest, NextResponse } from 'next/server';
import { lerSessao } from '@/lib/auth';
import { aplicarRemarcacao, planejarRemarcacao } from '@/lib/scheduling/remarcar';

// =============================================================
// POST /api/agendamentos/remarcar  { id, inicio, medicoId?, aplicar? }
//
// `aplicar: false` (padrão) só SIMULA: devolve o plano — quantos exames
// serão movidos e para quando — para a agenda mostrar na confirmação antes
// de mexer em nada. `aplicar: true` grava.
//
// A validação de conflito roda nas DUAS chamadas: entre a simulação e a
// confirmação alguém pode ter ocupado o horário.
// =============================================================
export async function POST(req: NextRequest) {
  if (!(await lerSessao())) return NextResponse.json({ erro: 'não autorizado' }, { status: 401 });

  const body = await req.json();
  const id = typeof body.id === 'string' ? body.id : '';
  const inicio = typeof body.inicio === 'string' ? body.inicio : '';
  const medicoId = typeof body.medicoId === 'string' && body.medicoId ? body.medicoId : undefined;
  if (!id || !inicio) return NextResponse.json({ erro: 'id e inicio são obrigatórios' }, { status: 400 });

  const resultado = await planejarRemarcacao(id, { inicio, medicoId });
  if (!resultado.ok) return NextResponse.json({ erro: resultado.erro }, { status: 409 });

  const { plano } = resultado;
  if (body.aplicar === true) await aplicarRemarcacao(plano);

  return NextResponse.json({
    ok: true,
    aplicado: body.aplicar === true,
    sessao: plano.sessao,
    itens: plano.itens.map((i) => ({
      id: i.id,
      exameId: i.exameId,
      medicoId: i.medicoId,
      inicio: i.inicio,
      fim: i.fim,
      inicioAnterior: i.inicioAnterior,
    })),
  });
}
