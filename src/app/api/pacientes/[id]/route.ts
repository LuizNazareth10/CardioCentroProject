import { NextRequest, NextResponse } from 'next/server';
import { lerSessao } from '@/lib/auth';
import {
  atualizarPaciente,
  criarTriagem,
  listarAgendamentos,
  listarTriagens,
  obterPaciente,
} from '@/lib/db';
import { sanitizarPacientePatch, validarTriagem } from '@/lib/validation';

interface Ctx { params: { id: string } }

// Detalhe completo: paciente + histórico de agendamentos + triagens
export async function GET(_req: NextRequest, { params }: Ctx) {
  if (!(await lerSessao())) return NextResponse.json({ erro: 'não autorizado' }, { status: 401 });
  const paciente = await obterPaciente(params.id);
  if (!paciente) return NextResponse.json({ erro: 'paciente não encontrado' }, { status: 404 });
  const [historico, triagens] = await Promise.all([
    listarAgendamentos({ pacienteId: params.id }),
    listarTriagens(params.id),
  ]);
  return NextResponse.json({ paciente, historico, triagens });
}

// Atualiza ficha de identidade / dados cadastrais
export async function PATCH(req: NextRequest, { params }: Ctx) {
  if (!(await lerSessao())) return NextResponse.json({ erro: 'não autorizado' }, { status: 401 });
  const raw = await req.json();
  const atual = await obterPaciente(params.id);
  if (!atual) return NextResponse.json({ erro: 'não encontrado' }, { status: 404 });

  const parcial = sanitizarPacientePatch(raw as Record<string, unknown>);
  const patch: Record<string, unknown> = { ...parcial };
  if (parcial.fichaMedica) {
    patch.fichaMedica = { ...atual.fichaMedica, ...parcial.fichaMedica };
  }
  const atualizado = await atualizarPaciente(params.id, patch);
  if (!atualizado) return NextResponse.json({ erro: 'não encontrado' }, { status: 404 });
  return NextResponse.json({ paciente: atualizado });
}

// Cria uma triagem para este paciente
export async function POST(req: NextRequest, { params }: Ctx) {
  const sessao = await lerSessao();
  if (!sessao) return NextResponse.json({ erro: 'não autorizado' }, { status: 401 });
  const dados = await req.json();
  const erros = validarTriagem(dados);
  if (erros.length) return NextResponse.json({ erro: erros.join(' ') }, { status: 400 });
  const triagem = await criarTriagem({
    ...dados,
    pacienteId: params.id,
    data: dados.data ?? new Date().toISOString(),
    responsavel: sessao.nome,
  });
  return NextResponse.json({ triagem });
}
