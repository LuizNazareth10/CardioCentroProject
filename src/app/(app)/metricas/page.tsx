import { listarAgendamentos, listarLeads } from '@/lib/db';
import { APARELHOS, EXAMES, MEDICOS } from '@/lib/seed-data';
import { hojeJF } from '@/lib/format';
import type { Agendamento } from '@/lib/types';

export const dynamic = 'force-dynamic';

// =============================================================
// Métricas da clínica — visão de 30 dias (agendamentos + leads).
// Visual: barras horizontais em um único matiz da marca (magnitude),
// status com cor de estado + rótulo (nunca cor sozinha), texto em
// tokens de texto. Sem bibliotecas de gráfico — CSS puro.
// =============================================================

function addDias(iso: string, dias: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

const nomeExame = (id: string) => EXAMES.find((e) => e.id === id)?.nome ?? id;
function nomeMedico(id: string): string {
  const m = MEDICOS.find((x) => x.id === id);
  if (m) return m.nome;
  if (id === 'mapa') return APARELHOS.mapa.nome;
  if (id === 'holter') return APARELHOS.holter.nome;
  return id;
}

function contarPor<T extends string>(arr: Agendamento[], chave: (a: Agendamento) => T): Array<[T, number]> {
  const mapa = new Map<T, number>();
  for (const a of arr) mapa.set(chave(a), (mapa.get(chave(a)) ?? 0) + 1);
  return [...mapa.entries()].sort((x, y) => y[1] - x[1]);
}

/** barra horizontal de magnitude — um único matiz, ponta arredondada, rótulo direto */
function Barras({ titulo, dados }: { titulo: string; dados: Array<[string, number]> }) {
  const max = Math.max(1, ...dados.map(([, n]) => n));
  return (
    <div className="card p-5">
      <h2 className="font-bold text-navy-900">{titulo}</h2>
      {dados.length === 0 ? (
        <p className="mt-4 text-sm text-muted">Sem dados no período.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {dados.map(([rotulo, n]) => (
            <li key={rotulo} title={`${rotulo}: ${n}`}>
              <div className="mb-1 flex items-baseline justify-between gap-3">
                <span className="truncate text-sm text-ink">{rotulo}</span>
                <span className="text-sm font-semibold tabular-nums text-navy-700">{n}</span>
              </div>
              <div className="h-2.5 rounded-full bg-navy-100/50">
                <div
                  className="h-2.5 rounded-full bg-navyblue-500 transition-[width]"
                  style={{ width: `${Math.max(3, Math.round((n / max) * 100))}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default async function MetricasPage() {
  const hoje = hojeJF();
  const inicio30 = addDias(hoje, -30);
  const inicioSemana = addDias(hoje, -6);

  const [todos, leads] = await Promise.all([listarAgendamentos(), listarLeads()]);
  const validos = todos.filter((a) => a.status !== 'cancelado');

  const doDia = validos.filter((a) => a.inicio.slice(0, 10) === hoje);
  const daSemana = validos.filter((a) => a.inicio.slice(0, 10) >= inicioSemana && a.inicio.slice(0, 10) <= hoje);
  const periodo = todos.filter((a) => a.inicio.slice(0, 10) >= inicio30); // inclui cancelados p/ taxas

  const porExame = contarPor(periodo.filter((a) => a.status !== 'cancelado'), (a) => nomeExame(a.exameId));
  const porMedico = contarPor(periodo.filter((a) => a.status !== 'cancelado'), (a) => nomeMedico(a.medicoId));
  const porOrigem = contarPor(
    periodo.filter((a) => a.status !== 'cancelado'),
    (a) => (a.origem === 'whatsapp' ? 'WhatsApp (agente)' : 'Sistema (recepção)'),
  );

  // desfecho dos agendamentos do período (status é um ESTADO → cor de estado + rótulo)
  const desfechos = [
    { rotulo: 'Realizados', n: periodo.filter((a) => a.status === 'realizado').length, cor: 'bg-success', texto: 'text-emerald-700' },
    { rotulo: 'Confirmados/agendados', n: periodo.filter((a) => a.status === 'agendado' || a.status === 'confirmado').length, cor: 'bg-info', texto: 'text-blue-700' },
    { rotulo: 'Cancelados', n: periodo.filter((a) => a.status === 'cancelado').length, cor: 'bg-warning', texto: 'text-amber-700' },
    { rotulo: 'Faltas (no-show)', n: periodo.filter((a) => a.status === 'faltou').length, cor: 'bg-danger', texto: 'text-red-700' },
  ];
  const totalPeriodo = Math.max(1, periodo.length);

  const leadsAtivos = leads.filter((l) => l.status !== 'arquivado');
  const stats = [
    { label: 'Exames hoje', valor: doDia.length },
    { label: 'Últimos 7 dias', valor: daSemana.length },
    { label: 'Últimos 30 dias', valor: validos.filter((a) => a.inicio.slice(0, 10) >= inicio30).length },
    { label: 'Leads ativos', valor: leadsAtivos.length },
  ];

  return (
    <div>
      <header>
        <h1 className="font-serif text-3xl font-bold tracking-tight text-navy-900">Métricas</h1>
        <p className="text-sm text-muted">Visão dos últimos 30 dias — agendamentos, canais e leads.</p>
      </header>

      {/* números-chave */}
      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="card p-5">
            <div className="text-3xl font-extrabold tabular-nums text-navy-700">{s.valor}</div>
            <div className="mt-1 text-sm text-muted">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Barras titulo="Exames mais agendados (30 dias)" dados={porExame} />
        <Barras titulo="Agendamentos por médico (30 dias)" dados={porMedico} />
        <Barras titulo="Origem dos agendamentos (30 dias)" dados={porOrigem} />

        {/* desfecho — cores de estado sempre acompanhadas de rótulo e valor */}
        <div className="card p-5">
          <h2 className="font-bold text-navy-900">Desfecho dos agendamentos (30 dias)</h2>
          <ul className="mt-4 space-y-3">
            {desfechos.map((d) => (
              <li key={d.rotulo} title={`${d.rotulo}: ${d.n} de ${periodo.length}`}>
                <div className="mb-1 flex items-baseline justify-between gap-3">
                  <span className="flex items-center gap-2 text-sm text-ink">
                    <span className={`h-2.5 w-2.5 flex-none rounded-full ${d.cor}`} aria-hidden />
                    {d.rotulo}
                  </span>
                  <span className={`text-sm font-semibold tabular-nums ${d.texto}`}>
                    {d.n} <span className="font-normal text-muted">({Math.round((d.n / totalPeriodo) * 100)}%)</span>
                  </span>
                </div>
                <div className="h-2.5 rounded-full bg-navy-100/50">
                  <div
                    className={`h-2.5 rounded-full ${d.cor}`}
                    style={{ width: `${Math.max(d.n === 0 ? 0 : 3, Math.round((d.n / totalPeriodo) * 100))}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-muted">
            Percentuais sobre {periodo.length} agendamento{periodo.length === 1 ? '' : 's'} no período (inclui cancelados).
          </p>
        </div>
      </div>

      {/* leads por temperatura */}
      <div className="mt-6 card p-5">
        <h2 className="font-bold text-navy-900">Leads por temperatura</h2>
        <div className="mt-4 grid grid-cols-3 gap-4">
          {([
            ['🔥 Quentes', leadsAtivos.filter((l) => l.temperatura === 'quente').length, 'agendaram ou estão prestes'],
            ['🌡️ Mornos', leadsAtivos.filter((l) => l.temperatura === 'morno').length, 'demonstraram interesse'],
            ['❄️ Frios', leadsAtivos.filter((l) => l.temperatura === 'frio').length, 'contato sem avanço'],
          ] as const).map(([rotulo, n, desc]) => (
            <div key={rotulo} className="rounded-2xl border border-navy-100/70 bg-white/70 p-4">
              <div className="text-2xl font-extrabold tabular-nums text-navy-700">{n}</div>
              <div className="mt-0.5 text-sm font-semibold text-ink">{rotulo}</div>
              <div className="text-xs text-muted">{desc}</div>
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs text-muted">
          Acompanhe e faça follow-up na página <a href="/leads" className="font-semibold text-navy-700 underline">Leads</a>.
        </p>
      </div>
    </div>
  );
}
