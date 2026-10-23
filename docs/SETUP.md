# Setup gratuito de produção

Esta configuração usa a mesma ideia do Study Tracker: Apps Script autorizado uma vez, segredo persistente no navegador e sincronização automática. Não exige faturamento.

## 1. Instalar o backend na planilha

1. Abra a planilha `Forex Trading Journal Data`.
2. Acesse **Extensões > Apps Script**.
3. Substitua o conteúdo de `Code.gs` por `apps-script/Code.gs`.
4. Em **Configurações do projeto**, habilite a exibição do arquivo de manifesto.
5. Substitua `appsscript.json` pelo conteúdo de `apps-script/appsscript.json`.
6. Salve o projeto.

## 2. Configurar o segredo pessoal

1. Gere um segredo aleatório com pelo menos 32 caracteres; 64 caracteres são recomendados.
2. Em **Configurações do projeto > Propriedades do script**, adicione:
   - Propriedade: `FOREX_JOURNAL_TOKEN`
   - Valor: o segredo gerado
3. Não coloque esse valor em código, GitHub, arquivos de configuração ou capturas de tela.

## 3. Implantar o Web App

1. Clique em **Implantar > Nova implantação**.
2. Selecione **App da Web**.
3. Em **Executar como**, escolha **Eu**.
4. Em **Quem pode acessar**, escolha **Qualquer pessoa**.
5. Autorize os escopos da planilha vinculada e dos arquivos criados pelo aplicativo.
6. Copie a URL final terminada em `/exec`.

O endpoint precisa ser público para o GitHub Pages chamá-lo, mas nenhuma ação de dados funciona sem o segredo. A URL sozinha não permite ler ou alterar a planilha.

## 4. Ligar o frontend

Edite `js/config.js`:

```js
export const appConfig = {
  remoteEnabled: true,
  appsScript: {
    endpoint: 'https://script.google.com/macros/s/SEU_DEPLOYMENT_ID/exec',
    spreadsheetUrl: 'URL_DA_SUA_PLANILHA',
  },
};
```

A URL do Web App pode ficar no repositório; o segredo não pode.

## 5. Primeiro uso

1. Abra o site e acesse **Configurações**.
2. Clique em **Configurar acesso automático**.
3. Digite o mesmo segredo das propriedades do script.
4. A partir daí, o segredo permanece neste navegador até **Esquecer acesso neste navegador** ou até os dados do site serem apagados.
5. Cadastre uma conta e uma operação; a interface deve passar por `Salvo; enviando…` e chegar a `Sincronizado` automaticamente.

## 6. Atualizações futuras

Depois de alterar `Code.gs`, abra **Implantar > Gerenciar implantações > Editar**, selecione **Nova versão** e publique mantendo a mesma URL. Alterações apenas no frontend são publicadas normalmente pelo GitHub Pages.

## 7. Checklist ponta a ponta

- Abrir o Web App diretamente e confirmar a resposta de status sem dados.
- Informar um segredo errado e confirmar `UNAUTHORIZED`.
- Configurar o segredo correto e confirmar a sincronização automática.
- Cadastrar uma conta e conferir a aba `Accounts`.
- Cadastrar uma operação com print e conferir a aba `Trades` e a pasta privada.
- Recarregar o site e confirmar que não pede login nem segredo novamente.
- Testar exportação JSON antes de qualquer restauração ou resolução de conflito.
