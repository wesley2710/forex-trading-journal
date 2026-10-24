# Arquitetura de produção

```text
GitHub Pages (HTML/CSS/JS)
  ├─ localStorage v3: cache, fila offline e segredo pessoal
  └─ HTTPS POST + segredo forte
       └─ Google Apps Script Web App (executa como o proprietário)
            ├─ planilha vinculada: dados estruturados e revisão
            └─ Drive API / drive.file: pasta privada de prints
```

Não existe servidor pago. O Web App é autorizado uma vez durante a implantação e continua executando na conta do proprietário. O navegador não precisa obter um token OAuth do Drive a cada visita.

## Salvamento e inicialização

Cada alteração é gravada imediatamente no cache local. Após 900 ms sem novas mudanças, o frontend envia um snapshot autenticado ao Apps Script. Mudanças feitas durante um envio entram no lote seguinte. Falhas deixam a cópia local intacta e o site tenta novamente quando houver uma nova alteração ou quando o usuário solicitar.

Ao abrir o site, a sessão é restaurada pelo segredo salvo no navegador. O aplicativo compara a revisão local com `_meta`: baixa a versão mais nova quando não há mudanças locais, envia mudanças pendentes quando a revisão remota ainda coincide e bloqueia sobrescritas silenciosas quando detecta conflito.

## Estrutura da planilha

As abas são `Accounts`, `Phases`, `Trades`, `CashFlows`, `Payouts`, `Fees`, `Snapshots`, `Audit`, `Settings` e `_meta`. `Phases` permanece apenas para compatibilidade com backups antigos e não aparece no fluxo atual. Cada linha guarda ID, versão, timestamp e o objeto completo em JSON. `_meta` registra versão do schema, revisão, contagens e última atualização.

Os prints são arquivos privados na pasta `Forex Trading Journal - Prints`. As operações guardam somente ID, nome, tipo e tamanho. O backend confere se o arquivo pertence à pasta antes de permitir leitura ou exclusão.

## Segurança do acesso

- Todas as ações que leem ou alteram dados exigem o segredo `FOREX_JOURNAL_TOKEN` guardado nas propriedades privadas do Apps Script.
- A comparação do segredo usa SHA-256 e não depende de comparação direta de texto.
- O segredo não é commitado nem incluído em `js/config.js`.
- O endpoint `GET` retorna apenas o nome e a versão do serviço, nunca dados.
- Imagens são validadas por tipo, base64 e tamanho máximo de 8 MB.
- O manifesto solicita `spreadsheets.currentonly`, `drive.file` e `script.external_request`.

## Limites conhecidos

- A arquitetura é para uma pessoa e baixo volume; não oferece colaboração multiusuário.
- Um conflito entre dois dispositivos exige escolher explicitamente a versão remota ou preservar/exportar a local.
- Sem internet, registros textuais continuam no cache; novos prints exigem conexão para serem enviados ao Drive.
- Não há preços ao vivo nem integração MT5; equity depende de snapshots manuais.
- O espaço dos prints conta na cota normal do Google Drive.
