# Tasks: Agent Team Maturity Sprint (2 semanas)

Status: **PLANNED**
Author: Spec Manager
Date: 2026-05-24
Spec: [spec.md](spec.md)
Architecture: [architecture.md](architecture.md)

Cada item ~1-4h. P0 na semana 1, P1 na semana 2.

---

## Layer 1 — Foundation (sequential)

- [ ] **[M][P0]** T1 — Fluxo de acesso ao Studio sem DevTools (owner: dev1)
  Files: `src/features/agents/components/*`, `server/*auth*` (ou equivalente)
  Depends: nada

- [ ] **[S][P0]** T2 — Hermes backend determinístico em produção (owner: dev2)
  Files: `src/lib/studio/settings.ts`, `src/lib/gateway/*`, `server/*`
  Depends: T1

- [ ] **[S][P0]** T3 — Mensagens de erro acionáveis de conexão (owner: dev1)
  Files: `src/features/agents/components/GatewayConnectScreen.tsx`, `src/lib/gateway/*`
  Depends: T2

## Layer 2 — Build (parallel after Layer 1)

- [ ] **[M][P1]** T4 — Auto-reconnect com backoff/cancelamento seguro (owner: dev2)
  Files: `src/lib/gateway/GatewayClient.ts`
  Depends: Layer 1

- [ ] **[S][P1]** T5 — Guardrails/migração de estado legado (owner: dev1)
  Files: `src/lib/studio/settings.ts`, `~/.openclaw/claw3d/settings.json` handling
  Depends: Layer 1

- [ ] **[S][P1]** T6 — Painel mínimo de health operacional (owner: devops)
  Files: `src/features/*health*`, `server/*health*`
  Depends: Layer 1

## Layer 3 — Wire-up (sequential)

- [ ] **[S][P1]** T7 — Runbook de recuperação 1-min + validações pós-boot (owner: devops)
  Files: `docs/*`, `specs/agent-team-maturity/*`
  Depends: T4, T5, T6

- [ ] **[S][P1]** Integrar flags de ambiente prod/demo sem regressão
  Files: `server/*`, `src/lib/studio/*`
  Depends: T7

## Layer 4 — Validation

- [ ] **[M]** Build + smoke server (`npm run build`, `npm run smoke:dev-server`)
- [ ] **[S]** Testes de conexão Hermes (cold boot + reconnect)
- [ ] **[S]** Testes negativos (auth_required, blocked, timeout)
- [ ] **[XS]** Teste manual UX (primeira conexão em <1 min)
- [ ] **[S]** Atualizar docs operacionais (runbook + troubleshooting)

## Layer 5 — Ship

- [ ] **[XS]** PR/merge com referência a `spec.md`
- [ ] **[XS]** Validar KPIs da sprint em ambiente real
- [ ] **[XS]** Comunicação de rollout para operadores

---

## Acceptance criteria por sprint

- [ ] Primeira conexão útil em < 1 minuto
- [ ] >95% conexão na primeira tentativa
- [ ] Zero fallback involuntário para demo em produção
- [ ] -70% de intervenção manual para recuperar conexão/sessão

---

## Out of scope (NOT to do here)

- Reescrever arquitetura completa de gateway/adapter
- Migrar stack para orquestração externa complexa
- Refatoração ampla de UI fora do fluxo de conexão/health

---

*Após implementação: Code Reviewer + Spec Manager geram review.md.*
