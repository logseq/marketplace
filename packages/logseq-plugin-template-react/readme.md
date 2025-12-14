## Desenvolvimento: Autenticação Google Calendar (PKCE + Exchange Server)

Este documento descreve o fluxo de desenvolvimento recomendado para autenticação Google Calendar no plugin.
Ele preserva o client secret no servidor local (não no frontend) e usa PKCE para maior segurança.

### Requisitos
- Node 18+ (para `fetch` global usado no servidor nativo)
- pnpm (para rodar o dev server)

### Arquivos importantes
- `server/exchange-server-native.js` — servidor de troca simples (Node nativo, dev only).
- `server/exchange-server.js` — exemplo usando Express (opcional).
- `.env.local` — variáveis do frontend (não deve conter client secret)
- `server/.env` — variáveis do servidor (contém `SERVER_CLIENT_SECRET`) — NÃO COMITAR

### Fluxo rápido (passo-a-passo)

1) Configurar frontend (`.env.local`)

Adicione as variáveis mínimas (exemplo):

```bash
VITE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
VITE_GOOGLE_REDIRECT_URI=http://localhost:5173/oauth2callback.html
# VITE_BACKEND_EXCHANGE_URL será definido abaixo
```

2) Criar `server/.env` (local, não comitar)

No diretório `server/`, crie um arquivo `.env` com as credenciais confidenciais do OAuth (obtidas no Google Cloud Console):

```bash
SERVER_CLIENT_ID=your-client-id.apps.googleusercontent.com
SERVER_CLIENT_SECRET=your-client-secret
SERVER_REDIRECT_URI=http://localhost:5173/oauth2callback.html
```

3) Iniciar o servidor de troca (opção nativa, Node 18+)

No root do projeto:

```bash
# iniciar o servidor nativo (usa server/.env)
node server/exchange-server-native.js
```

Alternativa com express (se preferir):

```bash
cd server
npm install express dotenv node-fetch@2 cors
node exchange-server.js
```

4) Atualizar `.env.local` para usar o backend

No `./.env.local` (frontend), defina:

```bash
VITE_BACKEND_EXCHANGE_URL=http://localhost:3000/exchange
```

Observe: NÃO adicione `VITE_GOOGLE_CLIENT_SECRET` ao `.env.local` em ambientes públicos ou repositórios.

5) Iniciar o dev server do plugin

```bash
pnpm dev
```

6) Fluxo de autenticação

- No painel do plugin, clique em **Conectar Google**.
- O plugin abrirá a página de consentimento do Google; ao finalizar, o código de autorização será recebido pela página de callback e enviado ao frontend.
- O frontend encaminhará `{ code, redirect_uri, code_verifier }` para `VITE_BACKEND_EXCHANGE_URL`.
- O servidor trocador (`server/exchange-server*.js`) fará o POST para `https://oauth2.googleapis.com/token` incluindo `client_secret` (server) e `code_verifier` (PKCE).
- O servidor retorna o JSON do token para o frontend, que salva o token usando `logseq.updateSettings` quando disponível.

### Logs & diagnóstico

- Servidor nativo: stdout indica `Native exchange server listening on http://localhost:3000`.
- Se algo falhar, verifique:
	- Logs do servidor (onde você iniciou `node server/...`)
	- Vite dev logs (console onde rodou `pnpm dev`)
	- Certifique-se de que `VITE_GOOGLE_REDIRECT_URI` corresponda exatamente ao registrado no Google Cloud Console.

### Segurança

- Nunca comite `server/.env` ou `VITE_GOOGLE_CLIENT_SECRET` em repositórios públicos.
- Para produção, hospede um endpoint de troca seguro (protegido) ou crie um OAuth client que suporte PKCE sem secret quando possível.

### Problemas comuns

- `invalid_grant: missing code verifier`: significa que o backend tentou trocar sem o `code_verifier`. Verifique se o frontend envia `code_verifier` e se o servidor o repassa para o token endpoint.
- `client secret missing`: indica que você usou um client que exige secret; utilize o servidor de troca ou crie um OAuth Client do tipo que aceita PKCE (por exemplo Desktop app) para evitar secret.

### Remoção de secrets do frontend (comando rápido)

```bash
# no root do projeto
sed -i '/VITE_GOOGLE_CLIENT_SECRET/d;/VITE_ALLOW_INSECURE_CLIENT_SECRET/d' .env.local
pnpm dev
```

---
Se quiser, posso mover esta seção para o README principal ou ajustá-la conforme preferir.
