# Setup de produção

Nenhuma etapa abaixo foi executada automaticamente: ela altera contas Google/GitHub e exige suas credenciais. Substitua apenas os marcadores pelos valores reais.

## 1. Google Cloud, Firebase e planilha

1. Crie ou selecione um projeto no Google Cloud Console e associe-o ao Firebase.
2. No Firebase Authentication, habilite o provedor Google. Em **Authorized domains**, adicione `SEU_USUARIO.github.io` e o domínio customizado, se houver.
3. Crie uma planilha vazia e copie somente o ID entre `/d/` e `/edit` da URL.
4. Habilite **Google Sheets API**, **Cloud Run Admin API**, **Cloud Build API** e **Artifact Registry API**.
5. Crie uma conta de serviço exclusiva para o backend. Não gere chave JSON para produção.
6. Compartilhe a planilha diretamente com o e-mail dessa conta de serviço como **Editor**. Não use “qualquer pessoa com o link”.
7. Conceda ao agente de deploy apenas as funções necessárias para publicar no Cloud Run e atuar como a conta de serviço.

Para descobrir seu Firebase UID, faça o primeiro login no app Firebase ou consulte Authentication > Users. Não use e-mail como identificador de autorização.

## 2. Inicializar as abas

Para desenvolvimento local, use Application Default Credentials:

```bash
gcloud auth application-default login
cd backend
npm install
set GOOGLE_SHEET_ID=SEU_ID
npm run init-sheet
```

No PowerShell, use `$env:GOOGLE_SHEET_ID='SEU_ID'`. O script cria `Accounts`, `Phases`, `Trades`, `CashFlows`, `Payouts`, `Fees`, `Snapshots`, `Audit`, `Settings` e `_meta`.

## 3. Deploy do backend

Execute a partir da raiz do projeto, trocando os marcadores:

```bash
gcloud run deploy forex-journal-api \
  --source backend \
  --region SUA_REGIAO \
  --service-account SUA_CONTA_DE_SERVICO \
  --set-env-vars GOOGLE_SHEET_ID=SEU_ID,FIREBASE_PROJECT_ID=SEU_PROJETO,ALLOWED_FIREBASE_UIDS=SEU_UID,ALLOWED_ORIGINS=https://SEU_USUARIO.github.io \
  --concurrency 1 \
  --max-instances 1 \
  --allow-unauthenticated
```

`--allow-unauthenticated` permite que o navegador alcance o endpoint; os dados continuam protegidos pelo Firebase token e pela allowlist dentro da API. Teste `GET /health`, depois confirme que `/v1/snapshot` retorna 401 sem token e 403 para usuário não autorizado.

Para múltiplos UIDs ou origens, separe por vírgula. URLs de projeto Pages incluem o caminho do repositório no navegador, mas a origem CORS é somente `https://SEU_USUARIO.github.io`.

## 4. Configurar o frontend

1. Copie o conteúdo de `js/config.example.js` para `js/config.js`.
2. No Firebase Console, crie um app Web e copie a configuração pública.
3. Defina `apiBaseUrl` com a URL HTTPS confirmada do Cloud Run.
4. Não coloque service account, API secret, refresh token ou ID token nesse arquivo.
5. Rode `npm run ci` e teste login, upload, download e conflito em uma planilha de teste.

## 5. GitHub e Pages

1. Crie um repositório vazio na sua conta GitHub.
2. Adicione o remoto e envie a branch `main`:

```bash
git remote add origin URL_DO_REPOSITORIO
git push -u origin main
```

3. Em **Settings > Pages > Build and deployment**, selecione **GitHub Actions**.
4. Em **Actions**, confirme a execução de `CI` e `Deploy GitHub Pages`.
5. Em **Settings > Branches**, proteja `main` e exija o check `test`.
6. Ative secret scanning/Dependabot quando disponíveis. Este frontend não exige GitHub Secrets.
7. Só considere publicado quando o workflow devolver uma URL e o login/sincronização forem testados nela.

## 6. Teste ponta a ponta obrigatório

- Criar uma conta e uma operação no modo local.
- Exportar JSON e guardar o arquivo.
- Entrar com Google, enviar a versão local e conferir as abas.
- Abrir outro navegador, entrar, baixar e conferir valores/IDs.
- Editar em dois navegadores e confirmar erro 409 no segundo envio.
- Simular indisponibilidade e confirmar que o backup local permanece utilizável.
- Registrar snapshot de equity e confirmar o alerta correspondente.
