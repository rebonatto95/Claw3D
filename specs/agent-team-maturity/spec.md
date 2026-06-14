# Spec: Agent Team Maturity Sprint (2 semanas)

Status: **APPROVED**
Author: Raphael + Hermes Tech Lead
Date: 2026-05-24
Related: `/root/Claw3D/specs/agent-team-maturity/tasks.md`

## Problem

Hoje o time de agentes entrega resultado, mas com fricção operacional alta no primeiro uso: onboarding confuso (token/cookie/backend), erros pouco acionáveis, reconexão inconsistente e estado legado puxando comportamento inesperado (ex.: fallback para demo). Isso aumenta suporte manual e reduz autonomia.

## Users

- Raphael (owner/operator) administrando o ambiente Claw3D + Hermes
- Usuários internos que entram no Studio para operar agentes
- Equipe de agentes (orchestrator, dev1, dev2, devops) como runtime produtivo

## Expected outcome

- Primeiro acesso funcional em < 1 minuto sem DevTools.
- Backend Hermes estável e determinístico em produção.
- Falhas de conexão mostram causa provável + ação clara.
- Sessões se recuperam sozinhas em falhas transitórias.

## In scope

- Fluxo de acesso ao Studio sem exigir console manual para cookie.
- Hermes como backend padrão fixo em produção; demo isolado por flag.
- Mapeamento de erros de conexão para mensagens acionáveis.
- Auto-reconnect com backoff e cancelamento seguro.
- Normalização de estado legado de configuração.
- Painel mínimo de saúde operacional (studio, adapter, ws, backend ativo).
- Runbook de recuperação rápida + validações pós-boot.

## Out of scope

- Reescrever arquitetura de gateway/adapter do zero.
- Migração para infraestrutura externa complexa (K8s/service mesh).
- Refatoração ampla de UI fora das telas de conexão/estado.
- Mudanças no core do Hermes fora do necessário para integração Claw3D.

## Constraints

- Manter produção ativa durante a sprint (sem downtime prolongado).
- Preservar segurança já aplicada (Tailscale + restrição de exposição pública).
- Alterações incrementais e reversíveis.
- Compatibilidade com setup atual em `/root/Claw3D` e systemd.

## Risks

- **Quebra de compatibilidade com estado salvo antigo**: pode bloquear login/conexão — mitigar com migração defensiva e fallback seguro.
- **Reconnect agressivo**: pode gerar loops e consumo excessivo — mitigar com backoff e limites.
- **Mudança de auth UX**: risco de regressão de segurança — mitigar com validação explícita de fluxo e testes negativos.
- **Ambiente demo/prod misturado**: confusão operacional — mitigar com guardrails de backend em produção.

## Success criteria

- Tempo até primeira conexão útil: **< 1 min**.
- Taxa de conexão na primeira tentativa: **> 95%**.
- Zero fallback involuntário para demo em produção.
- Redução de pelo menos **70%** de intervenção manual para recuperar sessão/conexão.
- Serviços sobem após reboot e permanecem estáveis com runbook validado.

---

*Próximo passo: architecture.md e execução conforme tasks.md.*
