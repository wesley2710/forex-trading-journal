# Checklist de segurança e privacidade

## Antes de publicar

- [ ] Somente **Google Sheets API** e **Google Drive API** são necessárias.
- [ ] A origem OAuth contém apenas `http://localhost:8080` e `https://SEU_USUARIO.github.io`.
- [ ] O usuário de teste OAuth é somente a conta do proprietário.
- [ ] O frontend solicita `drive.file`, nunca acesso completo ao Drive.
- [ ] Nenhum client secret, token, chave privada, `.env` ou JSON de conta de serviço foi commitado.
- [ ] Planilha e pasta de prints continuam privadas.
- [ ] Backups JSON são tratados como dados financeiros sensíveis.

## Operação

- [ ] Exportar e testar backups regularmente.
- [ ] Conferir a planilha antes de substituir dados locais.
- [ ] Remover o acesso do aplicativo na Conta Google se um dispositivo for perdido.
- [ ] Manter navegadores e dependências atualizados.
- [ ] Não adicionar scripts, pixels ou bibliotecas de terceiros não confiáveis.

## Ameaças e riscos residuais

Textos vindos do usuário são escapados antes de entrar no HTML. O token permanece na memória e não é persistido. Ainda assim, um XSS na mesma origem poderia ler dados locais e usar a sessão conectada; por isso o site evita dependências e scripts desnecessários.

O Client ID OAuth não é secreto. A proteção real vem das origens autorizadas, do consentimento Google, do token temporário e do escopo limitado. Dados exportados e dispositivos desbloqueados continuam sob responsabilidade do usuário.
