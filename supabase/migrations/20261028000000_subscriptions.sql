-- Status da assinatura Stripe por usuário. Escrita apenas pelas Edge Functions (service_role).
create table public.subscriptions (
  user_id uuid primary key references auth.users (id) on delete cascade,
  stripe_customer_id text unique not null,
  stripe_subscription_id text unique,
  status text,
  price_id text,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.subscriptions enable row level security;

-- Permissão explícita (o projeto pode estar com "expose new tables" desligado).
-- O RLS abaixo ainda restringe cada usuário à própria linha.
grant select on public.subscriptions to authenticated;
grant select, insert, update, delete on public.subscriptions to service_role;

-- O usuário logado só pode ler a própria linha. Não há policies de escrita:
-- inserts/updates acontecem só com a service_role key, que ignora RLS.
create policy "usuario le a propria assinatura"
  on public.subscriptions for select
  to authenticated
  using ((select auth.uid()) = user_id);
