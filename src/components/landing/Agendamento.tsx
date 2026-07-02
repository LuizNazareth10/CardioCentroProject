'use client';

import { useState, type FormEvent } from 'react';
import { MapPin, Phone, Mail, Clock, CalendarCheck, CheckCircle2, Loader2, MessageCircle } from 'lucide-react';
import { Reveal } from './Reveal';
import { contato, whatsappLink, examesAgendamento } from './content';

type Fields = { nome: string; telefone: string; email: string; exame: string; mensagem: string };
type Errors = Partial<Record<keyof Fields, string>>;

const exames = examesAgendamento;

const contatos = [
  { icon: MapPin, title: 'Endereço', lines: [contato.endereco, contato.bairro] },
  { icon: Phone, title: 'Telefone', lines: [contato.telefone, `WhatsApp: ${contato.whatsapp}`] },
  { icon: Mail, title: 'E-mail', lines: [contato.email] },
  { icon: Clock, title: 'Horário', lines: ['Seg a Sex · 7h às 19h', 'Sáb · 8h às 12h'] },
];

const mapaSrc = `https://maps.google.com/maps?q=${encodeURIComponent(
  contato.mapaQuery,
)}&t=&z=16&ie=UTF8&iwloc=&output=embed`;

export function Agendamento() {
  const [values, setValues] = useState<Fields>({
    nome: '', telefone: '', email: '', exame: exames[0], mensagem: '',
  });
  const [errors, setErrors] = useState<Errors>({});
  const [status, setStatus] = useState<'idle' | 'sending' | 'success'>('idle');

  function update<K extends keyof Fields>(key: K, val: string) {
    setValues((v) => ({ ...v, [key]: val }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  }

  function validate(): Errors {
    const e: Errors = {};
    if (values.nome.trim().length < 3) e.nome = 'Informe seu nome completo.';
    if (!/^[\d\s()+-]{8,}$/.test(values.telefone.trim())) e.telefone = 'Telefone inválido.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) e.email = 'E-mail inválido.';
    return e;
  }

  async function onSubmit(ev: FormEvent) {
    ev.preventDefault();
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) {
      const first = document.getElementById(`field-${Object.keys(e)[0]}`);
      first?.focus();
      return;
    }
    setStatus('sending');
    // Simula envio (integração real: POST /api/agendamentos ou lead capture)
    await new Promise((r) => setTimeout(r, 1100));
    setStatus('success');
  }

  const invalidCls = 'border-danger focus:border-danger focus:ring-danger/20';
  const baseInput =
    'w-full rounded-xl border border-navyblue-100 bg-offwhite px-4 py-3 text-sm text-navyblue-900 outline-none transition focus:border-navyblue-600 focus:ring-2 focus:ring-navyblue-600/15 placeholder:text-gray-400';

  return (
    <section id="agendamento" className="scroll-mt-24 bg-canvas py-24 lg:py-28">
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.1fr]">
          {/* info + mapa */}
          <Reveal direction="right">
            <span className="pill">Agende sua visita</span>
            <h2 className="mt-5 font-serif text-4xl font-bold tracking-tight text-navyblue-900 sm:text-5xl">
              Vamos cuidar do seu coração juntos
            </h2>
            <p className="mt-4 text-lg text-gray-600">
              Preencha o formulário e nossa equipe entrará em contato para
              confirmar o melhor horário. Rápido, simples e sem burocracia.
            </p>

            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              {contatos.map((c) => (
                <div key={c.title} className="flex items-start gap-3 rounded-2xl border border-navyblue-100/70 bg-white p-4 shadow-card">
                  <span className="grid h-10 w-10 flex-none place-items-center rounded-xl bg-navyblue-50 text-navyblue-700">
                    <c.icon className="h-5 w-5" aria-hidden />
                  </span>
                  <div>
                    <div className="text-sm font-bold text-navyblue-900">{c.title}</div>
                    {c.lines.map((l) => (
                      <div key={l} className="text-xs text-gray-500">{l}</div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <a
              href={whatsappLink}
              target="_blank"
              rel="noopener noreferrer"
              className="cta-navy mt-6 w-full text-base"
            >
              <MessageCircle className="h-5 w-5" aria-hidden />
              Marcar exame pelo WhatsApp
            </a>

            <div className="mt-6 overflow-hidden rounded-3xl border border-navyblue-100 shadow-card">
              <iframe
                title="Mapa da Cardiocentro — Rua Delfim Moreira, 165, Centro, Juiz de Fora — MG"
                src={mapaSrc}
                className="h-56 w-full"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
          </Reveal>

          {/* formulário */}
          <Reveal direction="left">
            <div className="glass rounded-[2rem] p-7 shadow-glass sm:p-9">
              {status === 'success' ? (
                <div className="flex min-h-[420px] flex-col items-center justify-center text-center">
                  <span className="grid h-16 w-16 place-items-center rounded-full bg-success/15 text-success">
                    <CheckCircle2 className="h-8 w-8" aria-hidden />
                  </span>
                  <h3 className="mt-6 font-serif text-2xl font-bold text-navyblue-900">
                    Solicitação enviada!
                  </h3>
                  <p className="mt-2 max-w-sm text-sm text-gray-600">
                    Obrigado, {values.nome.split(' ')[0]}. Nossa equipe entrará em
                    contato em breve para confirmar seu agendamento.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setValues({ nome: '', telefone: '', email: '', exame: exames[0], mensagem: '' });
                      setStatus('idle');
                    }}
                    className="cta-ghost mt-8"
                  >
                    Enviar outra solicitação
                  </button>
                </div>
              ) : (
                <form onSubmit={onSubmit} noValidate className="space-y-5">
                  <div>
                    <label htmlFor="field-nome" className="mb-1.5 block text-xs font-semibold text-navyblue-800">
                      Nome completo
                    </label>
                    <input
                      id="field-nome"
                      type="text"
                      autoComplete="name"
                      value={values.nome}
                      onChange={(e) => update('nome', e.target.value)}
                      aria-invalid={!!errors.nome}
                      aria-describedby={errors.nome ? 'err-nome' : undefined}
                      className={`${baseInput} ${errors.nome ? invalidCls : ''}`}
                      placeholder="Como podemos te chamar?"
                    />
                    {errors.nome && <p id="err-nome" className="mt-1.5 text-xs font-medium text-danger">{errors.nome}</p>}
                  </div>

                  <div className="grid gap-5 sm:grid-cols-2">
                    <div>
                      <label htmlFor="field-telefone" className="mb-1.5 block text-xs font-semibold text-navyblue-800">
                        Telefone / WhatsApp
                      </label>
                      <input
                        id="field-telefone"
                        type="tel"
                        autoComplete="tel"
                        value={values.telefone}
                        onChange={(e) => update('telefone', e.target.value)}
                        aria-invalid={!!errors.telefone}
                        aria-describedby={errors.telefone ? 'err-telefone' : undefined}
                        className={`${baseInput} ${errors.telefone ? invalidCls : ''}`}
                        placeholder="(32) 99999-0000"
                      />
                      {errors.telefone && <p id="err-telefone" className="mt-1.5 text-xs font-medium text-danger">{errors.telefone}</p>}
                    </div>
                    <div>
                      <label htmlFor="field-email" className="mb-1.5 block text-xs font-semibold text-navyblue-800">
                        E-mail
                      </label>
                      <input
                        id="field-email"
                        type="email"
                        autoComplete="email"
                        value={values.email}
                        onChange={(e) => update('email', e.target.value)}
                        aria-invalid={!!errors.email}
                        aria-describedby={errors.email ? 'err-email' : undefined}
                        className={`${baseInput} ${errors.email ? invalidCls : ''}`}
                        placeholder="voce@email.com"
                      />
                      {errors.email && <p id="err-email" className="mt-1.5 text-xs font-medium text-danger">{errors.email}</p>}
                    </div>
                  </div>

                  <div>
                    <label htmlFor="field-exame" className="mb-1.5 block text-xs font-semibold text-navyblue-800">
                      Exame ou consulta
                    </label>
                    <select
                      id="field-exame"
                      value={values.exame}
                      onChange={(e) => update('exame', e.target.value)}
                      className={baseInput}
                    >
                      {exames.map((ex) => (
                        <option key={ex}>{ex}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="field-mensagem" className="mb-1.5 block text-xs font-semibold text-navyblue-800">
                      Mensagem <span className="font-normal text-gray-400">(opcional)</span>
                    </label>
                    <textarea
                      id="field-mensagem"
                      rows={3}
                      value={values.mensagem}
                      onChange={(e) => update('mensagem', e.target.value)}
                      className={`${baseInput} resize-none`}
                      placeholder="Conte-nos como podemos ajudar."
                    />
                  </div>

                  <button type="submit" disabled={status === 'sending'} className="cta-primary w-full text-base">
                    {status === 'sending' ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                        Enviando…
                      </>
                    ) : (
                      <>
                        <CalendarCheck className="h-5 w-5" aria-hidden />
                        Solicitar agendamento
                      </>
                    )}
                  </button>
                  <p className="text-center text-xs text-gray-400">
                    Seus dados estão seguros e são usados apenas para contato.
                  </p>
                </form>
              )}
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
