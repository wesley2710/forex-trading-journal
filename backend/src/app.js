import express from 'express';
import helmet from 'helmet';
import { validateSnapshot } from './model.js';

export function createApp({ store, authMiddleware, allowedOrigins }) {
  const app = express(); app.disable('x-powered-by'); app.use(helmet()); app.use(express.json({ limit: '5mb' }));
  app.use((request, response, next) => {
    const origin = request.headers.origin;
    if (origin && allowedOrigins.has(origin)) response.setHeader('access-control-allow-origin', origin);
    response.setHeader('vary', 'Origin'); response.setHeader('access-control-allow-headers', 'authorization,content-type,if-match,x-idempotency-key'); response.setHeader('access-control-allow-methods', 'GET,PUT,OPTIONS');
    if (request.method === 'OPTIONS') return allowedOrigins.has(origin) ? response.sendStatus(204) : response.sendStatus(403); next();
  });
  app.get('/health', (_request, response) => response.json({ ok: true, schemaVersion: 2 }));
  app.use('/v1', authMiddleware);
  app.get('/v1/snapshot', async (_request, response, next) => { try { response.setHeader('cache-control', 'no-store'); response.json(await store.readSnapshot()); } catch (error) { next(error); } });
  app.put('/v1/snapshot', async (request, response, next) => {
    try {
      const key = request.headers['x-idempotency-key']; const expectedRevision = Number(request.headers['if-match']);
      if (!key || key.length > 100 || !Number.isInteger(expectedRevision)) return response.status(400).json({ error: 'Cabeçalhos de idempotência ou versão inválidos.' });
      response.json(await store.writeSnapshot(validateSnapshot(request.body), { expectedRevision, idempotencyKey: key, actor: request.user.uid }));
    } catch (error) { next(error); }
  });
  app.use((error, _request, response, _next) => { console.error(error); response.status(error.status || 500).json({ error: error.status ? error.message : 'Erro interno.', revision: error.revision }); });
  return app;
}
