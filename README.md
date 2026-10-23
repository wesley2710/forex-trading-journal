# Forex Trading Journal

Aplicação web pessoal, responsiva e em português para registrar operações de Forex, acompanhar contas de prop firms e guardar prints. O site é estático e funciona sem servidor pago.

## Funcionalidades

- Contas independentes, fases, regras de drawdown, timezone e rollover.
- Operações com entrada, stop, alvo, saída, lotes, risco, custos, swap, comissão, parciais e vários prints.
- PnL líquido em centavos, RR planejado, R realizado, expectativa, profit factor e drawdown.
- Payouts, taxas, movimentações e snapshots de balance/equity.
- Calendários, drill-down diário, filtros, JSON, CSV e auditoria.
- Modo local e sincronização manual com uma planilha e uma pasta privadas criadas na conta Google do usuário.
- GitHub Pages, testes e deploy automatizado.

## Arquitetura gratuita

O frontend roda no GitHub Pages. O login OAuth acontece direto com o Google e solicita somente o escopo `drive.file`, que limita o aplicativo aos arquivos que ele próprio criou ou que o usuário abriu com ele. Os dados ficam no Google Planilhas e os prints no Google Drive. Não há Cloud Run, banco pago, conta de serviço nem faturamento vinculado.

O Client ID OAuth é público por definição. Tokens não são gravados no `localStorage`; ficam apenas na memória da página.

## Executar localmente

Requer Node.js 20+ e Python 3.

```bash
npm test
npm run check
python -m http.server 8080
```

Abra `http://localhost:8080`. Não execute por `file://`.

## Documentação

- [Setup Google e GitHub](docs/SETUP.md)
- [Arquitetura](docs/ARCHITECTURE.md)
- [Segurança](docs/SECURITY.md)
- [Relatório de implementação](docs/IMPLEMENTATION_REPORT.md)

Equity intradiária só é conhecida quando um snapshot é registrado. O aplicativo não substitui as regras oficiais da mesa proprietária.
