import { NextRequest, NextResponse } from 'next/server';
import { lerSessao } from '@/lib/auth';
import { criarPaciente, listarPacientes } from '@/lib/db';
import { sanitizarPaciente } from '@/lib/validation';

export async function GET(req: NextRequest) {
  if (!(await lerSessao())) return NextResponse.json({ erro: 'não autorizado' }, { status: 401 });
  const busca = new URL(req.url).searchParams.get('q') || undefined;
  const pacientes = await listarPacientes(busca);
  return NextResponse.json({ pacientes });
}

export async function POST(req: NextRequest) {
  if (!(await lerSessao())) return NextResponse.json({ erro: 'não autorizado' }, { status: 401 });
  const raw = await req.json();
  try {
    const dados = sanitizarPaciente(raw);
    const paciente = await criarPaciente(dados);
    return NextResponse.json({ paciente });
  } catch (e) {
    return NextResponse.json({ erro: (e as Error).message }, { status: 400 });
  }
}
