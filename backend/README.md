# Backend Cloud Run + Google Sheets

API privada que verifica Firebase ID tokens, restringe UIDs, valida o schema e persiste snapshots versionados no Google Sheets.

## Endpoints

- `GET /health`: público, sem dados sensíveis.
- `GET /v1/snapshot`: exige `Authorization: Bearer <Firebase ID token>`.
- `PUT /v1/snapshot`: também exige `If-Match` e `x-idempotency-key`.

## Desenvolvimento

```bash
npm install
npm test
npm run init-sheet
npm start
```

Use Application Default Credentials localmente. Em produção, conceda à conta de serviço somente acesso de editor à planilha escolhida. Veja `../docs/SETUP.md`.
