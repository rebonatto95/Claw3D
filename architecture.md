# Architecture — Claw3D + Hermes com gateway same-origin e baseline operacional contínua

## 1. Objetivo arquitetural
Preservar a arquitetura gateway-first existente, com **único canal WS do browser para o Studio** em same-origin (`/api/gateway/ws`), mantendo Hermes adapter local ao host e reforçando controles verificáveis de segurança/operacionalização.

## 2. Topologia alvo (fase atual)
- **Processo 1: Studio (Next + custom server)**
  - Bind: `0.0.0.0:3000`
  - Exposição: LAN (desktop/mobile)
- **Processo 2: Hermes adapter**
  - Bind: `127.0.0.1:18789` (local-only)
  - Exposição: nenhuma externa
- **Processo 3: Hermes API**
  - Ex.: `127.0.0.1:8642` (ou endpoint interno confiável)

## 3. Fluxo de rede obrigatório
1. Browser → `http://<host>:3000`
2. Browser → `ws(s)://<host>:3000/api/gateway/ws` (**same-origin único**)
3. Studio (server-side) → `ws://127.0.0.1:18789` (adapter)
4. Adapter → `http://127.0.0.1:8642` (Hermes API)

### Decisões-chave incorporadas
- Sem WS direto browser→adapter.
- Sem `localhost` hardcoded no cliente.
- Adapter isolado em loopback.

## 4. Contratos e enforcement

### 4.1 Autenticação de acesso ao Studio
- Regra: se `HOST=0.0.0.0`, exigir `STUDIO_ACCESS_TOKEN`.
- Validação verificável:
  - Sem token ou token inválido: negar acesso (401/403 conforme implementação).
  - Com token válido: permitir.

### 4.2 Restrição de destinos (allowlist)
- `UPSTREAM_ALLOWLIST`: destinos permitidos para proxy upstream.
- `CUSTOM_RUNTIME_ALLOWLIST`: destinos permitidos para runtime custom.
- Regra operacional: se `CUSTOM_RUNTIME_ALLOWLIST` não for explicitamente separado, herdar de `UPSTREAM_ALLOWLIST` e registrar isso claramente na configuração.
- Validação verificável:
  - Destino permitido conecta.
  - Destino fora da lista bloqueia com erro explícito e log.

## 5. Segurança de logs
- Nunca logar tokens/chaves em claro.
- Implementar mascaramento consistente em logs de configuração/erro:
  - Ex.: `STUDIO_ACCESS_TOKEN=****abcd` (somente sufixo curto opcional).
- Revisar pontos de log de boot e falha de conexão para evitar vazamento acidental.

## 6. Baseline operacional contínua

### 6.1 Modo de execução padrão
- Produção inicial: `npm run build` + `npm run start`.
- `npm run dev` apenas para desenvolvimento local.

### 6.2 Gerenciamento com systemd
Unidades recomendadas:
- `claw3d.service` (Studio)
- `claw3d-hermes-adapter.service` (adapter)

Requisitos mínimos das units:
- `Restart=always`
- `RestartSec=3`
- `WorkingDirectory=/root/Claw3D`
- `EnvironmentFile=/root/Claw3D/.env`
- Logs via `journalctl`
- `WantedBy=multi-user.target`

## 7. Limite da allowlist vs firewall
- Allowlist é controle de aplicação (camada 7) para destino lógico do proxy/runtime.
- Firewall é controle de rede (camada 3/4) para origem/destino/porta.
- Política mínima recomendada:
  - Permitir entrada em `3000/tcp` apenas de sub-redes confiáveis.
  - Bloquear acesso externo desnecessário.
  - Não expor `18789/tcp` externamente.

## 8. Configuração de referência
```env
HOST=0.0.0.0
PORT=3000
STUDIO_ACCESS_TOKEN=<token-forte-32+>

HERMES_API_URL=http://127.0.0.1:8642
HERMES_API_KEY=
HERMES_ADAPTER_HOST=127.0.0.1
HERMES_ADAPTER_PORT=18789

UPSTREAM_ALLOWLIST=127.0.0.1:18789
CUSTOM_RUNTIME_ALLOWLIST=127.0.0.1:18789

NEXT_PUBLIC_GATEWAY_URL=/api/gateway/ws
```

## 9. Verificação técnica (gate de aceite)
1. **Rede/portas**
   - `ss -lntp` mostra `:3000` em `0.0.0.0` e `:18789` em `127.0.0.1`.
2. **WS same-origin**
   - Cliente abre `/api/gateway/ws`; ausência de `ws://localhost:18789` no browser.
3. **Token enforcement**
   - Sem token válido: bloqueio.
4. **Allowlist enforcement**
   - Permitido: conecta.
   - Bloqueado: erro explícito + log.
5. **Logs seguros**
   - Sem segredos em texto puro.
6. **Operação contínua**
   - `npm run build` ok, serviços sobem via `systemd`, restart automático funcional.
7. **Mobile LAN**
   - Celular acessa `http://<ip-lan-host>:3000` e conecta normalmente.

## 10. ADRs resumidas
- **ADR-001**: manter gateway-first/same-origin WS único.
- **ADR-002**: adapter local-only por padrão.
- **ADR-003**: token + allowlist com validação negativa obrigatória.
- **ADR-004**: logs com mascaramento de segredo.
- **ADR-005**: baseline contínua em `build/start` + `systemd`.
- **ADR-006**: firewall complementar obrigatório; allowlist não substitui rede.
