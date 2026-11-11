import { lists, parseBundle, parseCatalog } from '../app/catalog.mjs';
import './ieee-articles.mjs';
import './registered-articles.mjs';

const complete = 'local-catalog-migration-v1';
const sciComplete = 'local-sci-migration-v1';
const names = Object.keys(lists).map((id) => 'catalog-' + id);

async function readPackagedFile(path) {
  const response = await fetch(chrome.runtime.getURL(path));
  if (!response.ok) throw new Error('Local catalog file is unavailable: ' + path);
  return response.text();
}

async function migrateLists() {
  const saved = await chrome.storage.local.get([complete, sciComplete, ...names]);
  const patch = {};
  if (!saved[complete]) {
    const catalogs = parseBundle(await readPackagedFile('local/catalogs.json'));
    for (const [id, catalog] of Object.entries(catalogs)) {
      const key = 'catalog-' + id;
      if (!saved[key]) patch[key] = catalog;
    }
    patch[complete] = true;
  }
  if (!saved[sciComplete]) {
    if (!saved['catalog-sci'] && !patch['catalog-sci']) {
      patch['catalog-sci'] = parseCatalog('sci', await readPackagedFile('local/sci.json'));
    }
    patch[sciComplete] = true;
  }
  if (Object.keys(patch).length) await chrome.storage.local.set(patch);
}

let pending;
function ensureMigration() {
  pending ||= migrateLists().catch((error) => {
    pending = null;
    console.error('CiteLocus migration', error);
    throw error;
  });
  return pending;
}

chrome.runtime.onInstalled.addListener(() => { ensureMigration().catch(() => {}); });
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (sender.id !== chrome.runtime.id || message?.type !== 'citelocus-local-catalogs') return;
  ensureMigration().then(() => respond({ ok: true }), () => respond({ ok: false }));
  return true;
});
