/*
 * @jest-environment jsdom
 *
 */

import { jest } from '@jest/globals';
import * as config from '../src/shared/config.js';
import BzJiraBackground from '../src/background';

const BzJira = new BzJiraBackground();

describe('Background Script', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  describe('checkStrings()', () => {
    it('should return true', () => {
      expect(BzJira.checkStrings('test', 'test')).toBe(true);
      expect(BzJira.checkStrings('test', 'whatever')).toBe(true);
    });

    it('should return false', () => {
      expect(BzJira.checkStrings('test', false)).toBe(false);
      expect(BzJira.checkStrings('test', null)).toBe(false);
      expect(BzJira.checkStrings('test', 1)).toBe(false);
      expect(BzJira.checkStrings(null, 'test')).toBe(false);
    });
  });

  describe('checkPriorityMap()', () => {
    it('should be true', () => {
      expect(BzJira.checkPriorityMap('highest', 'P1')).toBe(true);
      expect(BzJira.checkPriorityMap('high', 'P2')).toBe(true);
      expect(BzJira.checkPriorityMap('Medium', 'P3')).toBe(true);
      expect(BzJira.checkPriorityMap('Low', 'P4')).toBe(true);
      expect(BzJira.checkPriorityMap('Lowest', 'P5')).toBe(true);
      expect(BzJira.checkPriorityMap('(none)', '--')).toBe(true);
    });

    it('should be false', () => {
      expect(BzJira.checkPriorityMap('Medium', 'P2')).toBe(false);
      expect(BzJira.checkPriorityMap(null, 'P2')).toBe(false);
      expect(BzJira.checkPriorityMap(null, '')).toBe(false);
      expect(BzJira.checkPriorityMap(null, null)).toBe(false);
    });
  });

  describe('checkStatusMap()', () => {
    it('should return true', () => {
      expect(BzJira.checkStatusMap('In Review', 'ASSIGNED')).toBe(true);
      expect(BzJira.checkStatusMap('In Progress', 'ASSIGNED')).toBe(true);
      expect(BzJira.checkStatusMap('New', 'NEW')).toBe(true);
      expect(BzJira.checkStatusMap('New', 'UNCONFIRMED')).toBe(true);
      expect(BzJira.checkStatusMap('Open', 'NEW')).toBe(true);
      expect(BzJira.checkStatusMap('Open', 'UNCONFIRMED')).toBe(true);
      expect(BzJira.checkStatusMap('Reopened', 'REOPENED')).toBe(true);
      expect(BzJira.checkStatusMap('Closed', 'RESOLVED')).toBe(true);
    });

    it('should return false', () => {
      expect(BzJira.checkStatusMap('In Review', 'UNCONFIRMED')).toBe(false);
      expect(BzJira.checkStatusMap(null, 'UNCONFIRMED')).toBe(false);
      expect(BzJira.checkStatusMap(null, null)).toBe(false);
    });
  });

  describe('checkEqualTrimmedStrings()', () => {
    it('should return true', () => {
      expect(BzJira.checkEqualTrimmedStrings('test', 'test')).toBe(true);
      expect(BzJira.checkEqualTrimmedStrings('test ', 'test')).toBe(true);
    });

    it('should return false', () => {
      expect(BzJira.checkEqualTrimmedStrings(null, null)).toBe(false);
      expect(BzJira.checkEqualTrimmedStrings(null, 'test')).toBe(false);
      expect(BzJira.checkEqualTrimmedStrings('test', null)).toBe(false);
      expect(BzJira.checkEqualTrimmedStrings('test', 'whatever')).toBe(false);
    });
  });

  describe('checkAssignee()', () => {
    it('should return true', () => {
      expect(BzJira.checkAssignee(null, 'nobody@mozilla.org')).toBe(true);
      expect(BzJira.checkAssignee(undefined, 'nobody@mozilla.org')).toBe(true);
      expect(BzJira.checkAssignee(null, '---')).toBe(true);
      expect(BzJira.checkAssignee(undefined, '---')).toBe(true);
      expect(
        BzJira.checkAssignee('example@example.com', 'example@example.com'),
      ).toBe(true);
    });

    it('should return false', () => {
      expect(BzJira.checkEqualTrimmedStrings(null, null)).toBe(false);
      expect(
        BzJira.checkEqualTrimmedStrings(
          'somebody@mozilla.org',
          'nobody@mozilla.org',
        ),
      ).toBe(false);
    });
  });

  describe('isValidBugId()', () => {
    it('should return false for non numeric id', () => {
      expect(BzJira.isValidBugId('ABC')).toBe(false);
    });

    it('should return true for non numeric id', () => {
      expect(BzJira.isValidBugId('12312312')).toBe(true);
    });

    it('should return false for non string', () => {
      expect(BzJira.isValidBugId({})).toBe(false);
    });
  });

  describe('getComparisonData()', () => {
    it('should throw if passed invalid bug data', async () => {
      expect(async () => {
        await BzJira.getComparisonData();
      }).rejects.toThrow('Invalid bug data');
    });

    it('should call fetch with the API urls for the bz and jira APIs', async () => {
      const fakeWindow = {
        fetch: jest.fn(),
      };

      const fakeResponse = { status: 200, ok: true, json: jest.fn() };
      fakeResponse.json.mockResolvedValue({
        bugs: [
          {
            summary: 'test-summary',
            assigned_to: 'test@example.com',
            status: 'NEW',
            priority: 'P1',
          },
        ],
      });

      const fakeResponse2 = { status: 200, ok: true, json: jest.fn() };
      fakeResponse2.json.mockResolvedValue({
        fields: {
          summary: 'test-summary',
          assignee: {
            email_address: 'test@example.com',
          },
          status: {
            name: 'Backlog',
          },
          priority: 'highest',
        },
      });

      fakeWindow.fetch.mockResolvedValueOnce(fakeResponse);
      fakeWindow.fetch.mockResolvedValueOnce(fakeResponse2);

      await BzJira.getComparisonData('123456', 'JIRA-1234', fakeWindow);
      expect(fakeWindow.fetch.mock.calls[0].toString()).toMatch(
        /https:\/\/bugzilla.mozilla.org\/rest\/bug\/123456\?/,
      );
      expect(fakeWindow.fetch.mock.calls[1].toString()).toMatch(
        /https:\/\/mozilla-hub.atlassian.net\/rest\/api\/latest\/issue\/JIRA-1234/,
      );
    });

    it('should throw if jira API request is 404', async () => {
      const fakeWindow = {
        fetch: jest.fn(),
      };

      const fakeResponse = { status: 200, ok: true, json: jest.fn() };
      fakeResponse.json.mockResolvedValue({
        bugs: [
          {
            summary: 'test-summary',
            assigned_to: 'test@example.com',
            status: 'NEW',
            priority: 'P1',
          },
        ],
      });

      // Set up the right response for a 404 from jira.
      const fakeResponse2 = { status: 404, ok: false, json: jest.fn() };

      fakeWindow.fetch.mockResolvedValueOnce(fakeResponse);
      fakeWindow.fetch.mockResolvedValueOnce(fakeResponse2);

      expect(async () => {
        await BzJira.getComparisonData('123456', 'JIRA-1234', fakeWindow);
      }).rejects.toThrow(/JIRA API request failed/);
    });

    it('should throw if bz API request is not ok', async () => {
      const fakeWindow = {
        fetch: jest.fn(),
      };

      const fakeResponse = { status: 500, ok: false, json: jest.fn() };

      const fakeResponse2 = { status: 200, ok: true, json: jest.fn() };
      fakeResponse2.json.mockResolvedValue({
        fields: {
          summary: 'test-summary',
          assignee: {
            email_address: 'test@example.com',
          },
          status: {
            name: 'Backlog',
          },
          priority: 'highest',
        },
      });

      fakeWindow.fetch.mockResolvedValueOnce(fakeResponse);
      fakeWindow.fetch.mockResolvedValueOnce(fakeResponse2);

      expect(async () => {
        await BzJira.getComparisonData('123456', 'JIRA-1234', fakeWindow);
      }).rejects.toThrow('Bugzilla API request failed with error status 500');
    });
  });

  describe('isValidJiraId()', () => {
    it('should return false for an invalid jira id', () => {
      expect(BzJira.isValidJiraId('../../etc/passwd')).toBe(false);
    });

    it('should return true for valid jira id', () => {
      expect(BzJira.isValidJiraId('FIDEFE-12345')).toBe(true);
    });

    it('should return true for valid jira id', () => {
      expect(BzJira.isValidJiraId('WHATEVER-2')).toBe(true);
    });

    it('should return false for non string', () => {
      expect(BzJira.isValidJiraId({})).toBe(false);
    });
  });

  describe('validateBugData()', () => {
    it('should return defaults if bad data is supplied', () => {
      const filteredBugData = BzJira.validateBugData({
        bugId: 123,
        jiraIssueIds: [1, 2],
      });
      expect(filteredBugData.bugId).toBe(null);
      expect(filteredBugData.jiraIssueIds).toEqual([]);
    });

    it('should return defaults if bad data supplied is null', () => {
      const filteredBugData = BzJira.validateBugData({
        bugId: 123,
        jiraIssueIds: [1, 2],
      });
      expect(filteredBugData.bugId).toBe(null);
      expect(filteredBugData.jiraIssueIds).toEqual([]);
    });

    it('should return valid data if valid data supplied', () => {
      const filteredBugData = BzJira.validateBugData({
        bugId: '1234',
        jiraIssueIds: ['WHATEVER-1', 'WHATEVER-2'],
      });
      expect(filteredBugData.bugId).toBe('1234');
      expect(filteredBugData.jiraIssueIds).toEqual([
        'WHATEVER-1',
        'WHATEVER-2',
      ]);
    });
  });

  describe('handleIdentifiersMessage()', () => {
    it('should throw if the sender is invalid', async () => {
      await expect(BzJira.handleIdentifiersMessage()).rejects.toThrow(
        /^Invalid sender$/,
      );
    });

    it('should store data on the bugzilla id key', async () => {
      const oldRequestComparisonData = BzJira.requestComparisonData;
      const oldSetIconBadge = BzJira.setIconBadge;
      BzJira.requestComparisonData = jest.fn();
      BzJira.requestComparisonData.mockResolvedValue(null);
      BzJira.setIconBadge = jest.fn();

      await BzJira.handleIdentifiersMessage(
        {
          data: {
            bugId: '12345',
            jiraIssueIds: ['WHATEVER-1'],
          },
        },
        { tab: { id: 'whatever' }, id: config.EXT_ID },
      );

      try {
        expect(browser.storage.local.set).toHaveBeenCalledWith({
          12345: { jiraIssueIds: ['WHATEVER-1'] },
        });
        expect(BzJira.setIconBadge).toHaveBeenCalledWith(null, 'whatever');
      } finally {
        BzJira.requestComparisonData = oldRequestComparisonData;
        BzJira.setIconBadge = oldSetIconBadge;
      }
    });
  });

  describe('requestComparisonData()', () => {
    let oldGetComparisonData = BzJira.getComparisonData;
    beforeEach(() => {
      BzJira.getComparisonData = jest.fn();
    });

    afterEach(() => {
      BzJira.getComparisonData = oldGetComparisonData;
    });

    it('should throw if no current tab', async () => {
      browser.tabs.query.mockResolvedValue(false);
      expect(async () => {
        await BzJira.requestComparisonData();
      }).rejects.toThrow('No current tab, bailing!');
    });

    it('should throw if no bugId', async () => {
      browser.tabs.query.mockResolvedValue([{ url: 'https://example.com' }]);
      expect(async () => {
        await BzJira.requestComparisonData();
      }).rejects.toThrow('No BugId!');
    });

    it(`should return error message data if there's no jiraIssueIds`, async () => {
      browser.tabs.query.mockResolvedValue([
        { url: 'https://buzilla.mozilla.org/show_bug.cgi?id=123456' },
      ]);
      browser.storage.local.get.mockResolvedValue({
        123456: {
          jiraIssueIds: [],
          comparisonData: {},
        },
      });

      const result = await BzJira.requestComparisonData();
      expect(result.comparisonData.errorTitle).toEqual('No Linked JIRA Issue');
    });

    it(`should return cached data`, async () => {
      browser.tabs.query.mockResolvedValue([
        { url: 'https://buzilla.mozilla.org/show_bug.cgi?id=123456' },
      ]);
      browser.storage.local.get.mockResolvedValue({
        123456: {
          jiraIssueIds: ['JIRA-1234'],
          comparisonData: { test: 'test' },
        },
      });

      const result = await BzJira.requestComparisonData();
      expect(result.comparisonData.test).toEqual('test');
    });

    it(`should set error messages if requestComparisonData throws`, async () => {
      BzJira.getComparisonData = jest.fn();
      BzJira.getComparisonData.mockRejectedValue(Error('An unexpected error'));
      browser.tabs.query.mockResolvedValue([
        { url: 'https://buzilla.mozilla.org/show_bug.cgi?id=123456' },
      ]);
      browser.storage.local.get.mockResolvedValue({
        123456: {
          jiraIssueIds: ['WHATEVER-1', 'WHATEVER-2'],
        },
      });
      const result = await BzJira.requestComparisonData();
      expect(result.comparisonData.error).toEqual('An unexpected error');
    });

    it(`should return data from requestComparisonData()`, async () => {
      BzJira.getComparisonData.mockResolvedValue({ test: 'test' });
      browser.tabs.query.mockResolvedValue([
        { url: 'https://buzilla.mozilla.org/show_bug.cgi?id=123456' },
      ]);
      browser.storage.local.get.mockResolvedValue({
        123456: {
          jiraIssueIds: ['WHATEVER-1', 'WHATEVER-2'],
        },
      });
      const result = await BzJira.requestComparisonData();
      expect(result.comparisonData.test).toEqual('test');
    });
  });

  describe('getComparisonDataForPopup()', () => {
    it('throws if invalid', async () => {
      const fakeSender = {
        id: 'whatever',
      };
      expect(async () => {
        await BzJira.handleGetComparisonDataForPopup({}, fakeSender);
      }).rejects.toThrow('Invalid sender');
    });

    it('calls requestComparisonData', async () => {
      const fakeSender = {
        id: config.EXT_ID,
      };
      let oldRequestComparisonData;
      try {
        oldRequestComparisonData = BzJira.requestComparisonData;
        BzJira.requestComparisonData = jest.fn();
        await BzJira.handleGetComparisonDataForPopup({}, fakeSender);
        expect(BzJira.requestComparisonData).toHaveBeenCalled();
      } finally {
        BzJira.requestComparisonData = oldRequestComparisonData;
      }
    });
  });

  describe('handleMessage()', () => {
    it(`should throw if instruction isn't a string`, async () => {
      expect(async () => {
        await BzJira.handleMessage({ instruction: null });
      }).rejects.toThrow('Invalid instruction');
    });

    it('should dispatch message for popup', async () => {
      let oldHandleGetComparisonDataForPopup;
      try {
        oldHandleGetComparisonDataForPopup =
          BzJira.handleGetComparisonDataForPopup;
        BzJira.handleGetComparisonDataForPopup = jest.fn();
        await BzJira.handleMessage({
          instruction: 'getComparisonDataForPopup',
        });
        expect(BzJira.handleGetComparisonDataForPopup).toHaveBeenCalled();
      } finally {
        BzJira.handleGetComparisonDataForPopup =
          oldHandleGetComparisonDataForPopup;
      }
    });

    it('should dispatch message for identifiers', async () => {
      let oldHandleIdentifiersMessage;
      try {
        oldHandleIdentifiersMessage = BzJira.handleIdentifiersMessage;
        BzJira.handleIdentifiersMessage = jest.fn();
        await BzJira.handleMessage({ instruction: 'identifiersFromBugzilla' });
        expect(BzJira.handleIdentifiersMessage).toHaveBeenCalled();
      } finally {
        BzJira.handleIdentifiersMessage = oldHandleIdentifiersMessage;
      }
    });
  });

  describe('setIconBadge()', () => {
    it('should set the right icon if matching', () => {
      const fakeData = {
        bugId: '123456',
        jiraIssueIds: ['JIRA-12345'],
        comparisonData: {
          title: { jira: 'Whatever', bz: 'Whatever', matches: true },
          assignee: {
            jira: 'example@example.com',
            bz: 'example@example.com',
            matches: true,
          },
          priority: { jira: '(none)', bz: 'P1', matches: true },
          status: { jira: 'Up Next', bz: 'NEW', matches: true },
          whatever: { jira: 'test', bz: 'test', matches: true },
        },
      };

      BzJira.setIconBadge(fakeData, 'fakeTabId');
      expect(browser.action.setBadgeText).toHaveBeenCalledWith({
        text: '🟢',
        tabId: 'fakeTabId',
      });
      expect(browser.action.enable).toHaveBeenCalled();
    });

    it('should set the right badge if not matching', () => {
      const fakeData = {
        bugId: '123456',
        jiraIssueIds: ['JIRA-12345'],
        comparisonData: {
          title: { jira: 'Whatever', bz: 'Whatever', matches: false },
          assignee: {
            jira: 'example@example.com',
            bz: 'example@example.com',
            matches: true,
          },
          priority: { jira: '(none)', bz: 'P1', matches: true },
          status: { jira: 'Up Next', bz: 'NEW', matches: true },
          whatever: { jira: 'test', bz: 'test', matches: true },
        },
      };

      BzJira.setIconBadge(fakeData, 'fakeTabId');
      expect(browser.action.setBadgeText).toHaveBeenCalledWith({
        text: '🟠',
        tabId: 'fakeTabId',
      });
      expect(browser.action.enable).toHaveBeenCalled();
    });

    it(`should set the right badge if there's an issues`, () => {
      const fakeData = {};
      BzJira.setIconBadge(fakeData, 'fakeTabId');
      expect(browser.action.setBadgeText).toHaveBeenCalledWith({
        text: '⭕️',
        tabId: 'fakeTabId',
      });
      expect(browser.action.enable).toHaveBeenCalled();
    });

    it(`should set the test if there's an issues`, () => {
      const fakeData = { bugId: '123456', jiraIssueIds: [] };
      BzJira.setIconBadge(fakeData, 'fakeTabId');
      expect(browser.action.setTitle).toHaveBeenCalledWith({
        tabId: 'fakeTabId',
        title: 'No Jira ticket associated with this bug',
      });
      expect(browser.action.enable).toHaveBeenCalled();
    });
  });

  describe('handleSuspend()', () => {
    it('should call browser.action.disable', () => {
      BzJira.handleSuspend();
      expect(browser.action.disable).toHaveBeenCalled();
    });
  });
});
