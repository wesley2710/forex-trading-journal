import { emptyDatabase, migrate } from '../domain/schema.js';
import { validateDatabase } from '../domain/validation.js';

const KEY = 'forex-journal-v2';
const LEGACY_KEY = 'forex-journal-v1';

export class LocalRepository {
  load() {
    try {
      const current = localStorage.getItem(KEY);
      const legacy = localStorage.getItem(LEGACY_KEY);
      const db = migrate(JSON.parse(current || legacy || 'null'));
      validateDatabase(db);
      if (!current && legacy) this.save(db);
      return db;
    } catch (error) {
      console.warn('Backup local inválido; iniciando base vazia.', error);
      return emptyDatabase();
    }
  }

  save(db) {
    const next = { ...db, revision: Number(db.revision || 0) + 1, updatedAt: new Date().toISOString() };
    validateDatabase(next);
    localStorage.setItem(KEY, JSON.stringify(next));
    return next;
  }

  replace(db) {
    validateDatabase(db);
    localStorage.setItem(KEY, JSON.stringify(db));
    return db;
  }
}

export function validateImport(value) { return validateDatabase(migrate(value)); }
export function download(name, content, type = 'application/json') {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a'); link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
