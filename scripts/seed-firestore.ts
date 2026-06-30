/**
 * Popula o Firestore com os dados iniciais da clínica.
 * Rodar UMA VEZ após criar o banco em produção.
 *
 * Requer: GOOGLE_SERVICE_ACCOUNT_B64 e GCP_PROJECT_ID no ambiente.
 *
 *   npm run seed
 */
import { cert, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import bcrypt from 'bcryptjs';
import { CONVENIOS, EXAMES, MEDICOS } from '../src/lib/seed-data';

const b64 = process.env.GOOGLE_SERVICE_ACCOUNT_B64;
if (!b64) throw new Error('GOOGLE_SERVICE_ACCOUNT_B64 não definida');

const app = initializeApp({
  credential: cert(JSON.parse(Buffer.from(b64, 'base64').toString('utf8'))),
  projectId: process.env.GCP_PROJECT_ID,
});
const db = getFirestore(app);

async function seed() {
  console.log('Iniciando seed do Firestore…');
  const batch = db.batch();

  // Usuário admin
  const senhaHash = bcrypt.hashSync('cardio123', 10);
  batch.set(db.collection('usuarios').doc('user_admin'), {
    id: 'user_admin',
    nome: 'Recepção CardioCentro',
    email: 'admin@cardiocentro.com',
    papel: 'admin',
    senhaHash,
    ativo: true,
  });

  await batch.commit();
  console.log('✅ Usuário admin criado (troque a senha em produção!)');
  console.log('ℹ️  Exames, convênios e médicos são carregados de seed-data.ts (estático).');
  console.log('   Edite src/lib/seed-data.ts com os dados reais e redeploy.');
  console.log('Seed concluído.');
  process.exit(0);
}

seed().catch((e) => { console.error(e); process.exit(1); });
