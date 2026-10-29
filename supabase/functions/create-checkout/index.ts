import { corsHeaders, getOrCreateCustomer, getUser, json, stripe } from "../_shared/clients.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);

  const user = await getUser(req);
  if (!user) return json({ error: "Não autenticado" }, 401);

  try {
    const customer = await getOrCreateCustomer(user.id, user.email);
    const returnUrl = Deno.env.get("CHECKOUT_RETURN_URL")!;
    // O preço tem USD e BRL (currency_options). A extensão indica a moeda pelo fuso horário.
    const body = await req.json().catch(() => ({}));
    const currency = ["brl", "usd"].includes(body?.currency) ? body.currency : "usd";

    // Um checkout aberto em outra moeda trava o cliente nela ("cannot combine currencies").
    // Expira os checkouts abertos antes de criar um novo.
    const open = await stripe.checkout.sessions.list({ customer, status: "open", limit: 20 });
    for (const old of open.data) await stripe.checkout.sessions.expire(old.id);

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      currency,
      customer,
      client_reference_id: user.id,
      line_items: [{ price: Deno.env.get("STRIPE_PRICE_ID")!, quantity: 1 }],
      subscription_data: { metadata: { user_id: user.id } },
      allow_promotion_codes: true,
      success_url: `${returnUrl}?checkout=success`,
      cancel_url: `${returnUrl}?checkout=cancel`,
    });

    return json({ url: session.url });
  } catch (error) {
    console.error(error);
    return json({ error: "Não foi possível iniciar o checkout" }, 500);
  }
});
