import { APARELHOS, EXAMES, MEDICOS } from '../src/lib/seed-data';
import { gerarSlots, gerarSlotsAparelho, proporSessao } from '../src/lib/scheduling/engine';
import { semanaQuinzenalAtiva } from '../src/lib/scheduling/time';
import type { Agendamento } from '../src/lib/types';

const exame = (id: string) => EXAMES.find((e) => e.id === id)!;

// Datas fixas de referência (2026): 06/07 = segunda, 07/07 = terça,
// 08/07 = quarta (semana quinzenal ATIVA), 10/07 = sexta, 15/07 = quarta (OFF).
const SEG = '2026-07-06';
const TER = '2026-07-07';
const QUA_ATIVA = '2026-07-08';
const QUA_OFF = '2026-07-15';
const SEX = '2026-07-10';

let falhas = 0;
function check(nome: string, cond: boolean) {
  console.log(`${cond ? '✅' : '❌'} ${nome}`);
  if (!cond) falhas++;
}

// ---- 1: Eco gera slots na segunda (Daher + Lovisi atendem eco) ----
const eco = gerarSlots(exame('eco-doppler'), MEDICOS, [], { dataInicio: SEG, dias: 1 });
check('Eco gera slots na segunda', eco.length > 0);
check('Slots começam em múltiplo de 15min', eco.every((s) => Number(s.inicio.slice(14, 16)) % 15 === 0));

// ---- 2: conflito — ocupa 13:30–13:45 do Daher (seg tarde), não deve ofertar esse slot ----
// (usa o Daher porque a seg/sex do Lovisi têm a regra do cardiopulmonar — ver bloco 11)
const ocupado: Agendamento[] = [{
  id: 'a1', pacienteId: 'p', pacienteNome: 'X', medicoId: 'med-daher', exameId: 'eco-doppler',
  convenioId: 'particular', inicio: `${SEG}T13:30:00-03:00`, fim: `${SEG}T13:45:00-03:00`,
  status: 'agendado', origem: 'sistema', criadoEm: '',
}];
const comConflito = gerarSlots(exame('eco-doppler'), MEDICOS, ocupado, { dataInicio: SEG, dias: 1, medicoPreferidoId: 'med-daher' });
check('Slot 13:30 do Daher NÃO é ofertado (conflito)', !comConflito.some((s) => s.inicio === `${SEG}T13:30:00-03:00`));
check('Slot 13:45 do Daher É ofertado', comConflito.some((s) => s.inicio === `${SEG}T13:45:00-03:00`));

// ---- 3: médico de preferência respeitado ----
const pref = gerarSlots(exame('eco-doppler'), MEDICOS, [], { dataInicio: SEG, dias: 1, medicoPreferidoId: 'med-daher' });
check('Preferência por Daher só traz slots do Daher', pref.every((s) => s.medicoId === 'med-daher'));

// ---- 4: duração POR MÉDICO — Zorzo faz Eco em 20min (terça) ----
const ecoZorzo = gerarSlots(exame('eco-doppler'), MEDICOS, [], { dataInicio: TER, dias: 1, medicoPreferidoId: 'med-zorzo' });
check('Zorzo tem slots de Eco na terça', ecoZorzo.length > 0);
check('Eco do Zorzo dura 20min', ecoZorzo.every((s) => {
  const ini = Number(s.inicio.slice(11, 13)) * 60 + Number(s.inicio.slice(14, 16));
  const fim = Number(s.fim.slice(11, 13)) * 60 + Number(s.fim.slice(14, 16));
  return fim - ini === 20;
}));

// ---- 5: sessão Eco+Carótida com o MESMO médico (Daher, 15+15) ----
const sessao = proporSessao([exame('eco-doppler'), exame('duplex-carotidas')], MEDICOS, [], { dataInicio: SEG, dias: 2 });
check('Sessão de 2 exames retorna proposta', sessao !== null);
check('Sessão prioriza o MESMO médico', sessao?.mesmoMedico === true);
check('Exames da sessão são consecutivos', (() => {
  if (!sessao) return false;
  for (let i = 1; i < sessao.itens.length; i++) if (sessao.itens[i].inicio !== sessao.itens[i - 1].fim) return false;
  return true;
})());

// ---- 6: respeita "não antes de" ----
const futuro = gerarSlots(exame('eco-doppler'), MEDICOS, [], { dataInicio: SEG, dias: 1, medicoPreferidoId: 'med-daher', naoAntesDe: `${SEG}T15:00:00-03:00` });
check('Não oferta slots antes do horário-piso', futuro.every((s) => s.inicio >= `${SEG}T15:00:00-03:00`));

// ---- 7: QUINZENAL — Ergométrico da Fernanda na quarta ativa tem período da MANHÃ ----
const ergoAtiva = gerarSlots(exame('ergometrico'), MEDICOS, [], { dataInicio: QUA_ATIVA, dias: 1 });
const ergoOff = gerarSlots(exame('ergometrico'), MEDICOS, [], { dataInicio: QUA_OFF, dias: 1 });
const temManha = (arr: typeof ergoAtiva) => arr.some((s) => s.inicio.slice(11, 13) < '12');
check('Quarta ATIVA (08/07) tem ergométrico de manhã', temManha(ergoAtiva));
check('Quarta OFF (15/07) NÃO tem ergométrico de manhã', !temManha(ergoOff));
check('semanaQuinzenalAtiva estável no futuro (05/08/2026 ativa)', semanaQuinzenalAtiva('2026-08-05') === true);
check('semanaQuinzenalAtiva estável no futuro (12/08/2026 off)', semanaQuinzenalAtiva('2026-08-12') === false);

// ---- 8: APARELHOS — Mapa 4 slots na segunda, bloqueado na sexta ----
const mapaSeg = gerarSlotsAparelho(APARELHOS.mapa, [], { dataInicio: SEG, dias: 1 });
const mapaSex = gerarSlotsAparelho(APARELHOS.mapa, [], { dataInicio: SEX, dias: 1 });
check('Mapa oferta 4 slots na segunda', mapaSeg.length === 4);
check('Mapa BLOQUEADO na sexta', mapaSex.length === 0);

// ---- 9: APARELHO — capacidade 1 por slot (ocupado não reoferta) ----
const mapaOcup: Agendamento[] = [{
  id: 'm1', pacienteId: 'p', pacienteNome: 'Y', medicoId: 'mapa', exameId: 'mapa',
  convenioId: 'particular', inicio: `${SEG}T08:30:00-03:00`, fim: `${SEG}T08:45:00-03:00`,
  status: 'agendado', origem: 'sistema', criadoEm: '',
}];
const mapaAposOcup = gerarSlotsAparelho(APARELHOS.mapa, mapaOcup, { dataInicio: SEG, dias: 1 });
check('Slot 08:30 do Mapa não reoferta quando ocupado', !mapaAposOcup.some((s) => s.inicio === `${SEG}T08:30:00-03:00`));
check('Mapa mantém os outros 3 slots livres', mapaAposOcup.length === 3);

// ---- 10: exame só é ofertado por quem realmente o faz naquela janela ----
// Cardiopulmonar só existe com Lovisi (seg/sex manhã); na quarta ele NÃO oferece.
const cpQuaAtiva = gerarSlots(exame('cardiopulmonar'), MEDICOS, [], { dataInicio: QUA_ATIVA, dias: 1 });
check('Cardiopulmonar NÃO é ofertado na quarta (Lovisi só faz eco/caró)', cpQuaAtiva.length === 0);

// ---- 11: REGRA DR. JÚLIO LOVISI — seg/sex exigem o cardiopulmonar ----
// Nas janelas de seg e sex do Lovisi, eco/carótida só entram ACOMPANHANDO o
// cardiopulmonar; nunca sozinhos. Nas OUTRAS janelas/médicos, eco segue normal.
const ecoSegLovisi = gerarSlots(exame('eco-doppler'), MEDICOS, [], { dataInicio: SEG, dias: 1, medicoPreferidoId: 'med-lovisi' });
check('Eco SOZINHO na seg NÃO usa a janela do Lovisi', ecoSegLovisi.length === 0);
const caroSexLovisi = gerarSlots(exame('duplex-carotidas'), MEDICOS, [], { dataInicio: SEX, dias: 1, medicoPreferidoId: 'med-lovisi' });
check('Carótida SOZINHA na sex NÃO usa a janela do Lovisi', caroSexLovisi.length === 0);

const cpSegLovisi = gerarSlots(exame('cardiopulmonar'), MEDICOS, [], { dataInicio: SEG, dias: 1, medicoPreferidoId: 'med-lovisi' });
check('Cardiopulmonar SOZINHO na seg É ofertado pelo Lovisi', cpSegLovisi.length > 0);

const cpMaisEco = proporSessao([exame('cardiopulmonar'), exame('eco-doppler')], MEDICOS, [], { dataInicio: SEG, dias: 1, medicoPreferidoId: 'med-lovisi' });
check('Sessão Cardiopulmonar+Eco na seg é permitida (mesmo médico)', cpMaisEco !== null && cpMaisEco.mesmoMedico);

const ecoMaisCaro = proporSessao([exame('eco-doppler'), exame('duplex-carotidas')], MEDICOS, [], { dataInicio: SEG, dias: 1, medicoPreferidoId: 'med-lovisi' });
check('Sessão Eco+Carótida (sem cardiopulmonar) NÃO é agendada com Lovisi na seg', ecoMaisCaro === null);

// eco continua disponível com OUTRO médico na segunda (Daher, tarde)
const ecoSegQualquer = gerarSlots(exame('eco-doppler'), MEDICOS, [], { dataInicio: SEG, dias: 1 });
check('Eco sozinho na seg AINDA é ofertado por outro médico (Daher)', ecoSegQualquer.some((s) => s.medicoId === 'med-daher'));

console.log('\nResumo:', falhas === 0 ? 'TODOS OS TESTES PASSARAM 🎉' : `${falhas} falha(s)`);
process.exit(falhas === 0 ? 0 : 1);
