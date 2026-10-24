const DEFINITIONS = {
  symbols: { label: 'Par / ativo', max: 30, source: 'symbol', defaults: ['EUR/USD'] },
  strategies: { label: 'Estratégia', max: 80, source: 'strategy', defaults: [] },
};

const definition = (kind) => {
  const value = DEFINITIONS[kind];
  if (!value) throw new Error('Tipo de cadastro inválido.');
  return value;
};

export function normalizePreset(kind, value) {
  const config = definition(kind);
  const normalized = String(value ?? '').trim().replace(/\s+/g, ' ');
  if (!normalized) throw new Error(`${config.label} não pode ficar vazio.`);
  if (normalized.length > config.max) throw new Error(`${config.label} deve ter no máximo ${config.max} caracteres.`);
  return kind === 'symbols' ? normalized.toUpperCase() : normalized;
}

const unique = (kind, values) => {
  const output = [];
  const seen = new Set();
  for (const value of values) {
    let normalized;
    try { normalized = normalizePreset(kind, value); } catch { continue; }
    const key = normalized.toLocaleLowerCase('pt-BR');
    if (!seen.has(key)) { seen.add(key); output.push(normalized); }
  }
  return output;
};

export function presetValues(db, kind) {
  const config = definition(kind);
  const configured = db.settings?.[kind];
  if (Array.isArray(configured)) {
    const values = unique(kind, configured);
    return kind === 'symbols' && !values.length ? [...config.defaults] : values;
  }
  const historical = (db.trades || []).map((trade) => trade[config.source]).filter(Boolean);
  return unique(kind, historical.length ? historical : config.defaults);
}

export function presetOptions(db, kind, current = '') {
  const values = presetValues(db, kind);
  const merged = current && !values.some((value) => value.toLocaleLowerCase('pt-BR') === String(current).toLocaleLowerCase('pt-BR'))
    ? [...values, current]
    : values;
  return merged.map((value) => [value, value]);
}

export function savePreset(db, kind, value, previous = '') {
  const normalized = normalizePreset(kind, value);
  const current = presetValues(db, kind);
  const previousKey = String(previous).toLocaleLowerCase('pt-BR');
  const next = previous
    ? current.map((item) => item.toLocaleLowerCase('pt-BR') === previousKey ? normalized : item)
    : [...current, normalized];
  const deduped = unique(kind, next);
  if (deduped.length !== next.length) throw new Error(`${definition(kind).label} já está cadastrado.`);
  return { ...(db.settings || {}), [kind]: deduped };
}

export function deletePreset(db, kind, value) {
  const key = String(value).toLocaleLowerCase('pt-BR');
  const next = presetValues(db, kind).filter((item) => item.toLocaleLowerCase('pt-BR') !== key);
  if (kind === 'symbols' && !next.length) throw new Error('Mantenha ao menos um par / ativo cadastrado.');
  return { ...(db.settings || {}), [kind]: next };
}
