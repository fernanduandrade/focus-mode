// Operações sobre a lista de sites, compartilhadas entre o popup e a página de configurações.
// Todas devolvem { ok, error?, sites } para a interface mostrar a mensagem certa.
import * as store from "./storage.js";
import { normalizeDomain, siteLimit } from "./sites.js";
import { FREE_SITE_LIMIT } from "../config.js";
import { t } from "./i18n.js";

async function load() {
  const sites = await store.get("sites", []);
  const plan = await store.get("plan", { premium: false });
  return { sites, premium: Boolean(plan.premium) };
}

export async function addSite(input) {
  const { sites, premium } = await load();
  const domain = normalizeDomain(input);
  if (!domain) return { ok: false, error: t("errorInvalidDomain"), sites };
  if (sites.includes(domain)) return { ok: false, error: t("errorAlreadyBlocked", domain), sites };
  if (sites.length >= siteLimit(premium)) {
    return { ok: false, error: t("errorFreeLimit", FREE_SITE_LIMIT), limit: true, sites };
  }
  const next = [...sites, domain];
  await store.set("sites", next);
  return { ok: true, domain, sites: next };
}

export async function removeSite(domain) {
  const { sites } = await load();
  const next = sites.filter((s) => s !== domain);
  await store.set("sites", next);
  return { ok: true, sites: next };
}

// Troca um site por outro na mesma posição, então não conta contra o limite.
export async function replaceSite(oldDomain, input) {
  const { sites } = await load();
  const domain = normalizeDomain(input);
  if (!domain) return { ok: false, error: t("errorInvalidDomain"), sites };
  if (domain !== oldDomain && sites.includes(domain)) {
    return { ok: false, error: t("errorAlreadyBlocked", domain), sites };
  }
  const next = sites.map((s) => (s === oldDomain ? domain : s));
  await store.set("sites", next);
  return { ok: true, domain, sites: next };
}

// Domínio e favicon da aba ativa, ou null se for uma página interna (chrome://, nova aba, etc).
export async function currentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.url || !/^https?:/.test(tab.url)) return null;
  const domain = normalizeDomain(tab.url);
  return domain ? { domain, favIconUrl: tab.favIconUrl || null } : null;
}
