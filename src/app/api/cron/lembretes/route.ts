import { NextRequest, NextResponse } from 'next/server';
import { carregarClinicConfig } from '@/lib/clinic-config';
import { atualizarAgendamento, listarAgendamentos, obterPaciente } from '@/lib/db';
import { fmtData, fmtHora } from '@/lib/format';
import { enviarBotoes } from '@/lib/whatsapp/client';
import { mensagemLembreteConfirmacao } from '@/lib/whatsapp/messages';

/** data de amanhã (fuso America/Sao_Paulo) no formato YYYY-MM-DD */
function amanhaJF(): string {
  const hoje = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
  const d = new Date(`${hoje}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

function autorizado(req: NextRequest): boolean {
  const segredo = process.env.CRON_SECRET;
  if (!segredo) return true; // sem segredo configurado → não valida (dev/demo)
  return req.headers.get('authorization') === `Bearer ${segredo}`;
}

/**
 * Disparado 1x/dia (ver vercel.json) para enviar o lembrete de confirmação
 * de presença aos agendamentos de AMANHÃ que ainda não foram confirmados.
 * A resposta do paciente ("sim"/botão) é tratada em processarMensagem
 * (src/lib/whatsapp/agent.ts), que marca o agendamento como "confirmado".
 */
export async function GET(req: NextRequest) {
  if (!autorizado(req)) return NextResponse.json({ erro: 'não autorizado' }, { status: 401 });

  const { agente } = await carregarClinicConfig();
  if (!agente.confirmacaoAntecedenciaAtiva) {
    return NextResponse.json({ ok: true, enviados: 0, motivo: 'lembrete desligado nas configurações' });
  }

  const data = amanhaJF();
  const ags = await listarAgendamentos({ de: `${data}T00:00:00-03:00`, ate: `${data}T23:59:59-03:00` });
  const pendentes = ags.filter((a) => a.status === 'agendado' && !a.lembreteEnviadoEm);

  let enviados = 0;
  for (const ag of pendentes) {
    try {
      const paciente = await obterPaciente(ag.pacienteId);
      if (!paciente?.telefone) continue;
      const telefone = paciente.telefone;
      const primeiroNome = ag.pacienteNome.split(' ')[0];
      await enviarBotoes(
        telefone,
        mensagemLembreteConfirmacao(primeiroNome, fmtData(ag.inicio), fmtHora(ag.inicio)),
        [{ id: 'lembrete_confirmar', titulo: 'Confirmar ✅' }],
      );
      await atualizarAgendamento(ag.id, { lembreteEnviadoEm: new Date().toISOString() });
      enviados++;
    } catch (e) {
      console.error(`[cron:lembretes] falha ao lembrar agendamento ${ag.id}:`, e);
    }
  }

  return NextResponse.json({ ok: true, enviados, total: pendentes.length });
}
