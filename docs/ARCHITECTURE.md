# Arquitetura de produção

```text
GitHub Pages (HTML/CSS/JS)
  ├─ localStorage v3: cache, modo offline e backup
  ├─ Google Identity Services: OAuth no navegador
  └─ escopo drive.file
       ├─ Google Sheets API: dados estruturados e revisão
       └─ Google Drive API: prints privados das operações
```

Não existe backend em produção. O aplicativo é destinado a uma única pessoa e usa a própria conta Google dela como identidade e armazenamento. Firebase pode permanecer configurado no projeto, mas não é usado pelo frontend.

## Sincronização

Cada envio grava todas as coleções e incrementa uma revisão em `_meta`. As contagens registradas fazem linhas antigas serem ignoradas. Um envio com revisão local desatualizada é rejeitado, evitando sobrescrever silenciosamente uma versão mais nova. A resolução é explícita: exportar o local, baixar o remoto e então decidir o que reenviar.

A planilha possui as abas `Accounts`, `Phases`, `Trades`, `CashFlows`, `Payouts`, `Fees`, `Snapshots`, `Audit`, `Settings` e `_meta`. Cada linha guarda campos pesquisáveis básicos e o objeto completo em JSON. Prints são arquivos do Drive e as operações guardam somente ID, nome, tipo e tamanho.

## Segurança do acesso

O escopo `drive.file` não dá acesso geral ao Drive. O aplicativo pesquisa e altera apenas arquivos criados por ele ou explicitamente abertos com ele. O token de acesso fica apenas na memória e expira; após recarregar a página, o usuário precisa conectar novamente.

## Limites conhecidos

- Sincronização é manual e substitui o snapshot completo.
- Não há preços ao vivo nem integração MT5; equity depende de snapshots manuais.
- Não há colaboração multiusuário nem mesclagem automática de conflitos.
- Planilhas e Drive têm quotas gratuitas e limites próprios; esta solução é adequada para uso pessoal e baixo volume.
- O espaço usado pelos prints conta na cota normal do Google Drive do usuário.
