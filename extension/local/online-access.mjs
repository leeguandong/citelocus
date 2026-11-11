const inflight = new Set();

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  if ((changes.onlineLookup && changes.onlineLookup.newValue !== true) ||
      (changes['page-consent'] && changes['page-consent'].newValue !== true)) {
    for (const controller of inflight) controller.abort();
    inflight.clear();
  }
});

export async function onlineFetch(url, options = {}) {
  const consent = await chrome.storage.local.get(['onlineLookup', 'page-consent']);
  if (consent.onlineLookup !== true || consent['page-consent'] !== true) return null;
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (options.signal?.aborted) return null;
  options.signal?.addEventListener('abort', abort, { once: true });
  inflight.add(controller);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    inflight.delete(controller);
    options.signal?.removeEventListener('abort', abort);
  }
}
