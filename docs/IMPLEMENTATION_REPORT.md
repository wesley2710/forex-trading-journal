# Relatório de implementação

## Implementado

- Schema v2 e migração automática do protótipo v1.
- Precisão monetária por centavos inteiros e métricas financeiras testáveis.
- Separação de `app.js` em domínio, validação, repositórios, serviços, páginas e UI.
- Contas, fases, arquivamento, operações detalhadas, movimentações, payouts e snapshots.
- Regras configuráveis e alertas preventivos, com aviso explícito sobre mark-to-market.
- Calendários mensal/anual, drill-down, dashboard e estatísticas por ativo/estratégia.
- Filtros por conta, firma, fase, ativo, estratégia, direção e período.
- Backup JSON validado, migração, CSV e auditoria local.
- Cliente remoto com autenticação, retry/backoff, idempotência e conflitos.
- Backend Cloud Run com Firebase Admin, allowlist de UID, CORS estrito, Sheets API, schema versionado e auditoria.
- CI, validação sintática, detector básico de segredo, testes e smoke HTTP.
- Deploy de frontend por GitHub Pages e documentação de configuração.

## Verificado localmente

Registre aqui o resultado da execução final de `npm run ci` e do teste visual. O relatório de entrega do Codex informa os resultados observados no ambiente em que o ZIP foi produzido.

## Depende de configuração manual

- Projeto Google Cloud/Firebase, consentimento e login.
- Planilha e seu ID real.
- Conta de serviço, IAM e compartilhamento privado da planilha.
- Deploy do Cloud Run e URL HTTPS confirmada.
- Repositório GitHub, remote, proteção de branch e ativação do Pages.
- Teste ponta a ponta com a conta real.

Nenhuma dessas integrações é declarada como ativa antes do teste real.
