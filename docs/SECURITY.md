# Checklist de segurança e privacidade

## Antes de publicar

- [ ] `FOREX_JOURNAL_TOKEN` possui pelo menos 32 caracteres aleatórios e existe somente nas propriedades privadas do Apps Script e nos navegadores autorizados.
- [ ] Nenhum segredo, token, chave privada, `.env` ou credencial de serviço foi commitado.
- [ ] O Web App executa como o proprietário; o acesso anônimo serve somente para alcançar o endpoint protegido.
- [ ] O manifesto solicita apenas `spreadsheets.currentonly`, `drive.file` e `script.external_request`.
- [ ] A planilha e a pasta de prints continuam restritas ao proprietário.
- [ ] Backups JSON são tratados como dados financeiros sensíveis.

## Operação

- [ ] Exportar e testar backups regularmente.
- [ ] Usar **Esquecer acesso neste navegador** antes de entregar ou vender um dispositivo.
- [ ] Se um dispositivo for perdido, alterar imediatamente `FOREX_JOURNAL_TOKEN` nas propriedades do script.
- [ ] Conferir a versão antes de substituir dados em um conflito.
- [ ] Manter navegador e Apps Script atualizados.

## Ameaças e riscos residuais

O segredo persistente elimina logins repetidos, mas qualquer pessoa com acesso ao perfil desbloqueado do navegador pode usar o diário. Um XSS na mesma origem também poderia ler o `localStorage`; por isso o frontend não carrega bibliotecas ou scripts de terceiros e escapa textos antes de inseri-los no HTML.

O endpoint do Apps Script é publicamente alcançável, porém todas as operações de dados exigem o segredo. Esse modelo é apropriado para um aplicativo pessoal, não para uma aplicação pública multiusuário. Se o segredo vazar, ele deve ser rotacionado.
