import { NextResponse } from 'next/server';
import { lerSessao } from '@/lib/auth';
import { resumoMonitor } from '@/lib/whatsapp/monitor';
import { carregarClinicConfig } from '@/lib/clinic-config';

// GET /api/agente/monitor — modo atual do rollout + últimos eventos do agente.
export const dynamic = 'force-dynamic';

export async function GET() {
  if (!(await lerSessao())) return NextResponse.json({ erro: 'não autorizado' }, { status: 401 });
  const [{ agente }, monitor] = await Promise.all([carregarClinicConfig(), resumoMonitor(100)]);
  return NextResponse.json({
    modo: agente.modo,
    canaryPct: agente.canaryPct,
    monitor,
  });
}
