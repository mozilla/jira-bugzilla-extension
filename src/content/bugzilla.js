import config from '../shared/config.js';
import * as util from '../shared/util.js';

export default class BZContent {
  getWhiteboardConfigForComponent(component) {
    return config.COMPONENT_JIRA_WHITEBOARD_MAP[component] || null;
  }

  /*
   * Finds the REST url from the API link in the page if it exists.
   */
  getBuglistRestURL() {
    const queryLinks = Array.prototype.slice.call(
      document.querySelectorAll('.bz_query_links a'),
    );
    const restLink = queryLinks.filter((link) => link.textContent === 'REST');
    if (restLink.length) {
      return restLink[0].href;
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

  /*
   * This builds the bug list API URL making sure it has the right fields
   * and takes into account the same sort order as the web-page to avoid
   * fetching mis-matched data.
   *
   */
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

  /*
   * The fetch for bugzilla data.
   */
  async fetchBZData(url, _window = window) {
    // Network error will throw.
    const response = await _window.fetch(url);
    if (response.ok) {
      return response.json();
    } else {
      throw new Error(response.statusText);
    }
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
    if (bugsNotFoundCount > 0) {
      console.warn(`${bugsNotFoundCount} bugs not found in the bug list table`);
    }
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

    // Init whiteboard select for bug editing.
    this.whiteboardTagging();
  }

  whiteboardTagging(_window = window) {
    const componentSelect = document.getElementById('component');
    const component = componentSelect?.value;
    const buttonId = 'bz-jira-whiteboard-button';
    const selectId = 'bz-jira-whiteboard-select';

    // Listen to component changes so this can be re-initialized
    // as needed.
    componentSelect?.addEventListener(
      'change',
      (e) => {
        this.whiteboardTagging();
      },
      { once: true },
    );

    // If there's no component there's no point going further.
    if (!component) {
      return;
    }

    const whiteboardConfig = this.getWhiteboardConfigForComponent(component);

    // If there's no whiteboardConfig matching the component, remove the select
    // and button and return early since there's nothing to add.
    if (!whiteboardConfig) {
      document.getElementById(buttonId)?.remove();
      document.getElementById(selectId)?.remove();
      return;
    }

    const whiteBoardInput = document.getElementById('status_whiteboard');

    // Return early if there's no whiteboard input, or the select has already been
    // added.
    if (!whiteBoardInput || document.getElementById(selectId)) {
      console.log('no-op');
      return;
    }

    // Build the select
    const wbSelect = document.createElement('select');
    wbSelect.setAttribute('id', selectId);
    wbSelect.setAttribute('data-test-id', 'wb-select');
    for (const tag of whiteboardConfig) {
      const option = document.createElement('option');
      option.value = tag;
      option.textContent = tag;
      wbSelect.appendChild(option);
    }

    whiteBoardInput.parentNode.appendChild(wbSelect);

    // Build the button and add events.
    const button = document.createElement('button');
    button.setAttribute('id', buttonId);
    button.textContent = 'Add Jira Whiteboard Tag';
    button.style.marginInlineStart = '1ex';
    button.onclick = function (e) {
      e.preventDefault();
      const wbInputValue = whiteBoardInput.value;
      const spacer = wbInputValue.trim() === '' ? '' : ' ';
      whiteBoardInput.value = `${wbInputValue}${spacer}${wbSelect.value}`;
      // Call check existing because programmatic value updates
      // don't fire events.
      checkExisting(e);
    };

    const checkExisting = function (e) {
      if (whiteBoardInput.value.includes(wbSelect.value)) {
        button.setAttribute('disabled', true);
      } else {
        button.removeAttribute('disabled');
      }
    };

    whiteBoardInput.addEventListener('input', checkExisting, { once: true });
    wbSelect.oninput = checkExisting;
    whiteBoardInput.parentNode.appendChild(button);
    checkExisting();
  }

  initEnterBug() {
    this.whiteboardTagging();
  }

  init(_window = window) {
    const currentHref = _window.location.href;

    if (currentHref.startsWith(config.BZ_ENTER_BUG_URL_BASE)) {
      return this.initEnterBug();
    } else if (currentHref.startsWith(config.BZ_BUGLIST_URL_BASE)) {
      return this.initBuglist();
    } else if (currentHref.startsWith(config.BZ_BUG_URL_BASE)) {
      return this.initBug();
    }
  }
}
