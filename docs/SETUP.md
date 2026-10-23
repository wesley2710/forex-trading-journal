# Setup gratuito de produção

Esta configuração não exige faturamento, Cloud Run, conta de serviço ou segredo no GitHub.

## 1. Google Cloud

1. Selecione o projeto Google Cloud do aplicativo.
2. Em **APIs e serviços > Biblioteca**, habilite **Google Sheets API** e **Google Drive API**.
3. Em **Tela de consentimento OAuth**, configure o aplicativo para uso externo/teste e adicione seu próprio e-mail como usuário de teste, se essa opção aparecer.
4. Crie ou reutilize um **ID do cliente OAuth 2.0** do tipo **Aplicativo da Web**.
5. Em **Origens JavaScript autorizadas**, adicione `http://localhost:8080` e `https://SEU_USUARIO.github.io`.
6. Não é necessário adicionar URI de redirecionamento para o fluxo de token do Google Identity Services.

O frontend solicita somente `https://www.googleapis.com/auth/drive.file`; escopos de perfil não são necessários.

## 2. Frontend

Edite `js/config.js`:

```js
export const appConfig = {
  remoteEnabled: true,
  google: {
    clientId: 'SEU_CLIENT_ID.apps.googleusercontent.com',
    spreadsheetTitle: 'Forex Trading Journal Data',
  },
};
```

O Client ID pode aparecer no código público; ele identifica o aplicativo e não é uma senha. Nunca coloque client secret, token, chave privada ou credencial de serviço no repositório.

## 3. Primeiro uso

1. Abra o site e acesse **Configurações**.
2. Clique em **Conectar conta Google** e conceda o acesso solicitado.
3. O site criará uma planilha privada chamada `Forex Trading Journal Data` e uma pasta privada chamada `Forex Trading Journal - Prints`.
4. Cadastre dados localmente e use **Enviar para a planilha**.
5. Para recuperar dados em outro navegador, conecte a mesma conta e use **Baixar da planilha**.

O aplicativo nunca torna os arquivos públicos. Uma planilha vazia criada manualmente não é usada automaticamente; o site localiza apenas arquivos marcados como criados por ele.

## 4. GitHub Pages

1. Envie a branch `main` ao repositório.
2. Em **Settings > Pages**, selecione **GitHub Actions**.
3. Confirme os workflows `CI` e `Deploy GitHub Pages`.
4. Abra a URL publicada e teste conexão, envio, download e um print.

## 5. Checklist ponta a ponta

- Criar uma conta e operação; exportar JSON.
- Conectar o Google e enviar os dados.
- Conferir as abas da planilha e a pasta de prints.
- Abrir outro navegador, conectar e baixar.
- Confirmar que um segundo envio com revisão antiga acusa conflito.
- Desconectar e confirmar que o modo local continua funcionando.
