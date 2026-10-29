// Valores públicos do projeto Supabase (Project Settings → API Keys).
// Use a publishable key (sb_publishable_...) ou a anon key legada. Ela é pública por design: o acesso aos dados é protegido por RLS.
// Nunca coloque aqui a secret key (sb_secret_...), a service_role nem chaves do Stripe.
export const SUPABASE_URL = "https://ibbadpavucorzmjeeawy.supabase.co";
export const SUPABASE_ANON_KEY = "sb_publishable_mxbTG3PDYGahux7ttckBLA_ndXbsFbI";

// URL para onde o Stripe redireciona depois do checkout (mesma do secret CHECKOUT_RETURN_URL).
// Quando uma aba abre essa URL, a extensão atualiza o status da assinatura.
export const CHECKOUT_RETURN_URL = "https://fernanduandrade.github.io/focus-mode/";

export const FREE_SITE_LIMIT = 2;
