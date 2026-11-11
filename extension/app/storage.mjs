import { lists } from './catalog.mjs';

const preferenceKeys = ['locale', 'first', 'corresponding', 'search', 'onlineLookup'];
export const enabledKey = (id) => `enabled-${id}`;
const catalogKey = (id) => `catalog-${id}`;
const aliasKey = (profile) => `alias-${profile}`;
const catalogIds = Object.keys(lists);
const defaults = { locale: '', first: true, corresponding: true, search: true, onlineLookup: false };
let localSetup;

export async function snapshot(profile) {
  if (chrome.runtime.getManifest().background?.service_worker === 'local/migrate.mjs') {
    localSetup ||= chrome.runtime.sendMessage({ type: 'citelocus-local-catalogs' })
      .then((status) => { if (!status?.ok) localSetup = null; })
      .catch(() => { localSetup = null; });
    await localSetup;
  }
  const data = await chrome.storage.local.get([
    ...preferenceKeys, ...catalogIds.flatMap((id) => [enabledKey(id), catalogKey(id)]),
    ...(profile ? [aliasKey(profile)] : []),
  ]);
  return {
    preferences: Object.fromEntries(preferenceKeys.map((key) => [key, data[key] ?? defaults[key]])),
    enabled: Object.fromEntries(catalogIds.map((id) => [id, data[enabledKey(id)] !== false])),
    catalogs: Object.fromEntries(catalogIds.flatMap((id) => data[catalogKey(id)] ? [[id, data[catalogKey(id)]]] : [])),
    alias: profile ? data[aliasKey(profile)] || '' : '',
  };
}

export function savePreference(key, value) {
  return chrome.storage.local.set({ [key]: value });
}

export function saveCatalog(id, value) {
  return saveCatalogs({ [id]: value });
}

export function saveCatalogs(catalogs) {
  return chrome.storage.local.set(Object.fromEntries(Object.entries(catalogs).map(([id, value]) => [catalogKey(id), value])));
}

export function removeCatalog(id) {
  return chrome.storage.local.remove(catalogKey(id));
}

export function saveAlias(profile, value) {
  const key = aliasKey(profile);
  return value ? chrome.storage.local.set({ [key]: value }) : chrome.storage.local.remove(key);
}

export function watchStorage(update) {
  chrome.storage.onChanged.addListener((changes, area) => { if (area === 'local') update(changes); });
}
