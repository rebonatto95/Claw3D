# Spec — Deploy inicial do Claw3D com Hermes (pronto para implementação)

## Contexto
- Primeiro deploy operacional do Claw3D neste host Linux.
- Stack atual: Next.js + servidor Node custom (`server/index.js`) + Hermes adapter (`npm run hermes-adapter`).
- Objetivo: disponibilizar Studio em LAN (desktop + mobile) com segurança mínima verificável, sem refatoração estrutural.

## Objetivo
Entregar execução estável do Claw3D com fluxo **WebSocket único same-origin** via `ws(s)://<host>/api/gateway/ws`, mantendo o Hermes adapter local ao host e controles mínimos obrigatórios (token + allowlists + firewall).

## Escopo
1. Bootstrap de runtime (Node 20+, npm 10+).
2. Configuração `.env` com variáveis mínimas de execução e segurança.
3. Execução do adapter Hermes e do Studio.
4. Acesso LAN por desktop e mobile.
5. Validação verificável de enforcement de token/allowlists.
6. Baseline operacional contínua (`build/start` + `systemd`).

## Fora de escopo
- HA, autoscaling, Kubernetes.
- TLS público/domínio nesta fase.
- SSO/OIDC/multi-tenant.
- Refatoração profunda do protocolo gateway.

## Requisitos funcionais

### RF-01 — Fluxo WS único same-origin (ajuste #1)
- O cliente **não** deve apontar para `ws://localhost:...`.
- O cliente deve usar exclusivamente `ws(s)://<host>/api/gateway/ws` (same-origin).
- O encaminhamento para upstream ocorre apenas no servidor.

### RF-02 — Compatibilidade mobile sem localhost no cliente (ajuste #2)
- Remover dependência de `localhost` em configuração de gateway consumida pelo browser.
- A URL acessada no celular (`http://<ip-lan>:3000`) deve funcionar sem ajustes manuais de WS no client.

### RF-03 — Adapter Hermes local-only (ajuste #3)
- `hermes-adapter` deve bindar em loopback (`127.0.0.1`), não em `0.0.0.0`.
- Porta padrão: `18789`.
- Não expor adapter diretamente na LAN.

### RF-04 — Enforcement verificável de token e allowlists (ajuste #4)
- Com `HOST=0.0.0.0`, `STUDIO_ACCESS_TOKEN` é obrigatório.
- `UPSTREAM_ALLOWLIST` obrigatório para destinos de proxy upstream.
- `CUSTOM_RUNTIME_ALLOWLIST` obrigatório (ou herança explícita e auditável de `UPSTREAM_ALLOWLIST`).
- Deve existir teste manual de cenário permitido e bloqueado com evidência objetiva (status HTTP/WS e log).

### RF-05 — Mascaramento de segredos em logs (ajuste #5)
- Tokens/chaves (`STUDIO_ACCESS_TOKEN`, `HERMES_API_KEY`, etc.) não podem aparecer em texto puro nos logs.
- Logs devem exibir segredo mascarado (`****`) quando necessário para diagnóstico.

### RF-06 — Baseline operacional contínua (ajuste #6)
- Operação padrão deve ser `npm run build` + `npm run start` (não apenas `npm run dev`).
- Serviços devem rodar via `systemd` com restart automático e boot persistente.

### RF-07 — Limites da allowlist + firewall (ajuste #7)
- Allowlist controla **destinos de aplicação** (L7), não substitui firewall (L3/L4).
- Firewall deve restringir origem de acesso à porta do Studio (ex.: somente sub-rede LAN confiável).

## Requisitos não funcionais
- Node 20+ / npm 10+.
- Sem mudanças arquiteturais fora de configuração/operação e ajustes estritamente necessários.
- Observabilidade mínima: logs de boot, bind de portas, falhas de auth/allowlist/upstream.

## Configuração de referência (`.env`)
```env
# Exposição Studio
HOST=0.0.0.0
PORT=3000
STUDIO_ACCESS_TOKEN=<token-forte-32+>

# Hermes runtime
HERMES_API_URL=http://127.0.0.1:8642
HERMES_API_KEY=
HERMES_ADAPTER_HOST=127.0.0.1
HERMES_ADAPTER_PORT=18789
HERMES_MODEL=hermes
HERMES_AGENT_NAME=Hermes

# Segurança de upstream/custom runtime
UPSTREAM_ALLOWLIST=127.0.0.1:18789
CUSTOM_RUNTIME_ALLOWLIST=127.0.0.1:18789

# Gateway browser: SEM localhost hardcoded
# usar same-origin
NEXT_PUBLIC_GATEWAY_URL=/api/gateway/ws
```

## Critérios de aceite (testáveis)
1. `npm run build` conclui sem erro bloqueante.
2. `npm run start` sobe em `0.0.0.0:3000`.
3. Adapter escuta somente em `127.0.0.1:18789`.
4. Desktop e mobile acessam `http://<host-ou-ip>:3000` e conectam via `/api/gateway/ws`.
5. Requisição sem token válido é negada (401/403 conforme implementação).
6. Destino fora de allowlist é bloqueado com erro explícito.
7. Logs não vazam segredos em texto puro.
8. Serviços habilitados no `systemd` com restart policy ativa.
9. Firewall documentado/aplicado para limitar origem de acesso à porta 3000.

## Definition of Done
- [ ] `.env` configurado conforme baseline.
- [ ] Fluxo WS client-only same-origin aplicado.
- [ ] Adapter local-only validado por `ss -lntp`.
- [ ] Enforcement token/allowlist validado (positivo/negativo).
- [ ] Mascaramento de segredo validado em logs.
- [ ] Build/start em modo contínuo funcional.
- [ ] Units `systemd` instaladas/habilitadas.
- [ ] Regra de firewall definida para escopo LAN.

## Runbook mínimo de validação
1. `npm install`
2. `npm run build`
3. Terminal A: `npm run hermes-adapter`
4. Terminal B: `npm run start`
5. Validar portas:
   - Studio em `0.0.0.0:3000`
   - Adapter em `127.0.0.1:18789`
6. Desktop: abrir `http://localhost:3000` e autenticar.
7. Mobile: abrir `http://<ip-lan-host>:3000` e autenticar.
8. Teste negativo token inválido.
9. Teste negativo allowlist (upstream não permitido).
10. Revisar logs e confirmar segredos mascarados.

## Riscos e mitigação
- Risco: exposição indevida da porta 3000.
  - Mitigação: token obrigatório + firewall por origem.
- Risco: `localhost` no client quebrar mobile.
  - Mitigação: same-origin `/api/gateway/ws`.
- Risco: adapter exposto em rede.
  - Mitigação: bind `127.0.0.1` e não publicar porta.
- Risco: allowlist insuficiente como controle único.
  - Mitigação: combinar allowlist (app) + firewall (rede).
