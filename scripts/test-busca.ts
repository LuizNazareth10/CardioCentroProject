/**
 * Testes da busca de pacientes (funções puras de src/lib/busca.ts).
 *
 * O que está sendo protegido aqui é a regra de negócio da recepção: achar o
 * paciente digitando do jeito que vier — nome fora de ordem ou sem o nome do
 * meio, CPF/telefone com ou sem pontuação, data de nascimento em qualquer
 * formato. Rodar com `npm run test:busca`.
 */
import {
  chaveDeConsultaNome,
  chavesDoNome,
  datasCandidatas,
  interpretarBusca,
  nomeCasaTokens,
  normalizarBusca,
} from '../src/lib/busca';

let falhas = 0;
function check(nome: string, cond: boolean) {
  console.log(`${cond ? '✅' : '❌'} ${nome}`);
  if (!cond) falhas++;
}

// ---------------------------------------------------------------
// Simula a busca real: a consulta ao Firestore é `array-contains` da chave
// mais seletiva; o refinamento (prefixo de cada palavra) roda em memória.
// ---------------------------------------------------------------
function acha(nomeCadastrado: string, digitado: string): boolean {
  const b = interpretarBusca(digitado);
  if (b.tipo !== 'nome') return false;
  const chaves = chavesDoNome(nomeCadastrado);
  const nomeNorm = normalizarBusca(nomeCadastrado);

  // (A) prefixo do nome completo
  if (nomeNorm.startsWith(b.texto)) return true;
  // (B) chave seletiva (par das duas maiores palavras, ou a palavra única)
  const chave = chaveDeConsultaNome(b.tokens);
  if (chave && chaves.includes(chave) && nomeCasaTokens(nomeNorm, b.tokens)) return true;
  // (C) plano B: maior palavra + refinamento
  const maior = [...b.tokens].sort((x, y) => y.length - x.length)[0];
  return !!maior && chaves.includes(maior) && nomeCasaTokens(nomeNorm, b.tokens);
}

const LUIZ = 'Luiz Gustavo Ferreira';
const JOSE = 'José da Silva Antônio Neto';

// ---- 1: o caso pedido pela clínica — pular o nome do meio ----
check('“luiz ferreira” acha Luiz Gustavo Ferreira', acha(LUIZ, 'luiz ferreira'));
check('ordem invertida também acha', acha(LUIZ, 'ferreira luiz'));
check('nome completo acha', acha(LUIZ, 'luiz gustavo ferreira'));
check('só o sobrenome acha', acha(LUIZ, 'ferreira'));

// ---- 2: normalização (acento, caixa, pontuação, espaço extra) ----
check('sem acento acha nome acentuado', acha(JOSE, 'jose antonio'));
check('CAIXA ALTA acha', acha(JOSE, 'JOSE SILVA'));
check('espaços extras não atrapalham', acha(LUIZ, '  luiz   ferreira '));
check('acento digitado acha cadastro sem acento', acha('Luiz Gustavo Ferreira', 'lúiz ferreira'));

// ---- 3: palavra digitada pela metade ----
check('“luiz ferr” acha (prefixo indexado)', acha(LUIZ, 'luiz ferr'));
check('“gust ferreira” acha', acha(LUIZ, 'gust ferreira'));
check('“ana s” acha Ana Silva (prefixo do nome completo)', acha('Ana Silva Costa', 'ana s'));

// ---- 4: não pode achar quem não casa ----
check('nome de outra pessoa NÃO casa', !acha(LUIZ, 'luiz pereira'));
check('sobrenome de outra pessoa NÃO casa', !acha(JOSE, 'silva ferreira'));

// ---- 5: classificação do que foi digitado ----
check('CPF pontuado vira busca numérica', interpretarBusca('123.456.789-00').tipo === 'numero');
check('CPF pontuado normaliza para dígitos', interpretarBusca('123.456.789-00').digitos === '12345678900');
check('telefone com DDD vira busca numérica', interpretarBusca('(32) 99995-2138').digitos === '32999952138');
check('nome com número ainda é nome', interpretarBusca('maria 2').tipo === 'nome');
check('1 ou 2 dígitos não disparam busca (nem listam todos)', interpretarBusca('32').tipo === 'curta');
check('campo vazio lista a base paginada', interpretarBusca('   ').tipo === 'vazio');

// ---- 6: data de nascimento em vários formatos ----
const ISO = '1980-05-10';
check('10/05/1980 → ISO', datasCandidatas('10/05/1980').includes(ISO));
check('10-05-1980 → ISO', datasCandidatas('10-05-1980').includes(ISO));
check('10.5.1980 → ISO', datasCandidatas('10.5.1980').includes(ISO));
check('1980-05-10 → ISO', datasCandidatas('1980-05-10').includes(ISO));
check('10051980 (sem separador) → ISO', datasCandidatas('10051980').includes(ISO));
check('10/05/80 (ano curto) → ISO', datasCandidatas('10/05/80').includes(ISO));
check('data inválida (32/13) é descartada', datasCandidatas('32/13/1980').length === 0);
check('30/02 (dia inexistente) é descartado', datasCandidatas('30/02/1980').length === 0);
check('data também é buscada junto do CPF quando ambíguo', interpretarBusca('10051980').datas.includes(ISO));

// ---- 7: chaves gravadas no índice ----
const chaves = chavesDoNome(LUIZ);
check('índice guarda o par alfabético das palavras', chaves.includes('ferreira|luiz'));
check('índice guarda prefixos a partir de 3 letras', chaves.includes('fer') && chaves.includes('ferr'));
check('índice NÃO guarda prefixo de 2 letras', !chaves.includes('fe'));
check('consulta de 2 palavras usa o par das maiores', chaveDeConsultaNome(['luiz', 'ferreira']) === 'ferreira|luiz');
check('consulta de 1 palavra usa a própria palavra', chaveDeConsultaNome(['ferreira']) === 'ferreira');

console.log('\nResumo:', falhas === 0 ? 'TODOS OS TESTES PASSARAM 🎉' : `${falhas} falha(s)`);
process.exit(falhas === 0 ? 0 : 1);
