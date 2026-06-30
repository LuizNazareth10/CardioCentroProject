import type { App } from 'firebase-admin/app';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// =============================================================
// Conexão com o Firestore (GCP) via Firebase Admin SDK.
// Credenciais via GOOGLE_SERVICE_ACCOUNT_B64 (JSON em base64).
// Coleções: pacientes, agendamentos, triagens, usuarios.
// =============================================================

let app: App | undefined;

function getApp(): App {
  if (app) return app;
  if (getApps().length) {
    app = getApps()[0]!;
    return app;
  }
  const b64 = process.env.GOOGLE_SERVICE_ACCOUNT_B64;
  if (!b64) throw new Error('GOOGLE_SERVICE_ACCOUNT_B64 não configurada');
  const serviceAccount = JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
  app = initializeApp({
    credential: cert(serviceAccount),
    projectId: process.env.GCP_PROJECT_ID,
  });
  return app;
}

export function db() {
  return getFirestore(getApp());
}
