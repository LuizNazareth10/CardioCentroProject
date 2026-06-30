import { NextRequest, NextResponse } from 'next/server';
import { lerSessao } from '@/lib/auth';
import { criarPaciente, listarPacientes } from '@/lib/db';

export async function GET(req: NextRequest) {
  if (!(await lerSessao())) return NextResponse.json({ erro: 'não autorizado' }, { status: 401 });
  const busca = new URL(req.url).searchParams.get('q') || undefined;
  const pacientes = await listarPacientes(busca);
  return NextResponse.json({ pacientes });
}

export async function POST(req: NextRequest) {
  if (!(await lerSessao())) return NextResponse.json({ erro: 'não autorizado' }, { status: 401 });
  const dados = await req.json();
  if (!dados.nome || !dados.telefone) {
    return NextResponse.json({ erro: 'nome e telefone são obrigatórios' }, { status: 400 });
  }
  const paciente = await criarPaciente(dados);
  return NextResponse.json({ paciente });
}
