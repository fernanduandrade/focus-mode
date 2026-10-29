import * as store from "./storage.js";
import { activeSites } from "./sites.js";

// Recria as regras dinâmicas do declarativeNetRequest a partir da lista salva.
// Só o background chama isto; as chamadas são enfileiradas para duas sincronizações
// simultâneas não tentarem criar regras com o mesmo id.
let queue = Promise.resolve();

export function syncRules() {
  queue = queue.then(applyRules, applyRules);
  return queue;
}

async function applyRules() {
  const sites = await store.get("sites", []);
  const plan = await store.get("plan", { premium: false });
  const domains = activeSites(sites, plan.premium);

  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  const addRules = domains.map((domain, index) => ({
    id: index + 1,
    priority: 1,
    action: {
      type: "redirect",
      redirect: { extensionPath: `/blocked.html?site=${encodeURIComponent(domain)}` },
    },
    condition: {
      // "||dominio^" cobre o domínio e todos os subdomínios.
      urlFilter: `||${domain}^`,
      resourceTypes: ["main_frame"],
    },
  }));

  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: existing.map((rule) => rule.id),
    addRules,
  });
}
