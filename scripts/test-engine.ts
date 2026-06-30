import { EXAMES, MEDICOS } from '../src/lib/seed-data';
import { gerarSlots, proporSessao } from '../src/lib/scheduling/engine';
import type { Agendamento } from '../src/lib/types';

const exame = (id: string) => EXAMES.find((e) => e.id === id)!;

// Usamos uma segunda-feira fixa para o teste: 2026-07-06 é segunda.
const SEG = '2026-07-06';

let falhas = 0;
function check(nome: string, cond: boolean) {
  console.log(`${cond ? '✅' : '❌'} ${nome}`);
  if (!cond) falhas++;
}

// ---- Cenário 1: slots de um ECG (15min) sem agenda ocupada ----
const slotsEcg = gerarSlots(exame('ecg'), MEDICOS, [], { dataInicio: SEG, dias: 1 });
check('ECG gera slots na segunda', slotsEcg.length > 0);
check('Todos os slots começam em múltiplo de 15min', slotsEcg.every((s) => Number(s.inicio.slice(14, 16)) % 15 === 0));

// ---- Cenário 2: conflito — ocupa 08:00–08:15 do med-1, não deve ofertar esse slot ----
const ocupado: Agendamento[] = [
  {
    id: 'a1', pacienteId: 'p', pacienteNome: 'X', medicoId: 'med-1', exameId: 'ecg',
    convenioId: 'particular', inicio: `${SEG}T08:00:00-03:00`, fim: `${SEG}T08:15:00-03:00`,
    status: 'agendado', origem: 'sistema', criadoEm: '',
  },
];
const slotsComConflito = gerarSlots(exame('ecg'), MEDICOS, ocupado, { dataInicio: SEG, dias: 1, medicoPreferidoId: 'med-1' });
check('Slot 08:00 do med-1 NÃO é ofertado (conflito)', !slotsComConflito.some((s) => s.inicio === `${SEG}T08:00:00-03:00`));
check('Slot 08:15 do med-1 É ofertado', slotsComConflito.some((s) => s.inicio === `${SEG}T08:15:00-03:00`));

// ---- Cenário 3: médico de preferência respeitado ----
const slotsPref = gerarSlots(exame('consulta'), MEDICOS, [], { dataInicio: SEG, dias: 1, medicoPreferidoId: 'med-2' });
check('Preferência por med-2 só traz slots do med-2', slotsPref.every((s) => s.medicoId === 'med-2'));

// ---- Cenário 4: 3 exames consecutivos (15+15+15) devem cair no MESMO médico ----
const sessao = proporSessao([exame('ecg'), exame('ecg'), exame('mapa')], MEDICOS, [], { dataInicio: SEG, dias: 1 });
check('Sessão de 3 exames retorna proposta', sessao !== null);
check('Sessão prioriza o MESMO médico', sessao!.mesmoMedico === true);
check('Exames da sessão são consecutivos no tempo', (() => {
  for (let i = 1; i < sessao!.itens.length; i++) {
    if (sessao!.itens[i].inicio !== sessao!.itens[i - 1].fim) return false;
  }
  return true;
})());

// ---- Cenário 5: respeita "não antes de" (agora) ----
const slotsFuturo = gerarSlots(exame('ecg'), MEDICOS, [], {
  dataInicio: SEG, dias: 1, medicoPreferidoId: 'med-1', naoAntesDe: `${SEG}T10:00:00-03:00`,
});
check('Não oferta slots antes do horário-piso', slotsFuturo.every((s) => s.inicio >= `${SEG}T10:00:00-03:00`));

console.log('\nResumo:', falhas === 0 ? 'TODOS OS TESTES PASSARAM 🎉' : `${falhas} falha(s)`);
process.exit(falhas === 0 ? 0 : 1);
