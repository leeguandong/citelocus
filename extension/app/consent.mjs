import { element as el, translator } from './ui.mjs';

export async function requestPageConsent() {
  if (!['/scholar', '/citations'].includes(location.pathname) || !document.body) return false;
  const saved = await chrome.storage.local.get(['page-consent', 'locale']);
  if (saved['page-consent'] === true) return true;
  const zh = translator(saved.locale).lang === 'zh-CN';
  const host = el('div', null, { 'data-citelocus-consent': '' });
  host.style.cssText = 'all:initial;position:fixed;bottom:22px;right:22px;z-index:2147483647;';
  const shadow = host.attachShadow({ mode: 'open' });
  const style = el('style', `
    *{box-sizing:border-box}section{width:min(410px,calc(100vw - 44px));padding:20px;border:1px solid #b8d3c7;border-radius:14px;background:white;color:#193b32;box-shadow:0 8px 34px #163b3229;font:14px/1.6 "Segoe UI","Microsoft YaHei",sans-serif}
    h2{font-size:18px;margin:0 0 8px}p{margin:8px 0}a{color:#086d54}footer{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}button{font:inherit;cursor:pointer;padding:7px 12px;border:1px solid #b8d3c7;border-radius:7px;color:#193b32;background:#fff}button.primary{background:#0b725a;color:#fff;border-color:#0b725a}button.pill{box-shadow:0 3px 14px #163b3220}button:focus-visible,a:focus-visible{outline:2px solid #08765a;outline-offset:3px}output{display:block;font-size:12px;color:#a73535}
  `);
  shadow.append(style);
  document.body.append(host);
  return new Promise((resolve) => {
    const show = (compact = false) => {
      [...shadow.children].filter(node => node !== style).forEach(node => node.remove());
      if (compact) {
        const pill = el('button', zh ? '刊迹已暂停 · 启用' : 'CiteLocus paused · Enable', { type: 'button', class: 'pill' });
        pill.onclick = () => show();
        shadow.append(pill);
        return;
      }
      const card = el('section', null, { role: 'region', 'aria-label': zh ? '刊迹页面处理说明' : 'CiteLocus page processing notice' });
      card.append(el('h2', zh ? '在 Google 学术启用刊迹' : 'Enable CiteLocus on Google Scholar'));
      card.append(el('p', zh
        ? '刊迹会在此浏览器读取你打开的学术页面中的论文标题、作者姓名、发表源、引用数和论文链接，用于署名标注、期刊会议标签与统计。榜单、偏好和手动设置的署名别名保存在当前浏览器。'
        : 'CiteLocus reads paper titles, author names, publication venues, citation counts and article links on the Scholar pages you open, to show authorship, venue badges and statistics. Catalogs, preferences and saved name aliases stay in this browser.'));
      card.append(el('p', zh
        ? '在线补全默认关闭。你可在管理设置中另行开启；届时公开论文标题、DOI 或出版商文章编号可能发送至 Crossref、DOI 服务或 IEEE Xplore。'
        : 'Online lookup is off by default and has a separate control in settings. If enabled, a public paper title, DOI or publisher article ID may be sent to Crossref, DOI services or IEEE Xplore.'));
      card.append(el('a', zh ? '阅读隐私政策' : 'Read the privacy policy', { href: chrome.runtime.getURL('privacy.html'), target: '_blank', rel: 'noopener' }));
      const buttons = el('footer');
      const accept = el('button', zh ? '同意并启用' : 'Agree and enable', { type: 'button', class: 'primary' });
      const later = el('button', zh ? '暂不启用' : 'Not now', { type: 'button' });
      const status = el('output', '', { role: 'status' });
      accept.onclick = async () => {
        accept.disabled = true;
        try {
          await chrome.storage.local.set({ 'page-consent': true });
          host.remove();
          resolve(true);
        } catch {
          status.textContent = zh ? '保存失败，请重试。' : 'Could not save. Please retry.';
          accept.disabled = false;
        }
      };
      later.onclick = async () => {
        try { await chrome.storage.local.set({ 'page-consent': false }); show(true); }
        catch { status.textContent = zh ? '保存失败，请重试。' : 'Could not save. Please retry.'; }
      };
      buttons.append(accept, later);
      card.append(buttons, status);
      shadow.append(card);
    };
    show(saved['page-consent'] === false);
  });
}
