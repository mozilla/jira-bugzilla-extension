const BUGLIST_URL_BASE = 'https://bugzilla.mozilla.org/buglist.cgi';

function getBugId() {
  const bugId = window?.BUGZILLA?.bug_id;
  return bugId ? parseInt(bugId, 10) : null;
}

function bugListContentScript(lastOrder) {
  const JIRA_URL_RX = /^https:\/\/mozilla-hub.atlassian.net\/browse\/([A-Z-0-9]+)$/';
  const BZ_FIELDS = [
    'id',
    'see_also',
  ];

  // To be able to sort the same way as the web result, the fields in the order
  // list need to be added to the included fields in the API call.
  const orderList = lastOrder ? decodeURIComponent(lastOrder).replaceAll('bug_', '').split(',') : [];
  const newBzFields = new Set([ ...BZ_FIELDS, ...orderList]);

  function getRestURL() {
    const queryLinks = document.querySelectorAll('.bz_query_links a');
    if (queryLinks.length && queryLinks[0].textContent === 'REST') {
      return queryLinks[0].href;
    }
  }

  function getApiURL() {
    const apiURL = new URL(getRestURL());
    const apiParams = apiURL.searchParams;

    // Override include_fields to add see_also so we can infer Jira Links.
    apiParams.set('include_fields', [ ...newBzFields ].join(','));

    // Check the limit of the current page and make sure the API call matches.
    const pageURL = new URL(window.location);
    const pageParams = pageURL.searchParams;
    const pageLimit = pageParams.get('limit');
    apiParams.set('limit', pageLimit !== null && pageLimit >= 0 ? pageLimit : 500);

    // This value was passed to the content script having been looked up
    // from the LASTORDER cookie.
    apiParams.set('order', decodeURIComponent(lastOrder));

    console.log(apiURL);
    return apiURL;
  }

  function extractJIRALinkFromSeeAlso (links) {
    for (let link of links) {
      const matches = link.match(JIRA_URL_RX)
      if (matches) {
        return {
          href: matches[0],
          text: matches[1],
        }
      }
    }
  }

  async function fetchBZData(url) {
    const result = await fetch(url)
    return await result.json();
  }

  (async function init() {
    // Prospectively create the column since to minimize jank.
    const header = document.createElement('th');
    const headerText = header.textContent = 'Jira Link';
    // This should be enough width to allow for a JIRA link code of
    // XXXXXX-XXX so that the page doesn't move around when the data has loaded.
    header.style.minWidth = '7.5em';
    document.querySelector('table.bz_buglist thead tr').appendChild(header);

    // Now fetch the extra data needed to understand if the bug in the row has a jira link.
    const response = await fetchBZData(getApiURL());
    console.log(response.bugs.length);

    // iterate over the bugslist and grab the JIRA URL if it matches.
    let bugsNotFoundCount = 0;
    for (let result of response.bugs) {
      const bugRow = document.getElementById(`b${result.id}`);

      if (bugRow) {
        const jiraLink = extractJIRALinkFromSeeAlso(result.see_also));
        let cell = document.createElement('td');
        if (jiraLink) {
          let newLink = document.createElement('a');
          newLink.target = '_blank';
          newLink.href = jiraLink.href;
          newLink.textContent = jiraLink.text;
          cell.appendChild(newLink);
        }
        // Even if there's no JiraLink we'll want to add a td
        bugRow.appendChild(cell);
      } else {
        console.log(`Bug not found ${result.id}`);
        bugsNotFoundCount++;
      }
    }
    console.warn(`${bugsNotFoundCount} bugs not found in the bug list table`);


  }())
}



export function executeGetRestURL(tabId, func, args) {
  return browser.scripting.executeScript({
    func,
    args,
    target: {
      tabId,
    },
  });
}


export async function handleTabActivation(tabInfo) {
  const tab = await browser.tabs.get(tabInfo.tabId);
  if (tab.url) {
    chrome.pageAction.enable(tabInfo.tabId);

  } else {
    chrome.action.disable();
  }
}

export async function handleTabUpdates(tabId, changeInfo) {
  // Only Apply to buglists.
  if (changeInfo.url && changeInfo.url.startsWith(BUGLIST_URL_BASE)) {
    browser.pageAction.show(tabId);
    const lastOrder = await browser.cookies.get({
      url: changeInfo.url,
      name: 'LASTORDER'
    });
    // Params to pass to the content script.
    const args = [
      lastOrder.value,
    ];
    const scriptResponse = await executeGetRestURL(tabId, bugListContentScript, args);
  }
}

export async function initEvents() {
  // Disable to start, as the action should only be run when permitted.
  // Setup handlers. TODO: Check in MV3 if all of these are still needed.
  // chrome.runtime.onMessage.addListener(handlePopupMessage);
  browser.tabs.onUpdated.addListener(handleTabUpdates);
  // browser.tabs.onActivated.addListener(handleTabActivation);
}

initEvents();
