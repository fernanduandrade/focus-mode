import Stripe from "npm:stripe@17.7.0";
import { admin, stripe } from "../_shared/clients.ts";

const cryptoProvider = Stripe.createSubtleCryptoProvider();

async function saveSubscription(subscription: Stripe.Subscription) {
  const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
  const item = subscription.items.data[0];
  const periodEnd = (subscription as { current_period_end?: number }).current_period_end ?? item?.current_period_end;

  const { error } = await admin
    .from("subscriptions")
    .update({
      stripe_subscription_id: subscription.id,
      status: subscription.status,
      price_id: item?.price.id ?? null,
      current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
      cancel_at_period_end: subscription.cancel_at_period_end,
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_customer_id", customerId);
  if (error) throw error;
}

Deno.serve(async (req) => {
  const signature = req.headers.get("Stripe-Signature");
  if (!signature) return new Response("Sem assinatura", { status: 400 });

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      await req.text(),
      signature,
      Deno.env.get("STRIPE_WEBHOOK_SECRET")!,
      undefined,
      cryptoProvider,
    );
  } catch (error) {
    console.error("Assinatura do webhook inválida:", error.message);
    return new Response("Assinatura inválida", { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        if (session.mode === "subscription" && session.subscription) {
          const id = typeof session.subscription === "string" ? session.subscription : session.subscription.id;
          await saveSubscription(await stripe.subscriptions.retrieve(id));
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        // Sempre relê do Stripe para não gravar um estado antigo se os eventos chegarem fora de ordem.
        await saveSubscription(await stripe.subscriptions.retrieve(event.data.object.id));
        break;
    }
  } catch (error) {
    console.error(`Erro ao processar ${event.type}:`, error);
    return new Response("Erro interno", { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { "Content-Type": "application/json" },
  });
});
