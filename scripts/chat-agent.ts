/**
 * Simulador de conversa com o agente do WhatsApp — 100% local, SEM
 * depender da Meta/WhatsApp Cloud API. Fala diretamente com a mesma
 * lógica (`processarMensagem`) que o webhook real usa.
 *
 * Uso:
 *   npm run chat-agent
 *
 * Se .env.local tiver DATA_BACKEND=firestore, os agendamentos e o
 * handoff humano criados aqui aparecem de verdade no painel web
 * (/agenda, /dashboard, /atendimentos) — ótimo para validar o agente
 * ponta a ponta antes de conectar um número real da Meta.
 *
 * Comandos especiais (além de digitar texto livre, como um paciente):
 *   /click <id>      simula clicar num botão ou item de lista (o id
 *                     aparece entre colchetes nas opções do agente)
 *   /foto <caminho>   simula enviar uma foto de pedido médico (lê um
 *                     arquivo local .jpg/.png do seu computador)
 *   /novo             recomeça como se fosse outro paciente (novo telefone)
 *   /sair             encerra o simulador
 */
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { createInterface } from 'readline/promises';
import { processarMensagem } from '../src/lib/whatsapp/agent';

// carrega .env.local manualmente (funciona igual em bash/PowerShell)
function carregarEnvLocal() {
  const p = join(process.cwd(), '.env.local');
  if (!existsSync(p)) return;
  for (const linha of readFileSync(p, 'utf8').split('\n')) {
    const m = linha.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}
carregarEnvLocal();

const backend = process.env.DATA_BACKEND ?? 'memory';
console.log(`\n💬 Simulador do agente Cardiocentro (backend: ${backend})`);
if (backend !== 'firestore') {
  console.log('   Dica: rode com DATA_BACKEND=firestore no .env.local para ver os');
  console.log('   agendamentos/handoff aparecerem de verdade no painel web.');
}
console.log('   Comandos: /click <id>  ·  /foto <caminho>  ·  /novo  ·  /sair\n');

let telefone = numeroFake();
function numeroFake() {
  return '5599' + Math.floor(100000000 + Math.random() * 899999999);
}

// -------- formata o que o agente "enviaria" como bolhas de chat --------
const origLog = console.log;
console.log = (...args: unknown[]) => {
  if (args[0] === '[whatsapp:dev] enviaria →') {
    try {
      imprimirMensagemAgente(JSON.parse(args[1] as string));
      return;
    } catch {
      /* payload não era JSON — cai pro log normal */
    }
  }
  origLog(...args);
};

function imprimirMensagemAgente(payload: any) {
  origLog('\n🤖 Cardiocentro:');
  if (payload.type === 'text') {
    origLog('   ' + payload.text.body.replace(/\n/g, '\n   '));
    return;
  }
  if (payload.type === 'interactive' && payload.interactive.type === 'button') {
    origLog('   ' + payload.interactive.body.text.replace(/\n/g, '\n   '));
    origLog('   Botões:');
    for (const b of payload.interactive.action.buttons) {
      origLog(`     [${b.reply.id}] ${b.reply.title}`);
    }
    return;
  }
  if (payload.type === 'interactive' && payload.interactive.type === 'list') {
    origLog('   ' + payload.interactive.body.text.replace(/\n/g, '\n   '));
    for (const sec of payload.interactive.action.sections) {
      origLog(`   ${sec.title}:`);
      for (const row of sec.rows) {
        origLog(`     [${row.id}] ${row.title}${row.description ? ` — ${row.description}` : ''}`);
      }
    }
    return;
  }
  origLog('   ' + JSON.stringify(payload));
}

async function main() {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  console.log(`📱 Simulando o paciente no número ${telefone}. Digite "oi" para começar.\n`);

  while (true) {
    const linha = (await rl.question('Você (paciente): ')).trim();
    if (!linha) continue;

    if (linha === '/sair') break;

    if (linha === '/novo') {
      telefone = numeroFake();
      console.log(`\n🔄 Novo paciente simulado: ${telefone}\n`);
      continue;
    }

    if (linha.startsWith('/click ')) {
      const id = linha.slice('/click '.length).trim();
      await processarMensagem(telefone, { tipo: 'interativo', valor: id });
      continue;
    }

    if (linha.startsWith('/foto ')) {
      const caminho = linha.slice('/foto '.length).trim();
      if (!existsSync(caminho)) {
        console.log(`\n⚠️  Arquivo não encontrado: ${caminho}\n`);
        continue;
      }
      await processarMensagem(telefone, { tipo: 'imagem', valor: `local:${caminho}` });
      continue;
    }

    await processarMensagem(telefone, { tipo: 'texto', valor: linha });
  }

  rl.close();
  console.log('\n👋 Simulador encerrado.');
  process.exit(0);
}

main();
