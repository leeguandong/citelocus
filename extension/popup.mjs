import { lists } from './app/catalog.mjs';
import { enabledKey, savePreference, snapshot, watchStorage } from './app/storage.mjs';
import { element, translator } from './app/ui.mjs';

const byId = (id) => document.getElementById(id);
const status = byId('status');
const locale = byId('locale');
let language = translator();
let revision = 0;
let statusTimer;

async function save(key, value) {
  clearTimeout(statusTimer);
  try {
    await savePreference(key, value);
    status.textContent = language.t('saved');
    statusTimer = setTimeout(() => { status.textContent = ''; }, 1500);
  } catch {
    await render();
    status.textContent = language.t('storageError');
  }
}

function addToggle(container, key, extraClass = '') {
  const input = element('input', null, { type: 'checkbox' });
  const name = element('span');
  const row = element('label', null, { class: `check ${extraClass}`.trim() });
  row.append(input, name);
  container.append(row);
  input.addEventListener('change', () => void save(key, input.checked));
  return { row, input, name };
}

const preferences = [
  ['search', 'searchToggle'],
  ['first', 'firstToggle'],
  ['corresponding', 'corrToggle'],
].map(([key, text]) => [key, text, addToggle(byId('toggles'), key)]);
const ranks = Object.entries(lists).map(([id, list]) =>
  [id, list, addToggle(byId('lists'), enabledKey(id), id === 'warning' ? 'warn' : '')]);

async function render() {
  const current = ++revision;
  try {
    const state = await snapshot();
    if (current !== revision) return;
    language = translator(state.preferences.locale);
    const { t, label, lang } = language;
    const chinese = lang === 'zh-CN';
    document.documentElement.lang = lang;
    document.title = t('brand');
    byId('brand').textContent = chinese ? '刊迹' : 'CiteLocus';
    byId('version').textContent = `v${chrome.runtime.getManifest().version}`;
    byId('tagline').textContent = chinese ? '沿着引用，看清论文出处。' : 'Follow the citations. Find where papers were published.';
    byId('rankings-title').textContent = chinese ? '分区与等级' : 'Rankings and quartiles';
    byId('rankings-hint').textContent = chinese ? '勾选要显示在论文旁的标签。' : 'Choose which badges appear beside papers.';
    byId('settings-title').textContent = t('settings');
    byId('language-title').textContent = t('language');
    byId('locale-auto').textContent = t('auto');
    byId('manage').textContent = t('manage');
    byId('privacy').textContent = t('about');
    locale.value = state.preferences.locale;
    for (const [key, text, control] of preferences) {
      control.name.textContent = t(text);
      control.input.checked = state.preferences[key];
    }
    for (const [id, list, control] of ranks) {
      const imported = state.catalogs[id];
      const edition = imported?.edition || '';
      control.name.textContent = [label(list.title), /^\d{4}$/.test(edition) && edition].filter(Boolean).join(' ');
      control.row.title = imported ? [edition, imported.records.length.toLocaleString(lang)].filter(Boolean).join(' · ') : t('empty');
      control.input.checked = state.enabled[id];
    }
  } catch {
    if (current === revision) status.textContent = language.t('storageError');
  }
}

locale.addEventListener('change', () => void save('locale', locale.value));
byId('manage').addEventListener('click', () => chrome.runtime.openOptionsPage());
watchStorage((changes) => {
  if (Object.keys(changes).some((key) => !key.startsWith('alias-'))) void render();
});
void render();
