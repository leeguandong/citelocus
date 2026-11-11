export const ieeeHost = 'ieeexplore.ieee.org';
export const ieeeArticleId = /^[1-9]\d{0,11}$/;

export function articleNumber(href) {
  try {
    const url = new URL(href);
    if (url.protocol !== 'https:' || url.host !== ieeeHost || url.username || url.password) return '';
    const byParameter = ['/xpl/articleDetails.jsp', '/stamp/stamp.jsp', '/stampPDF/getPDF.jsp'].includes(url.pathname);
    const id = byParameter ? url.searchParams.get('arnumber')
      : url.pathname.match(/^\/(?:abstract\/|xpl\/)?document\/(\d+)(?:\/|$)/)?.[1];
    return id && ieeeArticleId.test(id) ? id : '';
  } catch {
    return '';
  }
}
