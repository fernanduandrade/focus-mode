// Wrapper fino sobre chrome.storage.local.
// Chaves: sites (string[]), session ({access_token, refresh_token, expires_at, user}),
// plan ({premium: boolean, status, checkedAt}).

export async function get(key, fallback) {
  const data = await chrome.storage.local.get(key);
  return data[key] ?? fallback;
}

export function set(key, value) {
  return chrome.storage.local.set({ [key]: value });
}

export function remove(key) {
  return chrome.storage.local.remove(key);
}
