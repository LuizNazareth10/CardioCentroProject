import Link from 'next/link';
import { listarAgendamentos, listarPacientes } from '@/lib/db';
import { EXAMES, MEDICOS } from '@/lib/seed-data';
import { fmtHora, hojeJF, fmtDataExtenso } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function Dashboard() {
  const hoje = hojeJF();
  const [todos, pacientes] = await Promise.all([listarAgendamentos(), listarPacientes()]);
  const doDia = todos
    .filter((a) => a.inicio.slice(0, 10) === hoje && a.status !== 'cancelado')
    .sort((a, b) => a.inicio.localeCompare(b.inicio));

  const nomeExame = (id: string) => EXAMES.find((e) => e.id === id)?.nome ?? id;
  const nomeMedico = (id: string) => MEDICOS.find((m) => m.id === id)?.nome ?? id;

  const stats = [
    { label: 'Exames hoje', valor: doDia.length, cor: 'text-navy-700' },
    { label: 'Pacientes cadastrados', valor: pacientes.length, cor: 'text-navy-700' },
    { label: 'Médicos ativos', valor: MEDICOS.filter((m) => m.ativo).length, cor: 'text-brand-red' },
    { label: 'Exames disponíveis', valor: EXAMES.filter((e) => e.ativo).length, cor: 'text-brand-red' },
  ];

  return (
    <div>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Painel</h1>
          <p className="text-sm capitalize text-muted">{fmtDataExtenso(hoje)}</p>
        </div>
        <Link href="/agendar" className="btn-red">+ Novo agendamento</Link>
      </header>

      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="card p-5">
            <div className={`text-3xl font-extrabold ${s.cor}`}>{s.valor}</div>
            <div className="mt-1 text-sm text-muted">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="mt-6 card p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-navy-900">Exames de hoje</h2>
          <Link href="/agenda" className="text-sm font-semibold text-navy-700 hover:underline">Ver agenda completa →</Link>
        </div>

        {doDia.length === 0 ? (
          <p className="mt-6 text-center text-sm text-muted">Nenhum exame agendado para hoje ainda.</p>
        ) : (
          <ul className="mt-4 divide-y divide-navy-100/70">
            {doDia.map((a) => (
              <li key={a.id} className="flex items-center gap-4 py-3">
                <div className="w-14 text-sm font-bold text-navy-700">{fmtHora(a.inicio)}</div>
                <div className="flex-1">
                  <div className="text-sm font-semibold text-ink">{a.pacienteNome}</div>
                  <div className="text-xs text-muted">{nomeExame(a.exameId)} · {nomeMedico(a.medicoId)}</div>
                </div>
                <span className={`badge ${a.origem === 'whatsapp' ? 'bg-green-50 text-green-700' : 'bg-navy-50 text-navy-700'}`}>
                  {a.origem === 'whatsapp' ? 'WhatsApp' : 'Sistema'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
