# Arquitetura de produção

## Decisão

```text
GitHub Pages (HTML/CSS/JS)
  ├─ localStorage v2: cache, modo offline e backup
  ├─ Firebase Auth: login Google e ID token curto
  └─ HTTPS + Bearer token
       Cloud Run (Node/Express)
         ├─ Firebase Admin: valida token e UID permitido
         ├─ validação, CORS, idempotência e controle de revisão
         └─ Sheets API com identidade de serviço
              Google Sheets privado (schema v2)
```

O navegador nunca recebe credenciais da conta de serviço nem permissão direta de escrita na planilha. A configuração pública do Firebase identifica o projeto, mas não concede acesso ao Sheets. O backend exige token válido e `ALLOWED_FIREBASE_UIDS`.

## Tradeoffs considerados

- **Apps Script público:** simples, porém uma URL de `doPost` anônimo não oferece autorização suficiente. Não foi usado.
- **Sheets API direto do browser:** exigiria OAuth e exporia uma superfície de acesso ampla no cliente. Não foi usado.
- **Firebase/Firestore:** seria mais transacional e escalável, mas deixaria de manter Sheets como datastore principal.
- **Cloud Run + Sheets API:** oferece autenticação e validação reais mantendo Sheets. Custa mais configuração e Sheets continua inadequado para alto volume.

Esta implementação é orientada a uso pessoal/baixo volume. O Cloud Run deve usar `--concurrency=1 --max-instances=1`. Cada salvamento escreve todas as coleções e a revisão em uma única chamada `values.batchUpdate`; contagens registradas em `_meta` fazem linhas antigas serem ignoradas. `If-Match` detecta edição concorrente e `x-idempotency-key` evita repetição recente. Para colaboração intensa, migre a fonte da verdade para Firestore ou banco SQL e use Sheets apenas como relatório.

## Módulos do frontend

- `js/domain`: dinheiro em centavos, métricas, schema e validação.
- `js/repositories`: persistência local e cliente remoto.
- `js/services`: Firebase Auth e estado de sincronização.
- `js/pages`: renderização por página.
- `js/ui`: escaping e componentes HTML.
- `js/app.js`: estado, roteamento e comandos de usuário.

## Modelo v2

`accounts`, `phases`, `trades`, `cashFlows`, `payouts`, `fees`, `snapshots`, `settings` e `audit`. Cada entidade tem ID estável e versão. Valores monetários são inteiros em centavos.

O resultado líquido é `grossPnlCents - feesCents + swapCents - commissionCents`. Payout recebido é patrimônio recebido e não é somado novamente ao PnL. Balance operacional é saldo inicial + PnL realizado + movimentações marcadas como impactantes.

## Limites conhecidos

- Não há preços ao vivo ou integração MT5; equity depende de snapshots manuais.
- Alertas de perda não são garantia de compliance e não modelam toda regra comercial possível.
- Sheets possui quotas, tamanho de célula e menor garantia transacional que um banco de dados.
- A resolução de conflito é explícita: baixar a revisão remota ou exportar o local antes de substituir.
