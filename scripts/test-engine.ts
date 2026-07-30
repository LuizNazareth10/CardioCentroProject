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

// ---- 5: sessão Eco+Carótida com o MESMO médico ----
// Sem buraco entre os exames: ou um começa exatamente quando o anterior
// termina, ou os dois ocupam o MESMO horário (combinação do médico — o
// Dr. Daher faz eco + carótida em 15min; ver bloco 12).
const sessao = proporSessao([exame('eco-doppler'), exame('duplex-carotidas')], MEDICOS, [], { dataInicio: SEG, dias: 2 });
check('Sessão de 2 exames retorna proposta', sessao !== null);
check('Sessão prioriza o MESMO médico', sessao?.mesmoMedico === true);
check('Exames da sessão ficam colados (ou no mesmo horário)', (() => {
  if (!sessao) return false;
  for (let i = 1; i < sessao.itens.length; i++) {
    const anterior = sessao.itens[i - 1];
    const atual = sessao.itens[i];
    const colado = atual.inicio === anterior.fim;
    const juntos = atual.inicio === anterior.inicio && atual.fim === anterior.fim;
    if (!colado && !juntos) return false;
  }
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

// ---- 12: REGRA DR. RICARDO DAHER — eco + carótida no MESMO horário ----
// Ele executa os dois juntos em 15min (não 15 + 15). Vale só para ele.
const duracaoMin = (i: { inicio: string; fim: string }) =>
  (Number(i.fim.slice(11, 13)) * 60 + Number(i.fim.slice(14, 16))) -
  (Number(i.inicio.slice(11, 13)) * 60 + Number(i.inicio.slice(14, 16)));

const comboDaher = proporSessao([exame('eco-doppler'), exame('duplex-carotidas')], MEDICOS, [], {
  dataInicio: SEG, dias: 1, medicoPreferidoId: 'med-daher',
});
check('Daher: eco + carótida começam no MESMO horário', comboDaher?.itens[0].inicio === comboDaher?.itens[1].inicio);
check('Daher: a dupla termina no mesmo horário', comboDaher?.itens[0].fim === comboDaher?.itens[1].fim);
check('Daher: a dupla ocupa 15min no total', duracaoMin(comboDaher!.itens[0]) === 15);
check('Proposta sinaliza que é combinada', comboDaher?.combinada === true);

// desligando a combinação (opção da tela de marcação) volta a somar 15 + 15
const semCombo = proporSessao([exame('eco-doppler'), exame('duplex-carotidas')], MEDICOS, [], {
  dataInicio: SEG, dias: 1, medicoPreferidoId: 'med-daher', combinar: false,
});
check('combinar=false coloca os exames em sequência', semCombo?.itens[1].inicio === semCombo?.itens[0].fim);
check('combinar=false não marca a proposta como combinada', semCombo?.combinada === false);

// a regra é SÓ do Daher — Zorzo continua somando (20 + 20 na quarta)
const comboZorzo = proporSessao([exame('eco-doppler'), exame('duplex-carotidas')], MEDICOS, [], {
  dataInicio: QUA_ATIVA, dias: 1, medicoPreferidoId: 'med-zorzo',
});
check('Zorzo NÃO combina: exames em sequência', comboZorzo?.itens[1].inicio === comboZorzo?.itens[0].fim);

// exame fora da combinação entra depois dela, em sequência
const trio = proporSessao([exame('eco-doppler'), exame('duplex-carotidas'), exame('ergometrico')], MEDICOS, [], {
  dataInicio: SEG, dias: 1, medicoPreferidoId: 'med-daher',
});
check('Daher: eco + carótida juntos e ergométrico depois', (() => {
  if (!trio || trio.itens.length !== 3) return false;
  const [eco1, caro1, ergo1] = trio.itens;
  return eco1.inicio === caro1.inicio && ergo1.inicio === eco1.fim;
})());

// o bloco combinado OCUPA o horário para os demais pacientes
const comboOcupado: Agendamento[] = ['eco-doppler', 'duplex-carotidas'].map((exameId, i) => ({
  id: `c${i}`, pacienteId: 'p', pacienteNome: 'Z', medicoId: 'med-daher', exameId,
  convenioId: 'particular', inicio: `${SEG}T13:30:00-03:00`, fim: `${SEG}T13:45:00-03:00`,
  status: 'agendado', origem: 'sistema', criadoEm: '',
}));
const aposCombo = gerarSlots(exame('eco-doppler'), MEDICOS, comboOcupado, {
  dataInicio: SEG, dias: 1, medicoPreferidoId: 'med-daher',
});
check('Horário combinado fica ocupado p/ outro paciente', !aposCombo.some((s) => s.inicio === `${SEG}T13:30:00-03:00`));
check('13:45 continua livre depois do bloco combinado', aposCombo.some((s) => s.inicio === `${SEG}T13:45:00-03:00`));

// ---- 13: horário que JÁ COMEÇOU não é ofertado ----
// O piso ("não antes de") vinha com os segundos descartados: às 13:30:31 o
// motor ainda oferecia o slot das 13:30, que já tinha começado.
const jaComecou = gerarSlots(exame('eco-doppler'), MEDICOS, [], {
  dataInicio: SEG, dias: 1, medicoPreferidoId: 'med-daher', naoAntesDe: `${SEG}T13:30:31-03:00`,
});
check('Slot que começou há segundos NÃO é ofertado', !jaComecou.some((s) => s.inicio === `${SEG}T13:30:00-03:00`));
check('O slot seguinte é ofertado normalmente', jaComecou.some((s) => s.inicio === `${SEG}T13:45:00-03:00`));
const noSegundoZero = gerarSlots(exame('eco-doppler'), MEDICOS, [], {
  dataInicio: SEG, dias: 1, medicoPreferidoId: 'med-daher', naoAntesDe: `${SEG}T13:30:00-03:00`,
});
check('No segundo exato do slot, ele ainda é ofertado', noSegundoZero.some((s) => s.inicio === `${SEG}T13:30:00-03:00`));

console.log('\nResumo:', falhas === 0 ? 'TODOS OS TESTES PASSARAM 🎉' : `${falhas} falha(s)`);
process.exit(falhas === 0 ? 0 : 1);
