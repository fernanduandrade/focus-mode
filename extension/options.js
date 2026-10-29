import * as store from "./lib/storage.js";
import { activeSites, faviconUrl } from "./lib/sites.js";
import { addSite, removeSite, replaceSite } from "./lib/site-actions.js";
import { FREE_SITE_LIMIT } from "./config.js";
import { t, localizePage } from "./lib/i18n.js";

const $ = (id) => document.getElementById(id);

const state = { sites: [], premium: false };

// A busca aparece quando a lista passa deste tamanho.
const SEARCH_THRESHOLD = 6;

function showMessage(text) {
  $("message").textContent = text || "";
  $("message").hidden = !text;
}

function buildItem(site, active) {
  const item = $("site-item").content.firstElementChild.cloneNode(true);
  const q = (sel) => item.querySelector(sel);
  const input = q(".edit-input");

  q(".favicon").addEventListener("error", (e) => (e.currentTarget.style.visibility = "hidden"));
  q(".favicon").src = faviconUrl(site);
  q(".domain").textContent = site;
  if (!active) {
    item.classList.add("inactive");
    q(".tag").hidden = false;
    q(".tag").title = t("inactiveHint", FREE_SITE_LIMIT);
  }

  const setEditing = (editing) => {
    q(".domain").hidden = editing;
    input.hidden = !editing;
    q(".edit-btn").hidden = editing;
    q(".remove-btn").hidden = editing;
    q(".save-btn").hidden = !editing;
    q(".cancel-btn").hidden = !editing;
    if (editing) {
      input.value = site;
      input.focus();
      input.select();
    }
  };

  const save = async () => {
    const result = await replaceSite(site, input.value);
    showMessage(result.ok ? "" : result.error);
    if (result.ok) await load();
  };

  q(".edit-btn").addEventListener("click", () => setEditing(true));
  q(".cancel-btn").addEventListener("click", () => setEditing(false));
  q(".save-btn").addEventListener("click", save);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") save();
    if (e.key === "Escape") setEditing(false);
  });
  q(".remove-btn").addEventListener("click", async () => {
    await removeSite(site);
    showMessage("");
    await load();
  });

  return item;
}

function render() {
  const active = new Set(activeSites(state.sites, state.premium));
  const showSearch = state.sites.length > SEARCH_THRESHOLD;
  $("search-input").hidden = !showSearch;
  const query = showSearch ? $("search-input").value.trim().toLowerCase() : "";
  // Mais recentes primeiro, para achar rápido o que acabou de bloquear.
  const visible = [...state.sites].reverse().filter((site) => site.includes(query));
  $("site-list").replaceChildren(...visible.map((site) => buildItem(site, active.has(site))));
  $("no-results").hidden = visible.length > 0 || state.sites.length === 0;
  $("empty-list").hidden = state.sites.length > 0;
  $("limit-info").textContent = state.premium
    ? t("countPremium", state.sites.length)
    : t("countFree", Math.min(state.sites.length, FREE_SITE_LIMIT), FREE_SITE_LIMIT);
  $("upsell").hidden = state.premium || state.sites.length < FREE_SITE_LIMIT;

  const badge = $("plan-badge");
  badge.textContent = state.premium ? "Premium" : "Free";
  badge.classList.toggle("premium", state.premium);
}

async function load() {
  state.sites = await store.get("sites", []);
  state.premium = Boolean((await store.get("plan", {})).premium);
  render();
}

$("add-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const result = await addSite($("site-input").value);
  showMessage(result.ok ? "" : result.error);
  if (result.ok) $("site-input").value = "";
  await load();
});

$("search-input").addEventListener("input", render);

// Mantém a página em sincronia se o popup mudar a lista ou o plano.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && (changes.sites || changes.plan)) load();
});

document.title = t("settingsTitle");
localizePage();
localizePage($("site-item").content);
load();
