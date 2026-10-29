import * as store from "./storage.js";
import { activeSites } from "./sites.js";

// Recria as regras dinâmicas do declarativeNetRequest a partir da lista salva.
// Só o background chama isto; as chamadas são enfileiradas para duas sincronizações
// simultâneas não tentarem criar regras com o mesmo id.
let queue = Promise.resolve();

function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Lê site e URL original de uma tela de bloqueio (?site=...&url=<URL original sem codificar>).
export function parseBlockedUrl(href) {
  const query = href.slice(href.indexOf("?") + 1);
  const urlIndex = query.indexOf("&url=");
  const params = new URLSearchParams(urlIndex === -1 ? query : query.slice(0, urlIndex));
  return {
    site: params.get("site"),
    url: urlIndex === -1 ? null : query.slice(urlIndex + "&url=".length),
  };
}

// Abas paradas na tela de bloqueio de um site que não está mais bloqueado voltam ao site.
async function releaseTabs(domains) {
  const tabs = await chrome.tabs.query({ url: `${chrome.runtime.getURL("blocked.html")}*` });
  for (const tab of tabs) {
    const { site, url } = parseBlockedUrl(tab.url);
    if (site && !domains.includes(site)) {
      const safeUrl = url && /^https?:\/\//.test(url) ? url : `https://${site}`;
      chrome.tabs.update(tab.id, { url: safeUrl });
    }
  }
}

export function syncRules() {
  queue = queue.then(applyRules, applyRules);
  return queue;
}

async function applyRules() {
  const sites = await store.get("sites", []);
  const plan = await store.get("plan", { premium: false });
  const domains = activeSites(sites, plan.premium);

  const blockedPage = chrome.runtime.getURL("blocked.html");
  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  const addRules = domains.map((domain, index) => ({
    id: index + 1,
    priority: 1,
    action: {
      type: "redirect",
      // \0 é a URL original inteira; vai por último para a tela de bloqueio poder voltar a ela.
      redirect: { regexSubstitution: `${blockedPage}?site=${encodeURIComponent(domain)}&url=\\0` },
    },
    condition: {
      // Cobre o domínio e todos os subdomínios.
      regexFilter: `^https?://([^/?#]*\\.)?${escapeRegex(domain)}(:[0-9]+)?([/?#].*)?$`,
      resourceTypes: ["main_frame"],
    },
  }));

  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: existing.map((rule) => rule.id),
    addRules,
  });
  await releaseTabs(domains);
}
