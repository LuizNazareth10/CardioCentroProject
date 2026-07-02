import { NextRequest, NextResponse } from 'next/server';
import { lerSessao } from '@/lib/auth';
import { criarPaciente, listarPacientes } from '@/lib/db';
import { sanitizarPaciente, sanitizarPacienteAgendamento, ValidationError } from '@/lib/validation';

export async function GET(req: NextRequest) {
  if (!(await lerSessao())) return NextResponse.json({ erro: 'não autorizado' }, { status: 401 });
  const busca = new URL(req.url).searchParams.get('q') || undefined;
  const pacientes = await listarPacientes(busca);
  return NextResponse.json({ pacientes });
}

export async function POST(req: NextRequest) {
  if (!(await lerSessao())) return NextResponse.json({ erro: 'não autorizado' }, { status: 401 });
  const rapido = new URL(req.url).searchParams.get('rapido') === '1';
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ erro: 'corpo da requisição inválido' }, { status: 400 });
  }
  try {
    const dados = rapido
      ? sanitizarPacienteAgendamento(raw as Record<string, unknown>)
      : sanitizarPaciente(raw as Record<string, unknown>);
    const paciente = await criarPaciente(dados);
    return NextResponse.json({ paciente });
  } catch (e) {
    if (e instanceof ValidationError) {
      return NextResponse.json({ erro: e.message }, { status: 400 });
    }
    // erro inesperado (Firestore, credenciais, etc.) — nunca expor .message bruto ao cliente
    console.error('[api/pacientes] erro ao criar paciente:', e);
    return NextResponse.json({ erro: 'Não foi possível salvar o paciente. Tente novamente em instantes.' }, { status: 500 });
  }
}
