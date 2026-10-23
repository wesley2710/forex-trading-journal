# Checklist de segurança e privacidade

## Antes do deploy

- [ ] Planilha permanece privada e compartilhada apenas com a conta de serviço do Cloud Run.
- [ ] `ALLOWED_FIREBASE_UIDS` contém somente os UIDs autorizados.
- [ ] `ALLOWED_ORIGINS` contém URLs HTTPS exatas do frontend; `*` não é usado.
- [ ] Login Google está habilitado no Firebase e os domínios autorizados foram revisados.
- [ ] Cloud Run não permite acesso não autenticado ao Sheets fora da validação da aplicação.
- [ ] Conta de serviço tem somente a função necessária e acesso somente à planilha alvo.
- [ ] Nenhuma chave privada, token, `.env` ou JSON de service account foi commitado.
- [ ] Secret scanning e proteção de branch estão ativos no GitHub.
- [ ] Logs não registram corpo de operações, token ou dados financeiros.
- [ ] Backups JSON são armazenados de forma criptografada e tratados como dados financeiros sensíveis.

## Operação

- [ ] Revisar acessos Firebase e IAM periodicamente.
- [ ] Revogar sessões ao perder um dispositivo.
- [ ] Exportar e testar backups regularmente.
- [ ] Monitorar erros 401, 403, 409, 429 e 5xx sem registrar payloads.
- [ ] Manter dependências e runtime atualizados.
- [ ] Confirmar visualmente a planilha antes de apagar cópias locais.

## Ameaças tratadas

XSS é reduzido por escaping centralizado e limites de texto. O backend revalida o payload, aplica limite de 5 MB, CORS estrito, token revogado, allowlist, controle otimista e idempotência. `helmet` adiciona cabeçalhos defensivos no backend.

## Riscos residuais

XSS na mesma origem poderia ler dados locais e usar a sessão autenticada; por isso não adicione scripts não confiáveis. Sheets não substitui banco transacional. A disponibilidade depende das quotas Google e do Cloud Run. Dados exportados ficam sob responsabilidade do usuário.
