import * as config from '../shared/config.js';
import * as util from '../shared/util.js';

export default class BZContent {
  /*
   * Finds the REST url from the API link in the page if it exists.
   */
  getBuglistRestURL() {
    const queryLinks = document.querySelectorAll('.bz_query_links a');
    if (queryLinks.length && queryLinks[0].textContent === 'REST') {
      return queryLinks[0].href;
    }
  }

  /*
   * This function grabs the currect sort/order params from the
   * form that allows you to customize search.
   */
  getOrderParams() {
    const queryParams = document.querySelector(
      '.bz_query_remember input[name=newquery]',
    )?.value;
    if (queryParams) {
      const params = new URLSearchParams(queryParams);
      return params.get('order');
    }
  }

  getBuglistApiURL(_window = window) {
    const apiURL = new URL(this.getBuglistRestURL());
    const apiParams = apiURL.searchParams;

    // To be able to sort the same way as the web result, the fields in the order
    // list need to be added to the included fields in the API call.
    const orderParams = this.getOrderParams();
    const ORDER_LIST = orderParams
      ? orderParams.replaceAll('bug_', '').split(',')
      : [];
    const BZ_FIELDS = new Set([...config.BZ_INCLUDED_FIELDS, ...ORDER_LIST]);

    // Override include_fields to add see_also so we can infer Jira Links.
    apiParams.set('include_fields', [...BZ_FIELDS].join(','));

    // Check the limit of the current page and make sure the API call matches.
    const pageURL = new URL(_window.location);
    const pageParams = pageURL.searchParams;
    const pageLimit = pageParams.get('limit');
    apiParams.set(
      'limit',
      pageLimit !== null && pageLimit >= 0 ? pageLimit : 500,
    );

    apiParams.set('order', orderParams);

    return apiURL;
  }

  /*
   * Returns a list of objects for matching JIRA links found in the see_also data.
   */
  extractJIRALinksFromSeeAlso(links) {
    const jiraLinks = [];
    for (let link of links) {
      const matches = link.match(config.JIRA_URL_RX);
      if (matches) {
        jiraLinks.push({
          href: matches[0],
          text: matches[1],
        });
      }
    }
    return jiraLinks;
  }

  async fetchBZData(url, _window = window) {
    const result = await _window.fetch(url);
    return await result.json();
  }

  async initBuglist() {
    // Bail if the buglist has already been populated with the data.
    if (document.getElementById('bz-jira-table-header')) {
      console.log('bz-jira-table-header already exists noop');
      return;
    }

    // Prospectively create the column since to minimize jank.
    const header = document.createElement('th');
    header.id = 'bz-jira-table-header';
    const headerText = (header.textContent = 'Jira Link');

    // This should be enough width to allow for a JIRA link code of
    // XXXXXX-XXX so that the page doesn't move around when the data has loaded.
    header.style.minWidth = '7.5em';
    document.querySelector('table.bz_buglist thead tr').appendChild(header);

    // Now fetch the extra data needed to understand if the bug in the row has a jira link.
    const response = await this.fetchBZData(this.getBuglistApiURL());

    // iterate over the bugslist and grab the JIRA URL if it matches.
    let bugsNotFoundCount = 0;
    for (let result of response.bugs) {
      const bugRow = document.getElementById(`b${result.id}`);

      if (bugRow) {
        const jiraLinks = this.extractJIRALinksFromSeeAlso(result.see_also);
        let cell = document.createElement('td');
        if (jiraLinks?.length) {
          for (const [i, link] of jiraLinks.entries()) {
            let newLink = document.createElement('a');
            newLink.target = '_blank';
            newLink.href = link.href;
            newLink.textContent = `${i > 0 ? ', ' : ''}${link.text}`;
            cell.appendChild(newLink);
          }
        }
        // Even if there's no JiraLink we'll want to add a td
        bugRow.appendChild(cell);
      } else {
        bugsNotFoundCount++;
      }
    }
    console.warn(`${bugsNotFoundCount} bugs not found in the bug list table`);
  }

  async initBug(_window = window) {
    const bugLink = document.getElementById('field-value-bug_id');
    if (bugLink.getAttribute('data-jira-bz-link-injected')) {
      console.log('Jira links already added. noop');
      return;
    }

    const bugId = util.getBugId(_window.location);
    const bugApiURL = new URL(`${config.BZ_BUG_API_URL_BASE}${bugId}`);
    bugApiURL.searchParams.set('include_fields', config.BZ_INCLUDED_FIELDS);

    const bzAPIData = await fetch(bugApiURL);
    const bugJSON = await bzAPIData.json();
    const bugData = bugJSON?.bugs[0];
    const jiraIssueData = this.extractJIRALinksFromSeeAlso(bugData.see_also);

    // There might be more than one jira issue.
    const jiraIssueIds = [];
    if (jiraIssueData?.length) {
      const comparisonDataRequests = [];
      for (let link of jiraIssueData) {
        const jiraSpan = document.createElement('span');
        jiraSpan.setAttribute('id', `jira-bz-buglink-${bugId}`);
        const jiraLink = document.createElement('a');
        jiraLink.href = link.href;
        jiraLink.target = '_blank';
        jiraSpan.textContent = ', JIRA: ';
        jiraLink.textContent = link.text;
        jiraIssueIds.push(link.text);
        jiraSpan.appendChild(jiraLink);
        bugLink.parentNode.insertBefore(jiraSpan, bugLink.nextSibling);
      }

      bugLink.setAttribute('data-jira-bz-link-injected', true);
    }

    const currentBugData = {
      bugId,
      jiraIssueIds,
    };

    // Tell the background script what the issue ids are.
    await browser.runtime.sendMessage({
      instruction: 'identifiersFromBugzilla',
      data: currentBugData,
    });
  }

  /*
  handleMessage = (request, sender) => {
    // Throws if incorrect.
    util.isValidSender(sender);

    if (request.instruction === 'requestBugIds') {
      console.log('sending data', this.currentBugData);
      return Promise.resolve({ data: this.currentBugData });
    }
  }
  */

  init(_window = window) {
    if (_window.location.href.startsWith(config.BZ_BUGLIST_URL_BASE)) {
      return this.initBuglist();
    }

    if (_window.location.href.startsWith(config.BZ_BUG_URL_BASE)) {
      // Content script should listen for messages from the background.
      // browser.runtime.onMessage.addListener(this.handleMessage);
      return this.initBug();
    }
  }
}
