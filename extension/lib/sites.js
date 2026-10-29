import { FREE_SITE_LIMIT } from "../config.js";

// Converte o que o usuário digitou ("https://www.youtube.com/watch?v=1") em domínio ("youtube.com").
export function normalizeDomain(input) {
  let value = String(input || "").trim().toLowerCase();
  if (!value) return null;
  if (!/^[a-z]+:\/\//.test(value)) value = `https://${value}`;
  let host;
  try {
    host = new URL(value).hostname;
  } catch {
    return null;
  }
  host = host.replace(/^www\./, "").replace(/\.$/, "");
  if (!/^([a-z0-9-]+\.)+[a-z0-9-]{2,}$/.test(host)) return null;
  return host;
}

export function siteLimit(premium) {
  return premium ? Infinity : FREE_SITE_LIMIT;
}

// Sites que devem ser bloqueados de fato. Se a assinatura expirar, só os primeiros
// FREE_SITE_LIMIT continuam valendo; o restante fica salvo e volta quando assinar de novo.
export function activeSites(sites, premium) {
  return premium ? sites : sites.slice(0, FREE_SITE_LIMIT);
}

// Favicon pelo cache do próprio Chrome (permissão "favicon"), sem chamar serviços externos.
export function faviconUrl(domain, size = 32) {
  const url = new URL(chrome.runtime.getURL("/_favicon/"));
  url.searchParams.set("pageUrl", `https://${domain}`);
  url.searchParams.set("size", String(size));
  return url.toString();
}
