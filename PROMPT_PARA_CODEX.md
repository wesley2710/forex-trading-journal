# PROMPT PARA COLAR NO CODEX

Você está recebendo um ZIP contendo um projeto chamado **Forex Trading Journal**. Trabalhe SOBRE esses arquivos, preservando o design escuro, os módulos, o layout e as funcionalidades já implementadas.

## Objetivo

Transformar a aplicação estática/local em um site de produção confiável, com **persistência segura em Google Sheets**, repositório GitHub e deploy HTTPS, preferencialmente GitHub Pages para o frontend, mantendo contas de mesas proprietárias, diário de Forex, calendário mensal/anual, filtros, indicadores em USD, RR planejado, R realizado e R acumulado.

## Etapa 0 — Inspeção

1. Descompacte e inspecione todos os arquivos, leia README.md e docs/ARCHITECTURE.md.
2. Execute `npm test`, rode localmente e teste visualmente desktop e mobile.
3. Faça inventário de riscos, bugs e requisitos ausentes, sem remover as funcionalidades existentes.
4. Planeje incrementalmente e faça commits claros. Se alguma integração precisar de consentimento ou credenciais, implemente o código e forneça passos objetivos para configuração; NUNCA invente IDs ou afirme que sincronizou sem testar.

## Etapa 1 — Qualidade e arquitetura

- Separar `js/app.js` em módulos de páginas, formulários, domínio, repositórios e UI, mantendo a interface.
- Adicionar cálculos com precisão monetária adequada e cobertura de testes para lucro líquido, R, RR, filtros, timezones e agregação de contas.
- Reforçar validação de todos os campos, XSS, limites, erros, UX, responsividade e acessibilidade.
- Diferenciar saldo operacional de prop firm de patrimônio real e payout recebido.
- Suportar saques, depósitos, taxas, payouts, transição de fase, múltiplas contas na mesma firma e arquivamento sem perda de histórico.
- Completar o modelo para entry, stop loss, take profit, exit, lots, custo, swap, data/hora, risco, R e RR. Considerar saídas parciais.

## Etapa 2 — Persistência de verdade em Google Sheets

- Propor arquitetura segura e explicar tradeoffs antes de configurar. O frontend será hospedado estaticamente e NÃO poderá conter tokens/secrets.
- Implementar backend autenticado/autorizado para CRUD de contas, operações, movimentações, fases, snapshots, configurações e auditoria. Pode usar Google Apps Script SOMENTE se a solução escolhida puder ser protegida adequadamente na implantação real, com autenticação, autorização e validação no servidor. Caso não seja viável para GitHub Pages, usar alternativa viável (por ex., Firebase Auth + Cloud Functions/Run + Sheets API), mantendo **Google Sheets como datastore** se possível.
- Criar scripts para gerar as abas/colunas da planilha, esquema versionado, migrações, IDs, timestamps e mecanismo de resolução de conflitos.
- Tratar API quota, erros, retry com backoff, operações duplicadas, validação e auditoria; implementar sincronização com estado visível, e reconciliação do backup local.
- Aplicar a menor permissão necessária. Nunca commitar credenciais, chaves privadas, refresh tokens ou URL de endpoints que por si só deem acesso irrestrito aos dados.
- Criar documentação passo a passo para Google Cloud/Sheets, autenticação, consentimento, configuração e deploy, com checklist de segurança.

## Etapa 3 — Regras de Prop Firms

- Conta independente por ID, fases histórico-independentes, meta, limite de perda diária, limite total, estático/trailing, regra equity/balance, fuso da mesa e rollover diário.
- Alertas preventivos de limites, sem dar falsa garantia de compliance quando não existirem preços/mark-to-market intradiário.
- Registros de taxas, profit split, payout solicitado/aprovado/recebido, e performance consolidada.
- Testar cenários de diferentes firmas com regras configuráveis; nunca hardcode regras reais que mudam.

## Etapa 4 — Dashboards e análises

- Calendário mensal com PnL e R por dia, clique para trades; anual com os 12 meses e drill-down, ambos filtráveis por conta e período.
- Dashboard com equity, balance, drawdown, consistência, lucro/perda, winrate, profit factor, expectativa matemática, R cumulativo e R médio.
- Filtros por conta, firma, fase, ativo, estratégia, direção e período personalizado, com exportação e backup.
- Distinguir equity (inclui posições abertas quando dados estiverem disponíveis) de saldo realizado; sem preços ao vivo não inventar equity intradiária.

## Etapa 5 — GitHub e publicação

- Inicializar repositório (se necessário) e adicionar CI com testes, lint e smoke tests.
- Preparar deploy automatizado de frontend estático via GitHub Actions/GitHub Pages, considerando paths de subdiretório e HTTPS.
- Documentar como conectar a conta GitHub, configurar Settings > Pages, branch/actions, domínios, variáveis e proteção de segredos.
- Só realizar ações externas (criar projeto em conta Google, habilitar APIs, publicar repositório ou serviço, editar permissões) quando as credenciais e permissões estiverem disponíveis, solicitando aprovação explícita nos pontos necessários.
- Se indisponíveis, entregar código funcional local, arquivos de configuração de exemplo e roteiro de ações manuais restantes. Não inventar URL de site, planilha, ou informar que foi publicado sem confirmação.

## Entregáveis de conclusão

1. Projeto completo e testado.
2. Guia de setup com instruções precisas para minhas contas Google e GitHub.
3. Backend e schema da planilha (ou justificativa clara para alternativa segura).
4. CI e mecanismo de deploy.
5. Relatório do que foi implementado, testado e do que depende de configuração manual.
6. Checklist de segurança e privacidade.

**Prioridade:** garantir integridade dos dados e isolamento das contas. Não simplifique a autenticação para deixar uma planilha de trading publicamente editável. Comece analisando o ZIP e os testes existentes; depois execute etapas na ordem com evidências de funcionamento.
