import { CONTATO, CONVENIOS, EXAMES, MEDICOS } from '@/lib/seed-data';

const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export default function ConfiguracoesPage() {
  return (
    <div>
      <h1 className="font-serif text-3xl font-bold tracking-tight text-navy-900">Configurações</h1>
      <p className="text-sm text-muted">Base de médicos, exames e convênios da clínica.</p>

      <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        ⚠️ Estes dados são uma base inicial (placeholder). Os <strong>nomes e horários reais dos médicos</strong> e a
        <strong> duração real de cada exame</strong> serão inseridos quando você os enviar. No modo Firestore, esta tela
        passa a permitir edição persistente.
      </div>

      <section className="mt-6">
        <h2 className="mb-3 font-bold text-navy-900">Médicos</h2>
        <div className="grid gap-3 md:grid-cols-3">
          {MEDICOS.map((m) => (
            <div key={m.id} className="card p-4">
              <div className="text-sm font-bold text-navy-900">{m.nome}</div>
              <div className="text-xs text-muted">{m.crm}</div>
              <div className="mt-3 text-xs text-muted">Atendimento:</div>
              <div className="mt-1 flex flex-wrap gap-1">
                {Array.from(new Set(m.disponibilidade.map((j) => `${DIAS[j.weekday]} ${j.inicio}–${j.fim}`))).map((s) => (
                  <span key={s} className="badge bg-navy-50 text-navy-700">{s}</span>
                ))}
              </div>
              <div className="mt-3 text-xs text-muted">{m.examesHabilitados.length} exames habilitados</div>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-7">
        <h2 className="mb-3 font-bold text-navy-900">Exames</h2>
        <div className="card divide-y divide-navy-100/70">
          {EXAMES.map((e) => (
            <div key={e.id} className="flex items-center justify-between p-3.5">
              <div>
                <div className="text-sm font-semibold text-ink">{e.nome}</div>
                {e.preparo && <div className="text-xs text-muted">{e.preparo}</div>}
              </div>
              <span className="badge bg-brand-red/10 text-brand-red-600">{e.duracaoMin} min</span>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-7">
        <h2 className="mb-3 font-bold text-navy-900">Convênios aceitos</h2>
        <div className="card p-4 flex flex-wrap gap-1.5">
          {CONVENIOS.map((c) => <span key={c.id} className="badge bg-navy-50 text-navy-700">{c.nome}</span>)}
        </div>
      </section>

      <section className="mt-7">
        <h2 className="mb-3 font-bold text-navy-900">Contato</h2>
        <div className="card p-5 text-sm text-ink/85 space-y-1.5">
          <div>Endereço: <strong>{CONTATO.enderecoCompleto}</strong></div>
          <div>Telefone: <strong>{CONTATO.telefone}</strong></div>
          <div>
            WhatsApp: <strong>{CONTATO.whatsapp}</strong>{' '}
            <a href={CONTATO.whatsappLink} target="_blank" rel="noopener noreferrer" className="font-semibold text-brand-red hover:underline">
              abrir conversa →
            </a>
          </div>
          <div>E-mail: <strong>{CONTATO.email}</strong></div>
          <div>
            Instagram:{' '}
            <a href={CONTATO.instagram} target="_blank" rel="noopener noreferrer" className="font-semibold text-navy-700 hover:underline">
              {CONTATO.instagramHandle}
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
