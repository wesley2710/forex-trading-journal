# Forex Trading Journal

Aplicação web estática, responsiva e em português para diário de Forex e acompanhamento de múltiplas contas de prop firms. Funciona offline com backup local e pode sincronizar com Google Sheets por um backend autenticado.

## Funcionalidades

- Contas independentes, arquivamento e histórico de transições de fase.
- Regras configuráveis de drawdown, base em balance/equity, timezone e rollover.
- Operações com entry, stop, alvo, saída, lotes, risco, custos, swap, comissão e saídas parciais.
- PnL líquido em centavos inteiros, RR planejado, R realizado, expectativa, profit factor e drawdown.
- Payouts separados do saldo operacional e snapshots de balance/equity.
- Calendários mensal e anual, drill-down diário e filtros combináveis.
- Backup JSON validado, exportação CSV, auditoria local e migração do schema v1.
- Firebase Auth + Cloud Run + Sheets API, com allowlist de UID e sem segredo no frontend.
- CI, smoke test e deploy do frontend por GitHub Pages.

## Executar localmente

Requer Node.js 20+ e Python 3.

```bash
npm test
npm run check
python -m http.server 8080
```

Abra `http://localhost:8080`. O modo local vem ativo em `js/config.js`; não execute por `file://`.

## Produção

1. Leia [Arquitetura](docs/ARCHITECTURE.md) e [Segurança](docs/SECURITY.md).
2. Siga o [guia de setup Google/Firebase/Cloud Run/GitHub](docs/SETUP.md).
3. Consulte o [relatório de implementação](docs/IMPLEMENTATION_REPORT.md).

O projeto não contém credenciais, IDs reais, URL publicada ou promessa de compliance com regras de mesas. Equity intradiária só é conhecida quando um snapshot é registrado.
