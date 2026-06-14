# tasks.md — Rollout inicial Claw3D + Hermes (VPS)

Objetivo: executar uma sequência única de implementação + validação para deixar o Claw3D funcional com Hermes e acesso mobile seguro, conforme `spec.md` e `architecture.md`.

## Tarefa 0 — Pré-checagem do host e runtime

**Implementação (comandos):**
```bash
cd /root/Claw3D
node -v
npm -v
test -f package.json && echo "OK: package.json"
```

**Validação:**
```bash
# Node >= 20 e npm >= 10
node -p "process.versions.node"
npm -v
```

**Done quando:**
- Node major >= 20.
- npm major >= 10.
- Repositório acessível em `/root/Claw3D`.

---

## Tarefa 1 — Preparar `.env` baseline seguro

**Implementação (comandos):**
```bash
cd /root/Claw3D
cp -n .env.example .env || true

# editar .env e garantir as chaves mínimas
# (usar editor de preferência: nano/vim)
```

**Valores obrigatórios no `.env`:**
```env
HOST=0.0.0.0
PORT=3000
STUDIO_ACCESS_TOKEN=<token-forte-32+>

HERMES_API_URL=http://127.0.0.1:8642
HERMES_API_KEY=
HERMES_ADAPTER_HOST=127.0.0.1
HERMES_ADAPTER_PORT=18789
HERMES_MODEL=hermes
HERMES_AGENT_NAME=Hermes

UPSTREAM_ALLOWLIST=127.0.0.1:18789
CUSTOM_RUNTIME_ALLOWLIST=127.0.0.1:18789

NEXT_PUBLIC_GATEWAY_URL=/api/gateway/ws
```

**Validação:**
```bash
cd /root/Claw3D
grep -E '^(HOST|PORT|STUDIO_ACCESS_TOKEN|HERMES_API_URL|HERMES_ADAPTER_HOST|HERMES_ADAPTER_PORT|UPSTREAM_ALLOWLIST|CUSTOM_RUNTIME_ALLOWLIST|NEXT_PUBLIC_GATEWAY_URL)=' .env
```

**Done quando:**
- `STUDIO_ACCESS_TOKEN` definido e forte (32+ chars).
- Adapter configurado em `127.0.0.1:18789`.
- `NEXT_PUBLIC_GATEWAY_URL` em `/api/gateway/ws` (same-origin).
- Allowlists definidas explicitamente.

---

## Tarefa 2 — Garantir WS same-origin no cliente (sem localhost)

**Implementação (comandos):**
```bash
cd /root/Claw3D
# auditoria de hardcode localhost/ws direto no client
rg -n "localhost:18789|ws://localhost|ws://127.0.0.1|NEXT_PUBLIC_GATEWAY_URL" src server

# aplicar ajuste no código para usar apenas /api/gateway/ws no browser
# (se já estiver correto, apenas registrar evidência)
```

**Validação:**
```bash
cd /root/Claw3D
rg -n "localhost:18789|ws://localhost|ws://127.0.0.1" src
rg -n "/api/gateway/ws" src server
```

**Done quando:**
- Não há referência de WS `localhost` no código de browser.
- Cliente usa apenas endpoint same-origin `/api/gateway/ws`.

---

## Tarefa 3 — Instalar dependências e gerar build de produção

**Implementação (comandos):**
```bash
cd /root/Claw3D
npm install
npm run build
```

**Validação:**
```bash
cd /root/Claw3D
npm run build
```

**Done quando:**
- Build finaliza sem erro bloqueante.
- Artefatos de produção gerados para `npm run start`.

---

## Tarefa 4 — Subir adapter e Studio manualmente (smoke operacional)

**Implementação (comandos):**
```bash
cd /root/Claw3D
# Terminal A
npm run hermes-adapter

# Terminal B
npm run start
```

**Validação (3º terminal):**
```bash
ss -lntp | rg ':3000|:18789'
curl -i http://127.0.0.1:3000/
```

**Done quando:**
- Studio escuta em `0.0.0.0:3000`.
- Adapter escuta apenas em `127.0.0.1:18789`.
- Home do Studio responde HTTP.

---

## Tarefa 5 — Validar enforcement de token (cenário positivo/negativo)

**Implementação (comandos):**
```bash
# Sem token
curl -i http://127.0.0.1:3000/

# Com token (ajustar header/cookie conforme implementação real)
curl -i -H "Authorization: Bearer $STUDIO_ACCESS_TOKEN" http://127.0.0.1:3000/
```

**Validação:**
```bash
# coletar evidências de status
# esperado: sem token => 401/403; com token válido => 200/fluxo autorizado
journalctl -u claw3d.service -n 200 --no-pager || true
```

**Done quando:**
- Requisição sem token é negada.
- Requisição com token válido é permitida.
- Evidência objetiva (status + log) registrada.

---

## Tarefa 6 — Validar allowlist upstream/custom runtime

**Implementação (comandos):**
```bash
cd /root/Claw3D
# Confirmar config ativa
grep -E '^(UPSTREAM_ALLOWLIST|CUSTOM_RUNTIME_ALLOWLIST)=' .env

# Executar teste funcional permitido e bloqueado via fluxo da aplicação
# (permitido: 127.0.0.1:18789; bloqueado: destino fora da allowlist)
```

**Validação:**
```bash
# evidência em logs de sucesso e bloqueio
journalctl -u claw3d.service -n 300 --no-pager || true
journalctl -u claw3d-hermes-adapter.service -n 300 --no-pager || true
```

**Done quando:**
- Destino permitido conecta normalmente.
- Destino não permitido falha com erro explícito.
- Bloqueio aparece em log operacional.

---

## Tarefa 7 — Validar mascaramento de segredos em logs

**Implementação (comandos):**
```bash
# inspecionar logs após boot/falhas controladas
journalctl -u claw3d.service -n 500 --no-pager
journalctl -u claw3d-hermes-adapter.service -n 500 --no-pager
```

**Validação:**
```bash
# busca simples por vazamento de segredo conhecido
# (substituir TOKEN_REAL pelo valor usado localmente para teste)
journalctl -u claw3d.service --no-pager | rg "TOKEN_REAL|HERMES_API_KEY|STUDIO_ACCESS_TOKEN"
```

**Done quando:**
- Nenhum token/chave aparece em claro.
- Logs mostram apenas valores mascarados quando necessário.

---

## Tarefa 8 — Criar serviços `systemd` (produção contínua)

**Implementação (comandos):**
```bash
sudo tee /etc/systemd/system/claw3d-hermes-adapter.service > /dev/null <<'EOF'
[Unit]
Description=Claw3D Hermes Adapter
After=network.target

[Service]
Type=simple
WorkingDirectory=/root/Claw3D
EnvironmentFile=/root/Claw3D/.env
ExecStart=/usr/bin/npm run hermes-adapter
Restart=always
RestartSec=3
User=root

[Install]
WantedBy=multi-user.target
EOF

sudo tee /etc/systemd/system/claw3d.service > /dev/null <<'EOF'
[Unit]
Description=Claw3D Studio
After=network.target claw3d-hermes-adapter.service
Requires=claw3d-hermes-adapter.service

[Service]
Type=simple
WorkingDirectory=/root/Claw3D
EnvironmentFile=/root/Claw3D/.env
ExecStart=/usr/bin/npm run start
Restart=always
RestartSec=3
User=root

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now claw3d-hermes-adapter.service
sudo systemctl enable --now claw3d.service
```

**Validação:**
```bash
systemctl status claw3d-hermes-adapter.service --no-pager
systemctl status claw3d.service --no-pager
systemctl is-enabled claw3d-hermes-adapter.service claw3d.service
```

**Done quando:**
- Ambos serviços ativos (`active (running)`).
- Ambos habilitados no boot (`enabled`).
- `Restart=always` efetivo nas units.

---

## Tarefa 9 — Aplicar firewall para acesso mobile seguro na LAN

**Implementação (UFW exemplo):**
```bash
# ajustar CIDR para sua rede local confiável (ex.: 192.168.1.0/24)
sudo ufw allow from 192.168.1.0/24 to any port 3000 proto tcp
sudo ufw deny 3000/tcp
sudo ufw status numbered
```

**Validação:**
```bash
sudo ufw status verbose
ss -lntp | rg ':3000|:18789'
```

**Done quando:**
- Porta `3000/tcp` acessível somente da sub-rede confiável.
- Porta `18789` não exposta externamente.
- Regras persistentes e documentadas.

---

## Tarefa 10 — Validação E2E (desktop + mobile)

**Implementação (execução):**
- Desktop: abrir `http://<ip-ou-host>:3000`.
- Mobile na mesma LAN: abrir `http://<ip-lan-host>:3000`.
- Autenticar com token e validar conexão do gateway.

**Comandos de apoio:**
```bash
hostname -I
journalctl -u claw3d.service -f
```

**Done quando:**
- Desktop e mobile acessam a UI com sucesso.
- Sessão conecta via `/api/gateway/ws` (sem ajuste manual de WS no cliente).
- Sem erro recorrente de auth/allowlist em operação normal.

---

## Checklist final de aceite (go-live)

- [ ] Build de produção OK (`npm run build`).
- [ ] Studio em `0.0.0.0:3000` e adapter em `127.0.0.1:18789`.
- [ ] Cliente usa apenas `/api/gateway/ws` (same-origin).
- [ ] Token obrigatório e validado (nega sem token; permite com token válido).
- [ ] Allowlist validada (permitido/bloqueado com evidência).
- [ ] Logs sem vazamento de segredo.
- [ ] Serviços `systemd` ativos, habilitados e com restart automático.
- [ ] Firewall aplicado para restringir origem da porta 3000.
- [ ] Acesso desktop + mobile na LAN funcional.
