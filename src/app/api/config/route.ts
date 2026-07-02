import { NextRequest, NextResponse } from 'next/server';
import { lerSessao } from '@/lib/auth';
import { carregarClinicConfig, salvarClinicConfig, type ClinicConfigOverrides } from '@/lib/clinic-config';

export async function GET() {
  if (!(await lerSessao())) return NextResponse.json({ erro: 'não autorizado' }, { status: 401 });
  const config = await carregarClinicConfig();
  return NextResponse.json({ config });
}

export async function PUT(req: NextRequest) {
  if (!(await lerSessao())) return NextResponse.json({ erro: 'não autorizado' }, { status: 401 });

  const body = (await req.json()) as ClinicConfigOverrides;
  try {
    await salvarClinicConfig({
      exames: body.exames,
      convenios: body.convenios,
      contato: body.contato,
    });
    const config = await carregarClinicConfig();
    return NextResponse.json({ config, ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro ao salvar configurações.';
    return NextResponse.json({ erro: msg }, { status: 400 });
  }
}
