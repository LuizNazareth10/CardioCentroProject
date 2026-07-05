'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import {
  MapPin, Phone, Mail, Clock, CalendarCheck, CheckCircle2, Loader2,
  MessageCircle, Navigation, AlertCircle,
} from 'lucide-react';
import { Reveal } from './Reveal';
import { contato, whatsappLink, examesAgendamento } from './content';

type Fields = {
  nome: string; telefone: string; email: string; exame: string;
  dataPreferencial: string; turnoPreferencial: string; mensagem: string;
};
type Errors = Partial<Record<keyof Fields, string>>;

const exames = examesAgendamento;

const contatos = [
  { icon: MapPin, title: 'Endereço', lines: [contato.endereco, contato.bairro] },
  { icon: Phone, title: 'Telefone fixo', lines: [contato.telefoneFixo] },
  { icon: MessageCircle, title: 'WhatsApp', lines: [contato.whatsapp, contato.whatsappDescricao] },
  { icon: Mail, title: 'E-mail', lines: [contato.email] },
  { icon: Clock, title: 'Horário de atendimento', lines: contato.horarios },
];

const mapaSrc = `https://maps.google.com/maps?q=${encodeURIComponent(
  contato.mapaQuery,
)}&t=&z=16&ie=UTF8&iwloc=&output=embed`;

const rotaHref = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(contato.mapaQuery)}`;

/** máscara BR progressiva: (32) 99999-9999 */
function mascararTelefone(valor: string): string {
  const d = valor.replace(/\D/g, '').slice(0, 11);
  if (d.length === 0) return '';
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

function hojeISO(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}

export function Agendamento() {
  const [values, setValues] = useState<Fields>({
    nome: '', telefone: '', email: '', exame: exames[0],
    dataPreferencial: '', turnoPreferencial: 'indiferente', mensagem: '',
  });
  const [errors, setErrors] = useState<Errors>({});
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [erroEnvio, setErroEnvio] = useState('');
  // honeypot anti-bot: humanos nunca veem/preenchem este campo
  const [site, setSite] = useState('');

  function update<K extends keyof Fields>(key: K, val: string) {
    setValues((v) => ({ ...v, [key]: key === 'telefone' ? mascararTelefone(val) : val }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  }

  function validate(): Errors {
    const e: Errors = {};
    if (values.nome.trim().length < 3) e.nome = 'Informe seu nome completo.';
    const digitos = values.telefone.replace(/\D/g, '');
    if (digitos.length < 10) e.telefone = 'Informe DDD e número (ex.: (32) 99999-0000).';
    if (values.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) e.email = 'E-mail inválido.';
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
    setErroEnvio('');
    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: values.nome,
          telefone: values.telefone,
          email: values.email || undefined,
          exame: values.exame,
          dataPreferencial: values.dataPreferencial || undefined,
          turnoPreferencial: values.turnoPreferencial,
          mensagem: values.mensagem || undefined,
          site, // honeypot
        }),
      });
      if (res.ok) {
        setStatus('success');
        return;
      }
      const corpo = await res.json().catch(() => null);
      setErroEnvio(corpo?.erro ?? 'Não foi possível enviar agora. Tente novamente em instantes.');
      setStatus('error');
    } catch {
      setErroEnvio('Falha de conexão. Verifique sua internet e tente novamente.');
      setStatus('error');
    }
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
              confirmar o melhor horário — sem burocracia. Respondemos em
              horário comercial, geralmente em poucas horas.
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
              <a
                href={rotaHref}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 bg-white px-4 py-3 text-sm font-semibold text-navyblue-700 transition-colors hover:bg-navyblue-50"
              >
                <Navigation className="h-4 w-4" aria-hidden />
                Como chegar — abrir no Google Maps
              </a>
            </div>
          </Reveal>

          {/* formulário */}
          <Reveal direction="left">
            <div className="glass rounded-[2rem] p-7 shadow-glass sm:p-9">
              {status !== 'success' && (
                <h3 className="mb-6 font-serif text-2xl font-bold tracking-tight text-navyblue-900">
                  Agende aqui
                </h3>
              )}
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
                    contato em horário comercial para confirmar seu agendamento.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setValues({
                        nome: '', telefone: '', email: '', exame: exames[0],
                        dataPreferencial: '', turnoPreferencial: 'indiferente', mensagem: '',
                      });
                      setStatus('idle');
                    }}
                    className="cta-ghost mt-8"
                  >
                    Enviar outra solicitação
                  </button>
                </div>
              ) : (
                <form onSubmit={onSubmit} noValidate className="space-y-5">
                  {/* honeypot — invisível para pessoas, atraente para bots */}
                  <div className="absolute -left-[9999px] top-auto h-px w-px overflow-hidden" aria-hidden="true">
                    <label htmlFor="field-site">Não preencha este campo</label>
                    <input
                      id="field-site"
                      type="text"
                      tabIndex={-1}
                      autoComplete="off"
                      value={site}
                      onChange={(e) => setSite(e.target.value)}
                    />
                  </div>

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
                        inputMode="tel"
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
                        E-mail <span className="font-normal text-gray-400">(opcional)</span>
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

                  <div className="grid gap-5 sm:grid-cols-2">
                    <div>
                      <label htmlFor="field-dataPreferencial" className="mb-1.5 block text-xs font-semibold text-navyblue-800">
                        Data preferencial <span className="font-normal text-gray-400">(opcional)</span>
                      </label>
                      <input
                        id="field-dataPreferencial"
                        type="date"
                        min={hojeISO()}
                        value={values.dataPreferencial}
                        onChange={(e) => update('dataPreferencial', e.target.value)}
                        className={baseInput}
                      />
                    </div>
                    <div>
                      <label htmlFor="field-turnoPreferencial" className="mb-1.5 block text-xs font-semibold text-navyblue-800">
                        Turno preferencial
                      </label>
                      <select
                        id="field-turnoPreferencial"
                        value={values.turnoPreferencial}
                        onChange={(e) => update('turnoPreferencial', e.target.value)}
                        className={baseInput}
                      >
                        <option value="indiferente">Sem preferência</option>
                        <option value="manha">Manhã</option>
                        <option value="tarde">Tarde</option>
                      </select>
                    </div>
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

                  {status === 'error' && (
                    <p role="alert" className="flex items-start gap-2 rounded-xl bg-danger/10 px-4 py-3 text-sm font-medium text-danger">
                      <AlertCircle className="mt-0.5 h-4 w-4 flex-none" aria-hidden />
                      {erroEnvio}
                    </p>
                  )}

                  <button type="submit" disabled={status === 'sending'} className="cta-primary w-full text-base">
                    {status === 'sending' ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                        Enviando…
                      </>
                    ) : (
                      <>
                        <CalendarCheck className="h-5 w-5" aria-hidden />
                        Quero agendar meu exame
                      </>
                    )}
                  </button>
                  <p className="text-center text-xs text-gray-400">
                    Seus dados são usados apenas para contato sobre o agendamento,
                    conforme nossa{' '}
                    <Link href="/privacidade" className="underline hover:text-navyblue-700">
                      Política de Privacidade
                    </Link>.
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
