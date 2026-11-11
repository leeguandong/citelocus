import { lists } from './catalog.mjs';

export const words = {
  brand: ['刊迹 · CiteLocus', 'CiteLocus'], tagline: ['在谷歌学术看署名和发表源', 'Authorship and venues on Google Scholar'],
  settings: ['标注与语言', 'Badges and language'], firstToggle: ['显示一作标签', 'Show first-author badges'],
  corrToggle: ['显示通讯标签', 'Show corresponding-author badges'], searchToggle: ['标注搜索和被引用结果', 'Label search and cited-by results'],
  language: ['界面语言', 'Language'], auto: ['跟随浏览器', 'Browser default'], lists: ['期刊与会议名单', 'Journal and conference lists'],
  manage: ['管理本地名单', 'Manage local lists'], empty: ['未导入', 'Not imported'], loaded: ['已导入', 'Imported'],
  listHelp: ['导入你有权使用的 CSV、TSV 或 JSON 名单。文件留在此浏览器。', 'Import a CSV, TSV, or JSON list you are authorized to use. Files stay in this browser.'],
  formatHelp: ['CSV 至少需要「刊名」列。CCF、JCR、中科院、新锐还需「等级」列。可加「类型」「简称」「别名」「影响因子」「标记」列。多个别名用 | 隔开。', 'A CSV needs a title column. CCF, JCR, CAS, and XR also need rank. Optional columns are type, abbr, aliases, impact factor, and flags. Separate aliases with |.'],
  sciFormat: ['SCI 名单需提供 Web of Science 或 index 列，并明确写 SCIE。', 'For SCI, include an index or Web of Science column explicitly marked SCIE.'],
  bundle: ['导入整套名单', 'Import a list bundle'], bundleHelp: ['有刊迹名单包时，可以一次导入，替换包中包含的名单。', 'A CiteLocus bundle can import multiple lists at once and replace the lists it includes.'],
  edition: ['版本或年份', 'Edition or year'], file: ['选择本地文件', 'Select a local file'], replace: ['导入或替换', 'Import or replace'],
  delete: ['移除此名单', 'Remove list'], deleted: ['名单已移除', 'List removed'], saved: ['已保存', 'Saved'],
  badRecords: ['名单为空、格式不正确，或超出 50,000 行。', 'Empty or invalid list, or more than 50,000 rows.'],
  unclosedQuote: ['CSV 存在未闭合的引号。', 'The CSV has an unclosed quote.'],
  badRow: ['这条记录缺少完整刊名或有效等级。', 'This record lacks a valid title or rank.'],
  fileError: ['请选择 16 MB 以内的名单文件。', 'Select a catalog file of up to 16 MB.'],
  storageError: ['保存失败。请检查文件格式或浏览器剩余空间。', 'Could not save. Check the file format or browser storage.'],
  jsonError: ['JSON 格式无效。', 'The JSON format is invalid.'],
  learn: ['导入格式示例', 'Example import format'], about: ['学术页在浏览器内处理；可在管理设置中选择在线补全。', 'Processes Scholar pages in the browser. Online lookup is optional in settings.'],
  overview: ['概览', 'Overview'], venues: ['期刊 / 会议', 'Venues'], people: ['合作者', 'Coauthors'], rankings: ['排名名单', 'Rankings'],
  visibleScope: ['按本页已显示的论文统计。点击 Google 学术的「显示更多」会自动更新。', 'Counts the articles displayed here. Use Scholar’s “Show more” to include additional articles.'],
  completeScope: ['基于当前页面列出的论文。', 'Based on the articles listed on this page.'],
  official: ['Google 学术主页指标', 'Google Scholar profile metrics'],
  articles: ['论文', 'Papers'], citations: ['引用', 'Citations'], first: ['一作', '1st'], corresponding: ['通讯', 'Corr.'],
  firstFull: ['第一作者', 'First author'], last: ['末位作者', 'Last author'], middle: ['中间作者', 'Middle author'],
  hidden: ['署名截断', 'Byline truncated'], unmatched: ['未匹配', 'Unmatched'],
  sourceChecking: ['正在核对来源', 'Checking publication venue'],
  sourceUnconfirmed: ['来源未确认', 'Publication venue unconfirmed'],
  noRankMatch: ['未匹配榜单', 'No ranking list match'],
  bylinePositions: ['署名位次', 'Byline positions'], authorAverage: ['平均作者数', 'Mean authors'], authorMedian: ['作者数中位数', 'Median authors'],
  received: ['每年获得引用', 'Citations by year'], yearly: ['每年发表论文', 'Papers by year'], buckets: ['引用次数分布', 'Citation distribution'],
  yearsActive: ['发表年数', 'Active years'], rate: ['年均论文', 'Papers per year'], meanCites: ['篇均引用', 'Mean citations'],
  medianCites: ['引用中位数', 'Median citations'], maxCites: ['最高被引', 'Most cited'], uncited: ['零引用', 'Uncited'],
  topShare: ['最高被引占比', 'Top paper share'], hShare: ['h 核心引用占比', 'h-core share'], recent: ['近五年论文', 'Papers in last five years'],
  recentCites: ['近五年获得引用', 'Citations in last five years'], recentShare: ['近五年引用占比', 'Recent citation share'],
  previousCites: ['上年获得引用', 'Citations last year'], growth: ['上年引用增幅', 'Growth last year'],
  nameField: ['作者署名覆盖', 'Author name override'], nameHint: ['可用 | 分隔中英文别名。留空恢复自动识别。', 'Separate aliases with |. Leave blank to restore automatic matching.'],
  saveName: ['应用署名', 'Apply name'], authorNote: ['通讯作者依据署名后的星号判断。遇到同缩写作者会留空。', 'A trailing asterisk indicates correspondence. Ambiguous bylines are left unlabeled.'],
  sources: ['不同发表源', 'Distinct venues'], types: ['发表类型', 'Publication types'], journal: ['期刊', 'Journal'],
  conference: ['会议', 'Conference'], book: ['图书', 'Book'], preprint: ['预印本', 'Preprint'], patent: ['专利', 'Patent'],
  thesis: ['学位论文', 'Thesis'], other: ['其他', 'Other'], unknown: ['来源缺失', 'Unknown'],
  name: ['名称', 'Name'], repeat: ['重复合作作者', 'Repeat coauthors'], collaborative: ['合作论文占比', 'Collaboration rate'],
  rankHelp: ['通过工具栏弹窗导入榜单。分轨仅标注关联的 CCF 等级，主会统计按主会论文计算。', 'Import lists through the toolbar. Track badges show the associated CCF conference grade. Main-track counts cover main-track papers.'],
  noPapers: ['当前筛选没有收录论文。', 'No matching papers in this filter.'],
  all: ['全部等级', 'All grades'], grade: ['等级', 'Grade'], paper: ['论文', 'Paper'], firstCorr: ['一作或通讯', 'First or corresponding'],
  track: ['分轨', 'Track'], ifMean: ['平均影响因子', 'Mean impact factor'], ifMax: ['最高影响因子', 'Highest impact factor'],
  indexed: ['收录', 'Indexed'], warning: ['预警', 'Warning'],
};

export function translator(locale = '') {
  const lang = locale === 'zh' || (!locale && /^zh/i.test(navigator.language)) ? 0 : 1;
  const translate = (id) => words[id]?.[lang] || id;
  return { t: translate, label: (pair) => pair[lang], lang: lang === 0 ? 'zh-CN' : 'en' };
}

export function element(tag, text, attributes = {}) {
  const node = document.createElement(tag);
  if (text != null) node.textContent = text;
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
  return node;
}

export function gradeLabel(hit, language) {
  const { id, rank, track, impact, top } = hit;
  const short = language.label(lists[id].short);
  if (id === 'pku' || id === 'warning' || id === 'sci') return short;
  const value = (id === 'cas' || id === 'xr') && language.lang === 'zh-CN' ? `${rank}区` : rank;
  return `${short}-${value}${track ? ' ' + track : ''}${top ? ' Top' : ''}${impact == null ? '' : ' · IF ' + impact.toFixed(1)}`;
}

export function rankingMarks(matches, language) {
  return matches.flatMap((hit) => {
    const label = gradeLabel(hit, language);
    const title = [language.label(lists[hit.id].title), hit.edition, hit.name, hit.track, hit.reason].filter(Boolean).join(' · ');
    const result = [{ text: label, title, color: hit.id === 'warning' ? 'warning' : 'venue' }];
    if (hit.warning && hit.id !== 'warning') result.push({ text: language.t('warning'), title, color: 'warning' });
    return result;
  });
}
