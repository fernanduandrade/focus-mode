import { syncRules } from "./lib/rules.js";
import { refreshPlan } from "./lib/api.js";
import { CHECKOUT_RETURN_URL } from "./config.js";

const PLAN_ALARM = "refresh-plan";

async function safeRefreshPlan() {
  try {
    await refreshPlan();
  } catch (error) {
    // Sem rede ou backend fora do ar: mantém o último status conhecido.
    console.warn("Não foi possível atualizar o plano:", error.message);
  }
}

chrome.runtime.onInstalled.addListener(async () => {
  chrome.alarms.create(PLAN_ALARM, { periodInMinutes: 60 });
  await safeRefreshPlan();
  await syncRules();
});

chrome.runtime.onStartup.addListener(async () => {
  await safeRefreshPlan();
  await syncRules();
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === PLAN_ALARM) await safeRefreshPlan();
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && (changes.sites || changes.plan)) syncRules();
});

// Ao voltar do Stripe Checkout, atualiza o plano na hora em vez de esperar o alarme.
chrome.tabs.onUpdated.addListener((_tabId, info) => {
  if (info.url && info.url.startsWith(CHECKOUT_RETURN_URL)) safeRefreshPlan();
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "refresh-plan") {
    safeRefreshPlan().then(() => sendResponse({ ok: true }));
    return true;
  }
  if (message?.type === "sync-rules") {
    syncRules().then(() => sendResponse({ ok: true }));
    return true;
  }
});
