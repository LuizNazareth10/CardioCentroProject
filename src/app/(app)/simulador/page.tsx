'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

type Botao = { id: string; titulo: string };
type SecaoLista = { titulo: string; itens: Array<{ id: string; titulo: string; descricao?: string }> };
type MsgAgente =
  | { tipo: 'texto'; texto: string }
  | { tipo: 'botoes'; texto: string; botoes: Botao[] }
  | { tipo: 'lista'; texto: string; botaoLista: string; secoes: SecaoLista[] };

type Bolha =
  | { de: 'paciente'; texto: string }
  | { de: 'agente'; msg: MsgAgente }
  | { de: 'recepcao'; texto: string };

function novoTelefone() {
  return '5532' + Math.floor(900000000 + Math.random() * 99999999);
}

const SUGESTOES = ['Oi', 'Olá, gostaria de agendar um exame', 'Falar com atendente'];

export default function SimuladorPage() {
  const [telefone, setTelefone] = useState('');
  const [bolhas, setBolhas] = useState<Bolha[]>([]);
  const [texto, setTexto] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [etapa, setEtapa] = useState('inicio');
  const fimRef = useRef<HTMLDivElement>(null);
  const recepMostradas = useRef(0);

  useEffect(() => { setTelefone(novoTelefone()); }, []);
  useEffect(() => { fimRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [bolhas, carregando]);

  // durante o handoff, busca respostas da recepção (painel /atendimentos)
  useEffect(() => {
    if (etapa !== 'humano' || !telefone) return;
    const id = setInterval(async () => {
      const res = await fetch(`/api/atendimentos/${telefone}`);
      if (!res.ok) return;
      const { conversa } = await res.json();
      const recep = (conversa?.mensagens ?? []).filter((m: { de: string }) => m.de === 'recepcao');
      if (recep.length > recepMostradas.current) {
        const novas = recep.slice(recepMostradas.current);
        recepMostradas.current = recep.length;
        setBolhas((b) => [...b, ...novas.map((m: { texto: string }) => ({ de: 'recepcao' as const, texto: m.texto }))]);
      }
    }, 4000);
    return () => clearInterval(id);
  }, [etapa, telefone]);

  async function enviar(entrada: { tipo: 'texto' | 'interativo'; valor: string }, rotulo?: string) {
    if (carregando) return;
    setBolhas((b) => [...b, { de: 'paciente', texto: rotulo ?? entrada.valor }]);
    setCarregando(true);
    try {
      const res = await fetch('/api/whatsapp/simular', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telefone, ...entrada }),
      });
      const json = await res.json();
      const msgs: MsgAgente[] = json.mensagens ?? [];
      setBolhas((b) => [...b, ...msgs.map((msg) => ({ de: 'agente' as const, msg }))]);
      setEtapa(json.etapa ?? etapa);
    } finally {
      setCarregando(false);
    }
  }

  function enviarTexto(t: string) {
    const v = t.trim();
    if (!v) return;
    setTexto('');
    enviar({ tipo: 'texto', valor: v });
  }

  function reiniciar() {
    setTelefone(novoTelefone());
    setBolhas([]);
    setEtapa('inicio');
    recepMostradas.current = 0;
  }

  return (
    <div>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl font-bold tracking-tight text-navy-900">Simulador do WhatsApp</h1>
          <p className="text-sm text-muted">Teste o agente exatamente como o paciente veria — sem precisar da Meta.</p>
        </div>
        <button className="btn-outline" onClick={reiniciar}>↻ Novo paciente</button>
      </header>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_320px]">
        {/* telefone / chat */}
        <div className="mx-auto w-full max-w-md">
          <div className="overflow-hidden rounded-[2rem] border border-navy-100 bg-white shadow-lift">
            {/* topo estilo WhatsApp */}
            <div className="flex items-center gap-3 bg-navyblue px-4 py-3 text-white">
              <div className="grid h-9 w-9 place-items-center rounded-full bg-white/20 text-sm font-bold">CC</div>
              <div className="leading-tight">
                <div className="text-sm font-bold">Cardiocentro</div>
                <div className="text-[11px] text-white/70">assistente virtual</div>
              </div>
              <span className="ml-auto text-[11px] text-white/60">+{telefone}</span>
            </div>

            {/* mensagens */}
            <div className="h-[62vh] space-y-2 overflow-y-auto bg-[#ece5dd] p-4">
              {bolhas.length === 0 && (
                <div className="mt-6 text-center text-xs text-gray-500">
                  Envie uma mensagem para iniciar a conversa 👇
                </div>
              )}
              {bolhas.map((b, i) =>
                b.de === 'paciente' ? (
                  <div key={i} className="flex justify-end">
                    <div className="max-w-[80%] rounded-2xl rounded-tr-sm bg-[#dcf8c6] px-3 py-2 text-sm text-gray-800 shadow-sm">{b.texto}</div>
                  </div>
                ) : b.de === 'recepcao' ? (
                  <div key={i} className="flex justify-start">
                    <div className="max-w-[80%] rounded-2xl rounded-tl-sm bg-white px-3 py-2 text-sm text-gray-800 shadow-sm ring-1 ring-info/30">
                      <div className="mb-0.5 text-[10px] font-bold uppercase tracking-wide text-info">Recepção</div>
                      {b.texto}
                    </div>
                  </div>
                ) : (
                  <BolhaAgente key={i} msg={b.msg} onEscolha={(id, titulo) => enviar({ tipo: 'interativo', valor: id }, titulo)} carregando={carregando} />
                ),
              )}
              {carregando && (
                <div className="flex justify-start">
                  <div className="rounded-2xl rounded-tl-sm bg-white px-3 py-2 text-sm text-gray-400 shadow-sm">digitando…</div>
                </div>
              )}
              <div ref={fimRef} />
            </div>

            {/* input */}
            <form onSubmit={(e) => { e.preventDefault(); enviarTexto(texto); }} className="flex items-center gap-2 border-t border-navy-100 bg-white p-3">
              <input
                className="input flex-1"
                placeholder="Digite como o paciente…"
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                disabled={carregando}
              />
              <button className="btn-red" disabled={carregando || !texto.trim()}>Enviar</button>
            </form>
          </div>

          <div className="mt-3 flex flex-wrap justify-center gap-2">
            {SUGESTOES.map((s) => (
              <button key={s} onClick={() => enviarTexto(s)} disabled={carregando}
                className="rounded-full border border-navy-100 bg-white px-3 py-1.5 text-xs font-medium text-navy-700 hover:bg-navy-50">
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* painel lateral de ajuda */}
        <aside className="space-y-4">
          <div className="card p-5">
            <h3 className="font-bold text-navy-900">Como funciona</h3>
            <ul className="mt-3 space-y-2 text-sm text-ink/80">
              <li>• Este chat usa <strong>o mesmo motor</strong> do WhatsApp real — só não envia pela Meta.</li>
              <li>• Agendamentos confirmados aqui aparecem de verdade na <Link href="/agenda" className="font-semibold text-navy-700 hover:underline">Agenda</Link>.</li>
              <li>• Pedindo “falar com atendente”, a conversa vai para <Link href="/atendimentos" className="font-semibold text-navy-700 hover:underline">Atendimentos</Link> — responda de lá e a resposta aparece aqui.</li>
            </ul>
          </div>
          {etapa === 'humano' && (
            <div className="rounded-2xl border border-info/30 bg-info/5 p-4 text-sm text-navy-900">
              🙋 Conversa transferida para a recepção. Abra <Link href="/atendimentos" className="font-semibold text-info hover:underline">Atendimentos</Link>, responda a este paciente e a mensagem aparece no chat em alguns segundos.
            </div>
          )}
          <div className="card p-5">
            <h3 className="font-bold text-navy-900">Quando estiver satisfeito</h3>
            <p className="mt-2 text-sm text-ink/80">
              É só conectar um número na Meta (Cloud API) e preencher as variáveis
              <code className="mx-1 rounded bg-navy-50 px-1 text-xs">WHATSAPP_*</code>.
              A lógica não muda — o webhook chama exatamente este mesmo motor.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

function BolhaAgente({ msg, onEscolha, carregando }: { msg: MsgAgente; onEscolha: (id: string, titulo: string) => void; carregando: boolean }) {
  return (
    <div className="flex justify-start">
      <div className="max-w-[85%] space-y-2">
        <div className="whitespace-pre-line rounded-2xl rounded-tl-sm bg-white px-3 py-2 text-sm text-gray-800 shadow-sm">{msg.texto}</div>
        {msg.tipo === 'botoes' && (
          <div className="flex flex-col gap-1.5">
            {msg.botoes.map((b) => (
              <button key={b.id} disabled={carregando} onClick={() => onEscolha(b.id, b.titulo)}
                className="rounded-xl border border-navyblue-100 bg-white px-3 py-2 text-sm font-semibold text-navyblue-700 shadow-sm hover:bg-navyblue-50 disabled:opacity-50">
                {b.titulo}
              </button>
            ))}
          </div>
        )}
        {msg.tipo === 'lista' && (
          <div className="space-y-2">
            {msg.secoes.map((sec) => (
              <div key={sec.titulo} className="rounded-xl border border-navyblue-100 bg-white p-2 shadow-sm">
                <div className="px-1 pb-1 text-[11px] font-bold uppercase tracking-wide text-muted">{sec.titulo}</div>
                <div className="flex flex-col gap-1">
                  {sec.itens.map((it) => (
                    <button key={it.id} disabled={carregando} onClick={() => onEscolha(it.id, it.titulo)}
                      className="rounded-lg px-2.5 py-2 text-left text-sm text-navyblue-800 hover:bg-navyblue-50 disabled:opacity-50">
                      <div className={`break-words font-semibold leading-snug ${it.titulo.includes('/') ? 'text-xs' : 'text-sm'}`}>{it.titulo}</div>
                      {it.descricao && <div className="mt-0.5 break-words text-xs text-muted">{it.descricao}</div>}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
