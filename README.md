# Forex Trading Journal

Aplicação web pessoal e responsiva para registrar operações de Forex, acompanhar contas de prop firms e guardar prints. O frontend é estático e o backend gratuito usa Google Apps Script, Google Sheets e Google Drive.

## Funcionalidades

- Contas independentes, regras de drawdown, timezone e rollover.
- Operações com entrada, stop, alvo, saída, lotes, risco, custos, swap, comissão, parciais e vários prints.
- Cadastro reutilizável de pares/ativos e estratégias, selecionados por lista para evitar variações de digitação.
- PnL líquido em centavos, RR planejado, R realizado, expectativa, profit factor e drawdown.
- Estatísticas avançadas com rankings por amostra, payoff, sequências, distribuição em R, drawdown completo, períodos, custos, comparação de contas e janela recente.
- Resultado detalhado de cada ativo e filtros globais de estatísticas por dia, semana, mês, 30 dias, ano ou intervalo personalizado.
- Filtro de período sincronizado entre Dashboard e Estatísticas, preservando saldo e alertas atuais sem distorção.
- Saques com divisão editável entre trader e mesa, valores bruto e líquido, taxas, movimentações e snapshots de balance/equity.
- Calendários, drill-down diário, filtros, JSON, CSV e auditoria.
- Cache local/offline e sincronização automática cerca de 900 ms após cada alteração.
- Planilha estruturada e pasta privada de prints na conta Google do proprietário.
- Segredo pessoal configurado uma vez por navegador; não há login repetido em cada acesso.
- GitHub Pages, testes e deploy automatizado.

## Arquitetura gratuita

O GitHub Pages serve HTML/CSS/JavaScript. Um Web App do Google Apps Script, executado como o proprietário, valida um segredo forte antes de ler ou gravar. O segredo fica no `localStorage` do navegador e nunca entra no repositório. A URL pública do endpoint, isoladamente, não concede acesso aos dados.

O Apps Script escreve os registros na planilha vinculada e usa a API do Drive com `drive.file` para criar e acessar somente a pasta e os prints gerenciados pelo diário. Não há Firebase, Cloud Run, conta de serviço ou faturamento.

## Executar localmente

Requer Node.js 20+ e Python 3.

```bash
npm test
npm run check
python -m http.server 8080
```

Abra `http://localhost:8080`. Não execute por `file://`.

## Documentação

- [Setup do Apps Script e GitHub](docs/SETUP.md)
- [Arquitetura](docs/ARCHITECTURE.md)
- [Segurança](docs/SECURITY.md)
- [Relatório de implementação](docs/IMPLEMENTATION_REPORT.md)

Equity intradiária só é conhecida quando um snapshot é registrado. O aplicativo não substitui as regras oficiais da mesa proprietária.
