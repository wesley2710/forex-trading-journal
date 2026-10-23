// A URL do Web App não é um segredo. Nunca coloque FOREX_JOURNAL_TOKEN neste arquivo.
export const appConfig = {
  remoteEnabled: true,
  appsScript: {
    endpoint: 'https://script.google.com/macros/s/SEU_DEPLOYMENT_ID/exec',
    spreadsheetUrl: 'URL_DA_SUA_PLANILHA',
  },
};
