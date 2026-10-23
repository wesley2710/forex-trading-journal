import { google } from 'googleapis';
import { SheetsStore } from '../src/sheets-store.js';
const spreadsheetId = process.env.GOOGLE_SHEET_ID;
if (!spreadsheetId) throw new Error('Defina GOOGLE_SHEET_ID.');
const auth = new google.auth.GoogleAuth({ scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
const store = new SheetsStore(google.sheets({ version: 'v4', auth }), spreadsheetId);
await store.ensureSchema();
console.log('Schema v2 criado/validado com sucesso.');
