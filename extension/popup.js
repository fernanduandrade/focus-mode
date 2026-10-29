import * as store from "./lib/storage.js";
import * as api from "./lib/api.js";
import { siteLimit, activeSites, faviconUrl } from "./lib/sites.js";
import { addSite as addSiteAction, removeSite as removeSiteAction, currentTab } from "./lib/site-actions.js";
import { t, formatDate, localizePage } from "./lib/i18n.js";
import { FREE_SITE_LIMIT } from "./config.js";

const $ = (id) => document.getElementById(id);

// O popup mostra só os sites adicionados por último; a lista completa fica nas configurações.
const POPUP_LIST_SIZE = 3;

const state = { sites: [], plan: { premium: false }, session: null, current: null };

function showError(element, message) {
  element.textContent = message;
  element.hidden = !message;
}

function renderSites() {
  const list = $("site-list");
  const active = new Set(activeSites(state.sites, state.plan.premium));
  const recent = state.sites.slice(-POPUP_LIST_SIZE).reverse();
  list.replaceChildren(
    ...recent.map((site) => {
      const item = document.createElement("li");
      if (!active.has(site)) {
        item.classList.add("inactive");
        item.title = t("inactiveHint", FREE_SITE_LIMIT);
      }
      const name = document.createElement("span");
      name.textContent = site;
      const remove = document.createElement("button");
      remove.type = "button";
      remove.textContent = t("remove");
      remove.addEventListener("click", () => removeSite(site));
      item.append(name, remove);
      return item;
    }),
  );

  $("empty-list").hidden = state.sites.length > 0;
  $("options-btn").textContent = state.sites.length > POPUP_LIST_SIZE
    ? t("seeAllSites", state.sites.length)
    : t("manageSites");
  const limit = siteLimit(state.plan.premium);
  $("limit-info").textContent = state.plan.premium
    ? t("countPremium", state.sites.length)
    : t("countFree", Math.min(state.sites.length, limit), FREE_SITE_LIMIT);
  $("upsell").hidden = state.plan.premium || state.sites.length < FREE_SITE_LIMIT;
}

function renderCurrent() {
  const domain = state.current?.domain;
  $("current").hidden = !domain;
  if (!domain) return;
  $("current-domain").textContent = domain;
  const icon = $("current-icon");
  // Usa o favicon que a própria aba já carregou; o cache do Chrome fica como alternativa.
  const src = state.current.favIconUrl || faviconUrl(domain);
  if (icon.getAttribute("src") !== src) {
    icon.hidden = false;
    icon.src = src;
  }
  const blocked = state.sites.includes(domain);
  $("block-current-btn").hidden = blocked;
  $("current-blocked").hidden = !blocked;
}

function renderAccount() {
  const loggedIn = Boolean(state.session);
  $("logged-out").hidden = loggedIn;
  $("logged-in").hidden = !loggedIn;

  const badge = $("plan-badge");
  badge.textContent = state.plan.premium ? "Premium" : "Free";
  badge.classList.toggle("premium", state.plan.premium);

  if (!loggedIn) return;
  $("user-email").textContent = state.session.user.email;
  $("manage-btn").hidden = !state.plan.status;
  if (state.plan.premium) {
    const end = state.plan.currentPeriodEnd ? formatDate(state.plan.currentPeriodEnd) : null;
    if (state.plan.canceled && end) {
      $("plan-detail").textContent = t("planCanceledUntil", end);
      badge.textContent = t("badgeCanceled", end);
    } else {
      $("plan-detail").textContent = end ? t("planPremiumUntil", end) : t("planPremium");
    }
  } else if (state.plan.status) {
    $("plan-detail").textContent = t("planStatus", state.plan.status, FREE_SITE_LIMIT);
  } else {
    $("plan-detail").textContent = t("planFree");
  }
}

function render() {
  renderCurrent();
  renderSites();
  renderAccount();
}

async function load() {
  state.sites = await store.get("sites", []);
  state.plan = await store.get("plan", { premium: false });
  state.session = await api.getSession();
  state.current = await currentTab();
  render();

  if (state.session) {
    try {
      state.plan = await api.refreshPlan();
      render();
    } catch {
      // Mantém o plano em cache se o backend não responder.
    }
  }
}

function applyResult(result) {
  state.sites = result.sites;
  showError($("site-error"), result.ok ? "" : result.error);
  if (result.limit) $("upsell").hidden = false;
  render();
  return result.ok;
}

async function addSite(event) {
  event.preventDefault();
  if (applyResult(await addSiteAction($("site-input").value))) $("site-input").value = "";
}

async function blockCurrentSite() {
  if (!applyResult(await addSiteAction(state.current.domain))) return;
  // Aplica as regras antes de recarregar a aba, para o bloqueio valer na hora.
  await chrome.runtime.sendMessage({ type: "sync-rules" });
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) chrome.tabs.reload(tab.id);
}

async function removeSite(site) {
  applyResult(await removeSiteAction(site));
}

async function handleAuth(event) {
  event.preventDefault();
  const action = event.submitter?.dataset.action ?? "signin";
  const message = $("auth-message");
  const email = $("email").value.trim();
  const password = $("password").value;
  const buttons = $("auth-form").querySelectorAll("button");
  buttons.forEach((b) => (b.disabled = true));
  try {
    if (action === "signup") {
      const result = await api.signUp(email, password);
      if (result.needsConfirmation) {
        showError(message, t("signupConfirm"));
        return;
      }
    } else {
      await api.signIn(email, password);
    }
    showError(message, "");
    $("password").value = "";
    await load();
  } catch (error) {
    showError(message, translateAuthError(error.message));
  } finally {
    buttons.forEach((b) => (b.disabled = false));
  }
}

function translateAuthError(message) {
  if (/invalid login credentials/i.test(message)) return t("errorInvalidCredentials");
  if (/email not confirmed/i.test(message)) return t("errorEmailNotConfirmed");
  if (/already registered/i.test(message)) return t("errorAlreadyRegistered");
  return message;
}

async function forgotPassword(event) {
  const message = $("auth-message");
  const email = $("email").value.trim();
  if (!email || !$("email").checkValidity()) {
    showError(message, t("errorEnterEmail"));
    $("email").focus();
    return;
  }
  event.currentTarget.disabled = true;
  try {
    await api.requestPasswordReset(email);
    showError(message, t("resetSent"));
  } catch (error) {
    showError(message, translateAuthError(error.message));
  } finally {
    $("forgot-btn").disabled = false;
  }
}

async function openStripe(createUrl, button) {
  if (!state.session) {
    showError($("auth-message"), t("errorLoginToSubscribe"));
    $("email").focus();
    return;
  }
  button.disabled = true;
  try {
    const url = await createUrl();
    chrome.tabs.create({ url });
  } catch (error) {
    showError($("site-error"), error.message);
  } finally {
    button.disabled = false;
  }
}

$("current-icon").addEventListener("error", (e) => (e.currentTarget.hidden = true));
$("add-form").addEventListener("submit", addSite);
$("block-current-btn").addEventListener("click", blockCurrentSite);
$("options-btn").addEventListener("click", () => chrome.runtime.openOptionsPage());
$("auth-form").addEventListener("submit", handleAuth);
$("forgot-btn").addEventListener("click", forgotPassword);
$("subscribe-btn").addEventListener("click", (e) => openStripe(api.createCheckoutUrl, e.currentTarget));
$("manage-btn").addEventListener("click", (e) => openStripe(api.createPortalUrl, e.currentTarget));
$("refresh-btn").addEventListener("click", load);
$("signout-btn").addEventListener("click", async () => {
  await api.signOut();
  await load();
});

localizePage();
load();
