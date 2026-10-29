import Stripe from "npm:stripe@17.7.0";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.49.4";

export const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2025-02-24.acacia",
  httpClient: Stripe.createFetchHttpClient(),
});

// Cliente com service_role: ignora RLS, usar só no servidor.
export const admin: SupabaseClient = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Valida o JWT enviado pela extensão e devolve o usuário.
export async function getUser(req: Request) {
  const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}

// Busca o customer do Stripe do usuário ou cria um novo (e já grava o vínculo).
export async function getOrCreateCustomer(userId: string, email?: string) {
  const { data } = await admin
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (data?.stripe_customer_id) return data.stripe_customer_id as string;

  const customer = await stripe.customers.create({ email, metadata: { user_id: userId } });
  const { error } = await admin
    .from("subscriptions")
    .insert({ user_id: userId, stripe_customer_id: customer.id });
  if (error) throw error;
  return customer.id;
}
