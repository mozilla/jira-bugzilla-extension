import * as config from './shared/config.js';
import * as util from './shared/util.js';

export default class BzJira {
  checkStrings(jira, bz) {
    return typeof jira === 'string' && typeof bz === 'string';
  }

  checkPriorityMap(jira, bz) {
    if (this.checkStrings(jira, bz)) {
      const priorityMap = {
        highest: 'P1',
        high: 'P2',
        medium: 'P3',
        low: 'P4',
        lowest: 'P5',
        '(none)': '--',
      };
      return priorityMap[jira.toLowerCase()] === bz;
    }
    return false;
  }

  checkStatusMap(jira, bz) {
    if (this.checkStrings(jira, bz)) {
      const statusMap = {
        'In Review': ['ASSIGNED'],
        'In Progress': ['ASSIGNED'],
        New: ['NEW', 'UNCONFIRMED'],
        Open: ['NEW', 'UNCONFIRMED'],
        Backlog: ['NEW', 'UNCONFIRMED'],
        Reopened: ['REOPENED'],
        Closed: ['RESOLVED'],
      };
      const mapping = statusMap[jira];
      if (mapping) {
        return mapping.includes(bz);
      }
    }
    return false;
  }

  /*
   * Since we know there might be cases where emails don't match
   * Let's consider adding a user-generated list as a mapping.
   *
   */
  checkAssignee(jira, bz) {
    // Assignee can be null
    if (
      [null, undefined].includes(jira) &&
      ['---', 'nobody@mozilla.org'].includes(bz)
    ) {
      return true;
    }

    return this.checkEqualTrimmedStrings(jira, bz);
  }

  checkEqualTrimmedStrings(jira, bz) {
    if (this.checkStrings(jira, bz)) {
      return jira.trim() === bz.trim();
    }
    return false;
  }

  isValidJiraId(jiraIssueId) {
    if (typeof jiraIssueId !== 'string') {
      return false;
    }
    return /^[A-Z]+?-[0-9]+?$/.test(jiraIssueId);
  }

  isValidBugId(bugId) {
    if (typeof bugId !== 'string') {
      return false;
    }
    const parsedBugNum = parseInt(bugId, 10);
    return !isNaN(parsedBugNum);
  }

  getComparisonData = async (bugId, jiraIssueId) => {
    if (!this.isValidBugId(bugId) || !this.isValidJiraId(jiraIssueId)) {
      console.log('Invalid bug data');
      return {};
    }

    // Customize fields for BZ
    const bzBugApiURL = new URL(
      `${config.BZ_BUG_API_URL_BASE}${encodeURIComponent(bugId)}`,
    );

    bzBugApiURL.searchParams.set('include_fields', [
      'id,summary,assigned_to,priority,status,cf_fx_points',
    ]);

    // Customize Fields for JIRA
    const jiraApiURL = new URL(
      `${config.JIRA_API_ISSUE_URL_BASE}${encodeURIComponent(jiraIssueId)}`,
    );
    jiraApiURL.searchParams.set('fields', [
      'summary,assignee,priority,status,customfield_10037',
    ]);

    if (jiraIssueId) {
      const [jiraAPIData, bzData] = await Promise.all([
        fetch(jiraApiURL),
        fetch(bzBugApiURL),
      ]);

      let JIRAData;
      let bugData;

      if (jiraAPIData.ok) {
        JIRAData = await jiraAPIData.json();
      } else {
        const jiraResponseStatus = jiraAPIData.status;
        let loggedInMessage;
        if (jiraResponseStatus === 404) {
          loggedInMessage = ` Make sure you're logged into JIRA! 😉`;
        }
        const jiraErrorMsg = `JIRA API request failed with ${jiraResponseStatus}.${loggedInMessage}`;
        throw new Error(jiraErrorMsg);
      }

      if (bzData.ok) {
        const bzDataJSON = await bzData.json();
        bugData = bzDataJSON.bugs[0];
      } else {
        throw new Error(
          `Bugzilla API request failed with error status ${bzData.status}.`,
        );
      }

      const jiraStatus = JIRAData.fields.status.name.replace(' (migrated)', '');

      const jiraAssignee =
        JIRAData?.fields?.assignee?.emailAddress || 'Not assigned';

      return {
        title: {
          jira: JIRAData.fields.summary,
          bz: bugData.summary,
          matches: this.checkEqualTrimmedStrings(
            JIRAData.fields.summary,
            bugData.summary,
          ),
        },
        assignee: {
          jira: jiraAssignee,
          bz: bugData.assigned_to,
          matches: this.checkAssignee(
            JIRAData?.fields?.assignee?.emailAddress,
            bugData.assigned_to,
          ),
        },
        status: {
          jira: jiraStatus,
          bz: bugData.status,
          matches: this.checkStatusMap(jiraStatus, bugData.status),
        },
        priority: {
          jira: JIRAData.fields.priority.name,
          bz: bugData.priority,
          matches: this.checkPriorityMap(
            JIRAData.fields.priority.name,
            bugData.priority,
          ),
        },
      };
    }
  };

  /*
   *  Validate and store the bugData.
   *  Note: a single bz id, can point to multiple Jira ids whereas the reverse isn't possible.
   *
   */
  validateBugData(bugData) {
    console.log('bugData', bugData);
    const newBugData = {
      bugId: null,
      jiraIssueIds: [],
    };

    if (bugData !== null) {
      if (this.isValidBugId(bugData.bugId)) {
        newBugData.bugId = bugData.bugId;
      }
      newBugData.jiraIssueIds = bugData.jiraIssueIds.filter(this.isValidJiraId);
    } else {
      console.log('bugData was null');
    }

    console.log('newBugData', newBugData);

    return newBugData;
  }

  /*
   * This call handles the ids sent by the content script.
   *
   */

  async handleIdentifiersMessage(request, sender) {
    // Throws if sender is invalid.
    util.isValidSender(sender);

    const validBugData = this.validateBugData(request.data);

    // Store the id data using the BZ id as a key.
    browser.storage.local.set({
      [validBugData.bugId]: { jiraIssueIds: validBugData?.jiraIssueIds },
    });

    const tabId = sender.tab.id;
    const data = await this.requestComparisonData();
    this.setIconBadge(data, tabId);
  }

  requestComparisonData = async () => {
    const currentTab = await browser.tabs.query({
      currentWindow: true,
      active: true,
    });

    if (!currentTab) {
      console.log('No current tab, bailing!');
      return;
    }
    const bugId = util.getBugId(currentTab[0].url);

    if (!bugId) {
      console.log('no BugId!');
      return;
    }

    // Check storage for jira id data.
    const cachedBugData = await browser.storage.local.get(bugId);
    console.log('cachedBugData', cachedBugData);
    const jiraIssueIds = cachedBugData[bugId]?.jiraIssueIds || [];

    let result;
    if (!jiraIssueIds.length) {
      console.log('No linked Jira issues');
      result = {
        errorTitle: 'No Linked JIRA Issue',
        error: 'No JIRA Issue has been linked to this bug yet!',
      };
    } else if (cachedBugData[bugId].comparisonData) {
      console.log('Cached comparison data found');
      result = cachedBugData[bugId].comparisonData;
    } else {
      console.log('Fetching Comparison Data');
      try {
        result = await this.getComparisonData(bugId, jiraIssueIds[0]);
      } catch (e) {
        result = { errorTitle: 'API Error', error: e.message };
      }
      await browser.storage.local.set({
        [bugId]: { jiraIssueIds, comparisonData: result },
      });
    }

    console.log('result', result);

    return {
      bugId,
      jiraIssueIds,
      comparisonData: result,
    };
  };

  handleGetComparisonDataForPopup = async (request, sender) => {
    console.log('handleGetComparisonDataForPopup');
    // Throws if sender is invalid.
    util.isValidSender(sender);
    return await this.requestComparisonData(sender);
  };

  /*
   * Message handler and dispatch.
   */
  handleMessage = async (request, sender) => {
    if (typeof request.instruction !== 'string') {
      throw new Error('Invalid instruction');
    }

    switch (request.instruction) {
      case 'getComparisonDataForPopup':
        return this.handleGetComparisonDataForPopup(request, sender);
      case 'identifiersFromBugzilla':
        return this.handleIdentifiersMessage(request, sender);
    }
  };

  /*
  async requestBugIdentifiers(tabId) {
    if (this.currentBugData === null) {
      const result = await browser.tabs.sendMessage(tabId, { 'instruction': 'requestBugIds' });

      // Validate and store bug data.
      this.currentBugData = this.validateBugData(result.data);
      this.setActionStatusForTab(tabId);
    } else {
      console.log('bug data already present, noop');
    }
  }
    */

  setIconBadge(data, tabId) {
    const { bugId, jiraIssueIds, comparisonData } = data;

    if (bugId && jiraIssueIds.length > 0) {
      let matchingData = true;

      for (const [key, value] of Object.entries(comparisonData)) {
        if (value.matches === false) {
          matchingData = false;
          break;
        }
      }

      if (matchingData) {
        browser.action.setBadgeBackgroundColor({ color: 'transparent', tabId });
        browser.action.setBadgeText({ text: '🟢', tabId });
        browser.action.setTitle({
          title: 'Comparison between Jira and Bugzilla matches',
          tabId,
        });
      } else {
        browser.action.setBadgeBackgroundColor({ color: 'transparent', tabId });
        browser.action.setBadgeText({ text: '🟠', tabId });
        browser.action.setTitle({
          title: 'Comparison between Jira and Bugzilla has some differences',
          tabId,
        });
      }
    } else {
      browser.action.setBadgeBackgroundColor({ color: 'transparent', tabId });
      browser.action.setBadgeText({ text: '⭕️', tabId });
      if (bugId) {
        browser.action.setTitle({
          title: `No Jira ticket associated with this bug`,
          tabId,
        });
      } else {
        browser.action.setTitle({
          title: `No Bugzilla ticket associated with this Jira ticket`,
          tabId,
        });
      }
    }

    console.log('Enabling action');
    browser.action.enable(tabId);
  }

  handleSuspend = () => {
    console.log('Background Script Suspending');
    browser.action.disable();
  };
}

async function initEvents() {
  console.log('Initializing Background Script');
  const BzJiraInst = new BzJira();
  browser.action.disable();
  browser.runtime.onMessage.addListener(BzJiraInst.handleMessage);
  // browser.tabs.onActivated.addListener(BzJiraInst.handleActiveTab);
  browser.runtime.onSuspend.addListener(BzJiraInst.handleSuspend);
}

initEvents();
