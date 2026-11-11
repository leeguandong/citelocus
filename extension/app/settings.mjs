import { lists, parseBundle, parseCatalog } from './catalog.mjs';
import { snapshot, enabledKey, savePreference, saveCatalog, saveCatalogs, removeCatalog, watchStorage } from './storage.mjs';
import { element as el, translator } from './ui.mjs';

const mount = document.querySelector('#app');
const popup = mount.dataset.view === 'popup';
const status = el('output', '', { class: 'status', role: 'status' });
const layout = el('div');
mount.append(layout, status);

function banner(t) {
  const header = el('header');
  const logo = el('img', null, { src: 'icons/icon48.png', alt: '', width: '42', height: '42' });
  const title = el('div');
  title.append(el('h1', t('brand')), el('p', t('tagline')));
  header.append(logo, title, el('span', chrome.runtime.getManifest().version, { class: 'version' }));
  return header;
}

function toggle(text, checked, apply) {
  const box = el('input', null, { type: 'checkbox' });
  box.checked = checked;
  box.onchange = () => apply(box.checked);
  const label = el('label', null, { class: 'toggle' });
  label.append(box, el('span', text));
  return label;
}

function listLine(id, state, { t, label }) {
  const spec = lists[id];
  const imported = state.catalogs[id];
  return [label(spec.title), imported ? [imported.edition, imported.records.length.toLocaleString()].filter(Boolean).join(' · ') : t('empty')];
}

function renderPopup(state, language) {
  const { t } = language;
  const options = el('section');
  options.append(el('h2', t('settings')));
  const prefs = state.preferences;
  const save = async (key, value) => {
    try { await savePreference(key, value); status.textContent = t('saved'); }
    catch { status.textContent = t('storageError'); }
  };
  for (const [key, label] of [['first', 'firstToggle'], ['corresponding', 'corrToggle'], ['search', 'searchToggle']]) {
    options.append(toggle(t(label), prefs[key], (value) => save(key, value)));
  }
  const locale = el('select', null, { 'aria-label': t('language') });
  for (const [value, name] of [['', t('auto')], ['zh', '简体中文'], ['en', 'English']]) locale.append(el('option', name, { value }));
  locale.value = prefs.locale;
  locale.onchange = () => save('locale', locale.value);
  const languageControl = el('label', t('language'), { class: 'locale' });
  languageControl.append(locale);
  options.append(languageControl);

  const catalogs = el('section');
  catalogs.append(el('h2', t('lists')));
  const table = el('div', null, { class: 'catalog-lines' });
  for (const id of Object.keys(lists)) {
    const [title, detail] = listLine(id, state, language);
    const line = el('div', null, { class: 'catalog-line' });
    line.append(toggle(title, state.enabled[id], (enabled) => save(enabledKey(id), enabled)), el('small', detail));
    table.append(line);
  }
  const manage = el('button', t('manage'), { type: 'button', class: 'primary' });
  manage.onclick = () => chrome.runtime.openOptionsPage();
  catalogs.append(table, manage);
  layout.append(options, catalogs);
}

function renderOptions(state, language) {
  const { t } = language;
  const intro = el('section');
  intro.append(el('h2', t('manage')), el('p', t('listHelp')), el('p', t('formatHelp')));
  const example = el('details');
  example.append(el('summary', t('learn')), el('pre', [
    'title,rank,type,abbr,aliases,impact factor,flags',
    'Example Computing Conference,A,conference,ECC,Example Computing Conf.,,',
    'Example Journal,Q1,journal,EJ,,3.2,',
  ].join('\n')));
  intro.append(example);
  const bundle = el('details', null, { 'data-bundle': '' });
  const importBundle = el('form');
  const packageFile = el('input', null, { type: 'file', accept: '.json,application/json', required: '', 'aria-label': t('file') });
  const bundleButton = el('button', t('bundle'), { type: 'submit', class: 'primary' });
  const bundleStatus = el('output', '', { role: 'status' });
  importBundle.append(el('p', t('bundleHelp')), packageFile, bundleButton, bundleStatus);
  importBundle.onsubmit = async (event) => {
    event.preventDefault();
    const file = packageFile.files[0];
    if (!file || file.size > 16 * 1024 * 1024) { bundleStatus.textContent = t('fileError'); return; }
    bundleButton.disabled = true;
    try {
      const catalogs = parseBundle(await file.text());
      await saveCatalogs(catalogs);
      status.textContent = `${t('loaded')} ${Object.keys(catalogs).length}`;
    } catch (error) {
      bundleStatus.textContent = error instanceof SyntaxError ? t('jsonError') :
        String(error.message).startsWith('row:') || error.message === 'badRecords' ? t('badRecords') : t('storageError');
    } finally { bundleButton.disabled = false; }
  };
  bundle.append(el('summary', t('bundle')), importBundle);
  intro.append(bundle);
  const online = el('section', null, { 'data-online-lookup': '' });
  const zh = language.lang === 'zh-CN';
  online.append(el('h2', zh ? '发表源补全与隐私' : 'Venue lookup and privacy'));
  online.append(el('p', zh
    ? '在线补全默认关闭。开启后，未匹配结果的公开论文标题、DOI 或出版商文章编号可能发送给 Crossref、DOI 服务或 IEEE Xplore；这些服务也会收到连接所需的网络地址。作者姓名和年份留在浏览器中校验。关闭后停止后续请求并取消进行中的补全。'
    : 'Online lookup is off by default. If enabled, a public paper title, DOI or publisher article ID from an unresolved result may be sent to Crossref, DOI services or IEEE Xplore. Those services also receive normal connection information. Authors and years stay in the browser for validation. Turning this off stops subsequent requests and cancels active lookups.'));
  online.append(toggle(zh ? '允许在线补全发表源' : 'Allow online venue lookup', state.preferences.onlineLookup, async (value) => {
    try { await savePreference('onlineLookup', value); status.textContent = t('saved'); }
    catch { status.textContent = t('storageError'); }
  }));
  online.append(el('a', zh ? '阅读刊迹隐私政策' : 'Read the CiteLocus privacy policy', {
    href: chrome.runtime.getURL('privacy.html'), target: '_blank', rel: 'noopener'
  }));
  layout.append(online, intro);
  const cards = el('div', null, { class: 'catalog-cards' });
  for (const id of Object.keys(lists)) {
    const [title, detail] = listLine(id, state, language);
    const card = el('section', null, { 'data-catalog': id });
    card.append(el('h2', title), el('p', detail, { class: 'metadata' }));
    if (id === 'sci') card.append(el('p', t('sciFormat')));
    const form = el('form');
    const edition = el('input', null, { type: 'text', maxlength: '80', placeholder: t('edition'), 'aria-label': t('edition') });
    edition.value = state.catalogs[id]?.edition || '';
    const file = el('input', null, { type: 'file', accept: '.csv,.tsv,.json,text/csv,text/tab-separated-values,application/json',
      'aria-label': t('file'), required: '' });
    const submit = el('button', t('replace'), { type: 'submit', class: 'primary' });
    form.append(edition, file, submit);
    const result = el('output', '', { class: 'status', role: 'status' });
    form.onsubmit = async (event) => {
      event.preventDefault();
      const selected = file.files[0];
      if (!selected || selected.size > 16 * 1024 * 1024) { result.textContent = t('fileError'); return; }
      submit.disabled = true;
      try {
        const data = parseCatalog(id, await selected.text(), edition.value);
        await saveCatalog(id, data);
        status.textContent = `${title} · ${t('loaded')} ${data.records.length.toLocaleString()}`;
      } catch (error) {
        const message = String(error.message);
        result.textContent = error instanceof SyntaxError ? t('jsonError') :
          message.startsWith('row:') ? `#${message.slice(4)} · ${t('badRow')}` :
          ['badRecords', 'unclosedQuote'].includes(message) ? t(message) : t('storageError');
      } finally { submit.disabled = false; }
    };
    card.append(form, result);
    if (state.catalogs[id]) {
      const remove = el('button', t('delete'), { type: 'button', class: 'secondary' });
      remove.onclick = async () => {
        try { await removeCatalog(id); status.textContent = `${title} · ${t('deleted')}`; }
        catch { result.textContent = t('storageError'); }
      };
      card.append(remove);
    }
    cards.append(card);
  }
  layout.append(cards);
}

let renderId = 0;
async function update() {
  const id = ++renderId;
  try {
    const state = await snapshot();
    if (id !== renderId) return;
    const language = translator(state.preferences.locale);
    const { t } = language;
    document.documentElement.lang = language.lang;
    document.title = popup ? t('brand') : `${t('manage')} · ${t('brand')}`;
    layout.replaceChildren(banner(t));
    if (popup) renderPopup(state, language);
    else renderOptions(state, language);
    layout.append(el('p', t('about'), { class: 'privacy' }));
  } catch { status.textContent = translator().t('storageError'); }
}

watchStorage((changes) => {
  if (Object.keys(changes).some((key) => !key.startsWith('alias-'))) void update();
});
void update();
