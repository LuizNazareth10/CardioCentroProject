import type { App } from 'firebase-admin/app';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// =============================================================
// Conexão com o Firestore (GCP) via Firebase Admin SDK.
// Credenciais via GOOGLE_SERVICE_ACCOUNT_B64 (JSON em base64).
// Coleções: pacientes, agendamentos, triagens, usuarios.
// =============================================================

// Guardado em `globalThis` (não numa variável de módulo) porque o Fast
// Refresh do Next.js recarrega este arquivo em dev, o que reiniciaria o
// controle de estado a cada edição enquanto o Firestore em si (mantido
// internamente pelo SDK) continua vivo — chamar `.settings()` de novo
// nessa instância já configurada lança "Firestore has already been
// initialized".
const global_ = globalThis as unknown as { __cardiocentroFirestoreApp?: App; __cardiocentroFirestoreSettingsAplicados?: boolean };

function getApp(): App {
  if (global_.__cardiocentroFirestoreApp) return global_.__cardiocentroFirestoreApp;
  if (getApps().length) {
    global_.__cardiocentroFirestoreApp = getApps()[0]!;
    return global_.__cardiocentroFirestoreApp;
  }
  const b64 = process.env.GOOGLE_SERVICE_ACCOUNT_B64;
  if (!b64) throw new Error('GOOGLE_SERVICE_ACCOUNT_B64 não configurada');
  let serviceAccount: Record<string, unknown>;
  try {
    serviceAccount = JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
  } catch {
    // erro comum: colaram o conteúdo de serviceAccount.json (JSON cru) em vez
    // do arquivo já convertido para base64 (serviceAccount.b64.txt).
    throw new Error(
      'GOOGLE_SERVICE_ACCOUNT_B64 inválida — não decodifica para JSON. ' +
        'Confirme que colou o CONTEÚDO BASE64 (ex.: serviceAccount.b64.txt), e não o JSON cru da service account.',
    );
  }
  global_.__cardiocentroFirestoreApp = initializeApp({
    credential: cert(serviceAccount as never),
    projectId: process.env.GCP_PROJECT_ID,
  });
  return global_.__cardiocentroFirestoreApp;
}

export function db() {
  const firestore = getFirestore(getApp());
  if (!global_.__cardiocentroFirestoreSettingsAplicados) {
    global_.__cardiocentroFirestoreSettingsAplicados = true;
    try {
      // Nossos tipos usam campos opcionais como `undefined` (ex.: cpf, e-mail,
      // sinais vitais da triagem). Sem isso, o SDK rejeita o documento inteiro
      // com "Cannot use undefined as a Firestore value". Precisa ser chamado
      // uma única vez, antes do primeiro uso.
      firestore.settings({ ignoreUndefinedProperties: true });
    } catch (e) {
      // Em dev, o Fast Refresh pode reavaliar este módulo depois que o
      // próprio SDK (que vive fora do nosso controle de módulo) já aplicou
      // as settings numa recarga anterior. Nesse caso o erro é esperado e
      // inofensivo — a configuração já está valendo na instância.
      if (!(e instanceof Error) || !e.message.includes('already been initialized')) throw e;
    }
  }
  return firestore;
}
