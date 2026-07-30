import { numeroPermitido, variantesBr } from '../src/lib/whatsapp/evolution-numeros';

let falhas = 0;
function check(nome: string, condicao: boolean) {
  console.log(`${condicao ? '✅' : '❌'} ${nome}`);
  if (!condicao) falhas++;
}

const permitidoSemNonoDigito = '553284170214';
const permitidoComNonoDigito = '5532984170214';
const outroNumero = '5532984170215';

check('Aceita o número exato da allowlist', numeroPermitido(permitidoSemNonoDigito, [permitidoSemNonoDigito]));
check('Aceita o mesmo número recebido com 9º dígito', numeroPermitido(permitidoComNonoDigito, [permitidoSemNonoDigito]));
check('Aceita allowlist formatada com espaços e símbolos', numeroPermitido(permitidoComNonoDigito, ['+55 (32) 8417-0214']));
check('Rejeita qualquer outro número', !numeroPermitido(outroNumero, [permitidoSemNonoDigito]));
check('Rejeita quando a allowlist está vazia', !numeroPermitido(permitidoSemNonoDigito, []));
check('Gera variantes com e sem DDI/9º dígito', variantesBr(permitidoSemNonoDigito).includes(permitidoComNonoDigito));

console.log('\nResumo:', falhas === 0 ? 'TODOS OS TESTES PASSARAM 🎉' : `${falhas} falha(s)`);
process.exit(falhas === 0 ? 0 : 1);
