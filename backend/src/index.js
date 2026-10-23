import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { google } from 'googleapis';
import { createApp } from './app.js';
import { createAuthMiddleware } from './auth.js';
import { SheetsStore } from './sheets-store.js';

const required = (name) => { const value = process.env[name]; if (!value) throw new Error(`Variável ${name} ausente.`); return value; };
const projectId = required('FIREBASE_PROJECT_ID');
if (!getApps().length) initializeApp({ credential: applicationDefault(), projectId });
const googleAuth = new google.auth.GoogleAuth({ scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
const sheets = google.sheets({ version: 'v4', auth: googleAuth });
const store = new SheetsStore(sheets, required('GOOGLE_SHEET_ID')); await store.ensureSchema();
const allowedUids = new Set(required('ALLOWED_FIREBASE_UIDS').split(',').map((item) => item.trim()).filter(Boolean));
const allowedOrigins = new Set(required('ALLOWED_ORIGINS').split(',').map((item) => item.trim().replace(/\/$/, '')).filter(Boolean));
const app = createApp({ store, authMiddleware: createAuthMiddleware(getAuth(), allowedUids), allowedOrigins });
app.listen(Number(process.env.PORT || 8080), () => console.log('Backend iniciado.'));
