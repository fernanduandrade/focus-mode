// Traduções via chrome.i18n (_locales/<idioma>/messages.json). O Chrome escolhe o idioma
// pelo idioma do navegador e cai no default_locale (en) quando não há tradução.

export function t(key, ...subs) {
  return chrome.i18n.getMessage(key, subs.map(String)) || key;
}

export function uiLanguage() {
  return chrome.i18n.getUILanguage();
}

export function formatDate(value) {
  return new Date(value).toLocaleDateString(uiLanguage());
}

// Aplica as traduções marcadas no HTML: data-i18n (texto), data-i18n-placeholder e data-i18n-title.
export function localizePage(root = document) {
  document.documentElement.lang = uiLanguage();
  for (const el of root.querySelectorAll("[data-i18n]")) el.textContent = t(el.dataset.i18n);
  for (const el of root.querySelectorAll("[data-i18n-placeholder]")) el.placeholder = t(el.dataset.i18nPlaceholder);
  for (const el of root.querySelectorAll("[data-i18n-title]")) el.title = t(el.dataset.i18nTitle);
}
