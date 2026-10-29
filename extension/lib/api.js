// Cliente mínimo para Supabase Auth, REST e Edge Functions via fetch (sem dependências/bundler).
import { SUPABASE_URL, SUPABASE_ANON_KEY, CHECKOUT_RETURN_URL } from "../config.js";
import * as store from "./storage.js";
import { t } from "./i18n.js";

const PREMIUM_STATUSES = ["active", "trialing"];

async function request(path, { method = "GET", body, token } = {}) {
  // A publishable key (sb_publishable_...) vai só no header apikey; Authorization leva apenas o JWT do usuário.
  const headers = { apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${SUPABASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const message = data?.msg || data?.error_description || data?.message || data?.error || `Erro ${res.status}`;
    const error = new Error(message);
    error.status = res.status;
    throw error;
  }
  return data;
}

function saveSession(data) {
  const session = {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: data.expires_at ?? Math.floor(Date.now() / 1000) + data.expires_in,
    user: { id: data.user.id, email: data.user.email },
  };
  return store.set("session", session).then(() => session);
}

// Os links dos e-mails de confirmação e de nova senha abrem a página do GitHub Pages (docs/index.html).
const AUTH_REDIRECT = `redirect_to=${encodeURIComponent(CHECKOUT_RETURN_URL)}`;

export async function signUp(email, password) {
  const data = await request(`/auth/v1/signup?${AUTH_REDIRECT}`, { method: "POST", body: { email, password } });
  // Com confirmação de e-mail ativada o Supabase não devolve sessão: o usuário precisa confirmar antes de entrar.
  if (!data?.access_token) return { needsConfirmation: true };
  return { session: await saveSession(data) };
}

// Envia o e-mail "Esqueci minha senha". O link abre docs/index.html, onde o usuário cria a nova senha.
export async function requestPasswordReset(email) {
  await request(`/auth/v1/recover?${AUTH_REDIRECT}`, { method: "POST", body: { email } });
}

export async function signIn(email, password) {
  const data = await request("/auth/v1/token?grant_type=password", { method: "POST", body: { email, password } });
  return saveSession(data);
}

export async function signOut() {
  const session = await store.get("session");
  if (session) {
    await request("/auth/v1/logout", { method: "POST", token: session.access_token }).catch(() => {});
  }
  await store.remove("session");
  await store.set("plan", { premium: false, status: null, checkedAt: Date.now() });
}

// Devolve uma sessão válida, renovando o token se faltar menos de 1 minuto para expirar.
export async function getSession() {
  const session = await store.get("session");
  if (!session) return null;
  if (session.expires_at - 60 > Date.now() / 1000) return session;
  try {
    const data = await request("/auth/v1/token?grant_type=refresh_token", {
      method: "POST",
      body: { refresh_token: session.refresh_token },
    });
    return await saveSession(data);
  } catch (error) {
    if (error.status === 400 || error.status === 401) await store.remove("session");
    return null;
  }
}

// Consulta o status da assinatura (RLS garante que o usuário só lê a própria linha) e guarda em cache.
export async function refreshPlan() {
  const session = await getSession();
  if (!session) {
    const plan = { premium: false, status: null, checkedAt: Date.now() };
    await store.set("plan", plan);
    return plan;
  }
  const rows = await request(
    `/rest/v1/subscriptions?select=status,current_period_end&user_id=eq.${session.user.id}`,
    { token: session.access_token },
  );
  const row = rows?.[0];
  const plan = {
    premium: Boolean(row && PREMIUM_STATUSES.includes(row.status)),
    status: row?.status ?? null,
    currentPeriodEnd: row?.current_period_end ?? null,
    checkedAt: Date.now(),
  };
  await store.set("plan", plan);
  return plan;
}

async function callFunction(name) {
  const session = await getSession();
  if (!session) throw new Error(t("errorLoginFirst"));
  return request(`/functions/v1/${name}`, { method: "POST", token: session.access_token, body: {} });
}

export async function createCheckoutUrl() {
  const { url } = await callFunction("create-checkout");
  return url;
}

export async function createPortalUrl() {
  const { url } = await callFunction("customer-portal");
  return url;
}
