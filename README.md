# Focus Block

Extensão do Chrome (Manifest V3) para bloquear sites e manter o foco.

- **Free:** até 2 sites bloqueados.
- **Premium (US$ 3/mês via Stripe):** sites ilimitados. Exige conta (e-mail e senha).

## Arquitetura

```
extension/          Extensão Chrome (JS puro, sem build)
  background.js     Service worker: aplica regras declarativeNetRequest e atualiza o plano a cada hora
  popup.*           Lista de sites, login/cadastro, botão de assinar
  blocked.*         Página exibida no lugar do site bloqueado
  lib/api.js        Cliente mínimo de Supabase Auth/REST/Functions via fetch
supabase/
  migrations/       Tabela `subscriptions` com RLS (usuário só lê a própria linha)
  functions/
    create-checkout   Cria sessão do Stripe Checkout para o usuário logado
    customer-portal   Abre o portal do cliente Stripe (cancelar, trocar cartão)
    stripe-webhook    Recebe eventos do Stripe e grava o status da assinatura
docs/index.html     Página de retorno do checkout (GitHub Pages)
```

Fluxo da assinatura:

1. Usuário cria conta ou entra pelo popup (Supabase Auth).
2. "Assinar Premium" chama `create-checkout`, que devolve a URL do Stripe Checkout.
3. Após o pagamento, o Stripe chama `stripe-webhook`, que grava `status = active` na tabela.
4. A extensão lê `subscriptions` com o token do usuário e libera sites ilimitados.

Se a assinatura for cancelada ou falhar, os sites além dos 2 primeiros ficam salvos mas inativos até o usuário assinar de novo.

> O limite é verificado na extensão. Como toda extensão roda no computador do usuário, alguém técnico conseguiria burlar isso editando o código local; para um app de foco é um risco aceitável.

## Configuração

Nenhuma chave secreta vai para a extensão nem para o repositório.

### 1. Stripe

1. Crie um produto "Focus Block Premium" com preço recorrente de **US$ 3,00/mês** e copie o **Price ID** (`price_...`).
2. Em *Settings → Billing → Customer portal*, ative o portal (permitir cancelamento).
3. Use o modo de teste primeiro (chaves `sk_test_...`).

### 2. Supabase

```bash
# No Windows use "npx supabase" (instalação global via npm não é suportada)
supabase login
supabase link --project-ref SEU_PROJECT_REF
supabase db push             # cria a tabela subscriptions

supabase secrets set \
  STRIPE_SECRET_KEY=sk_test_... \
  STRIPE_PRICE_ID=price_... \
  CHECKOUT_RETURN_URL=https://SEU-USUARIO.github.io/focus-mode/

supabase functions deploy create-checkout
supabase functions deploy customer-portal
supabase functions deploy stripe-webhook --no-verify-jwt
```

`SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` já existem automaticamente nas Edge Functions.

### 3. Webhook do Stripe

1. Em *Developers → Webhooks*, adicione o endpoint
   `https://SEU_PROJECT_REF.supabase.co/functions/v1/stripe-webhook`.
2. Eventos: `checkout.session.completed`, `customer.subscription.created`,
   `customer.subscription.updated`, `customer.subscription.deleted`.
3. Copie o *Signing secret* (`whsec_...`) e rode:
   `supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...`

### 4. Página de retorno

Ative o GitHub Pages do repositório apontando para a pasta `/docs` da branch `main`.

### 5. Extensão

1. Edite `extension/config.js` com `SUPABASE_URL`, a **anon key** (pública) e `CHECKOUT_RETURN_URL`.
2. Abra `chrome://extensions`, ative o *Modo do desenvolvedor* e clique em *Carregar sem compactação* escolhendo a pasta `extension/`.

Cartão de teste do Stripe: `4242 4242 4242 4242`, qualquer data futura e CVC.

## Publicar na Chrome Web Store

Compacte a pasta `extension/` em um `.zip` e envie no [Developer Dashboard](https://chrome.google.com/webstore/devconsole) (taxa única de US$ 5). A loja pede justificativa para `host_permissions: <all_urls>`: é necessária para redirecionar qualquer site que o usuário escolher para a página de bloqueio.
