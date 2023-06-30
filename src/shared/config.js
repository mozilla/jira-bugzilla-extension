const config = {
  BZ_BUG_API_URL_BASE: 'https://bugzilla.mozilla.org/rest/bug/',
  BZ_BUGLIST_URL_BASE: 'https://bugzilla.mozilla.org/buglist.cgi',
  BZ_BUG_URL_BASE: 'https://bugzilla.mozilla.org/show_bug.cgi',
  BZ_INCLUDED_FIELDS: ['id', 'see_also'],
  JIRA_API_ISSUE_URL_BASE:
    'https://mozilla-hub.atlassian.net/rest/api/latest/issue/',
  JIRA_URL_RX: /^https:\/\/mozilla-hub.atlassian.net\/browse\/([A-Z-0-9]+)$/,
  EXT_ID: browser.runtime.getManifest().browser_specific_settings.gecko.id,
};

export default config;
