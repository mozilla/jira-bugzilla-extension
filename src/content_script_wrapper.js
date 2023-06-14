/*
 * Wrapper to enable use of a module for the content script.
 * See https://bugzilla.mozilla.org/show_bug.cgi?id=1536094
 *
 */
(async () => {
  const src = browser.runtime.getURL('content/bugzilla.js');
  const BZContentScript = await import(src);
  const BZJira = new BZContentScript.default();
  BZJira.init();
})();
