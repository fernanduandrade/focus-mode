import { admin, corsHeaders, getUser, json, stripe } from "../_shared/clients.ts";

// Abre o portal do cliente do Stripe (cancelar, trocar cartão, ver faturas).
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);

  const user = await getUser(req);
  if (!user) return json({ error: "Não autenticado" }, 401);

  const { data } = await admin
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!data?.stripe_customer_id) return json({ error: "Nenhuma assinatura encontrada" }, 404);

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: data.stripe_customer_id,
      return_url: Deno.env.get("CHECKOUT_RETURN_URL")!,
    });
    return json({ url: session.url });
  } catch (error) {
    console.error(error);
    return json({ error: "Não foi possível abrir o portal" }, 500);
  }
});
