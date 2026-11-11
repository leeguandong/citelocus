void import(chrome.runtime.getURL('app/consent.mjs')).then(async ({ requestPageConsent }) => {
  if (await requestPageConsent()) {
    const { launch } = await import(chrome.runtime.getURL('app/scholar.mjs'));
    await launch();
  }
}).catch((error) => {
  if (!String(error).includes('Extension context invalidated')) console.warn('CiteLocus', error);
});
