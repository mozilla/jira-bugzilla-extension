/*
 * @jest-environment jsdom
 *
 */

import { jest } from '@jest/globals';
import {
  waitFor,
  getByText,
  getAllByText,
  findByText,
  queryByText,
  fireEvent,
} from '@testing-library/dom';
// Skipping for now, since not sure if this feature makes sense.
import '@testing-library/jest-dom';

import config from '../src/shared/config.js';
import BZContentScript from '../src/content/bugzilla';

const BZContent = new BZContentScript();

describe('Bugzilla Content Script', () => {
  beforeAll(() => {
    document.body.innerHTML = '';
  });

  describe('getBuglistRestURL()', () => {
    it('should get a REST url from the DOM', () => {
      document.body.innerHTML = `<div class="bz_query_links">
        <a href="http://example.com">Not a rest URL</a>
        <a href="http://example.com">REST</a>
      </div>`;
      const restURL = BZContent.getBuglistRestURL();
      expect(restURL).toEqual('http://example.com/');
    });
  });

  describe('getOrderParams()', () => {
    it('should get sort from query form in the DOM', () => {
      document.body.innerHTML = `<div class="bz_query_remember" valign="middle">
          <form method="get" action="/buglist.cgi">
            <input
              type="hidden"
              name="newquery"
              value="component=Bookmarks%20%26%20History&amp;list_id=16579196&amp;product=Firefox&amp;query_format=advanced&amp;resolution=---&amp;order=changeddate%2Cbug_status%2Cpriority%2Cassigned_to%2Cbug_id">
          </form>
        </div>`;
      const order = BZContent.getOrderParams();
      expect(order).toEqual(
        'changeddate,bug_status,priority,assigned_to,bug_id',
      );
    });
  });

  describe('getBuglistApiURL()', () => {
    it('should get the buglist API URL with the correct order and fields', () => {
      BZContent.getOrderParams = jest.fn();
      BZContent.getOrderParams.mockReturnValue(
        'changeddate,bug_status,priority,assigned_to,bug_id,bug_whatever',
      );

      BZContent.getBuglistRestURL = jest.fn();
      BZContent.getBuglistRestURL.mockReturnValue('http://example.com/REST/');

      const fakeWindow = {
        location: 'http://bugzilla.mozilla.org/?limit=100',
      };

      const APIURL = new URL(BZContent.getBuglistApiURL(fakeWindow));
      const APIParams = APIURL.searchParams;
      const includeFields = APIParams.get('include_fields').split(',');
      // We need to see the sort params in the include_fields for the sort to work.
      expect(includeFields).toContain('whatever');
      // 'bug_' should be stripped off the params.
      expect(includeFields).not.toContain('bug_whatever');
      // The custom limit should be passed through.
      expect(APIParams.get('limit')).toBe('100');
      expect(APIURL.origin).toBe('http://example.com');
      expect(APIURL.pathname).toBe('/REST/');
    });

    it('should use a default limit in the rest API URL if not set in the page URL', () => {
      BZContent.getOrderParams = jest.fn();
      BZContent.getOrderParams.mockReturnValue(
        'changeddate,bug_status,priority',
      );
      BZContent.getBuglistRestURL = jest.fn();
      BZContent.getBuglistRestURL.mockReturnValue('http://example.com/REST/');
      const fakeWindow = {
        location: 'http://bugzilla.mozilla.org/',
      };
      const APIURL = BZContent.getBuglistApiURL(fakeWindow);
      const APIParams = new URL(APIURL).searchParams;
      expect(APIParams.get('limit')).toBe('500');
    });
  });

  describe('extractJIRALinksFromSeeAlso()', () => {
    it('should extract multiple JIRA links if present', () => {
      const links = [
        'https://example.com',
        'https://mozilla-hub.atlassian.net/browse/FIDEFE-1234',
        'https://mozilla-hub.atlassian.net/browse/FIDEFE-1337',
      ];
      const extractedLinks = BZContent.extractJIRALinksFromSeeAlso(links);
      expect(extractedLinks.length).toBe(2);
      expect(extractedLinks[0].href).toEqual(links[1]);
      expect(extractedLinks[0].text).toEqual('FIDEFE-1234');
      expect(extractedLinks[1].href).toEqual(links[2]);
      expect(extractedLinks[1].text).toEqual('FIDEFE-1337');
    });

    it('should return an empty list if nothing matches', () => {
      const links = ['https://example.com'];
      const extractedLinks = BZContent.extractJIRALinksFromSeeAlso(links);
      expect(extractedLinks).toEqual([]);
    });
  });

  describe('fetchBZData()', () => {
    it('should fetch the url provided', async () => {
      const fakeWindow = {
        fetch: jest.fn(),
      };
      fakeWindow.fetch.mockResolvedValue({
        status: 200,
        ok: true,
        json: async () => ({
          data: 'WHATEVER',
        }),
      });
      const url = 'https://example.com';
      const result = await BZContent.fetchBZData(url, fakeWindow);
      expect(result).toEqual({ data: 'WHATEVER' });
    });

    it('should throw if not a 200 status', async () => {
      const fakeWindow = {
        fetch: jest.fn(),
      };
      fakeWindow.fetch.mockResolvedValue({
        status: 500,
        ok: false,
        statusText: 'Server Error',
        json: async () => ({
          data: 'WHATEVER',
        }),
      });
      const url = 'https://example.com';
      expect(async () => {
        await BZContent.fetchBZData(url, fakeWindow);
      }).rejects.toThrow('Server Error');
    });
  });

  describe('initBuglist()', () => {
    beforeEach(() => {
      fetch = jest.fn();
      const mockJson = jest.fn();
      mockJson.mockReturnValue({
        bugs: [
          {
            id: 1,
            see_also: ['https://mozilla-hub.atlassian.net/browse/WHATEVER-1'],
          },
          {
            id: 2,
            see_also: ['https://mozilla-hub.atlassian.net/browse/WHATEVER-2'],
          },
          {
            id: 3,
            see_also: ['https://mozilla-hub.atlassian.net/browse/WHATEVER-3'],
          },
        ],
      });
      fetch.mockReturnValue({ status: 200, ok: true, json: mockJson });
    });

    it('should be a noop if the column has already been added', async () => {
      const tableAlreadyUpdated = `<table><thead><tr>
        <th id="bz-jira-table-header" style="min-width: 7.5em;">Jira Link</th>
      </tr></thead></table>`;
      document.body.innerHTML = tableAlreadyUpdated;

      const result = await BZContent.initBuglist();
      expect(document.body.innerHTML).toEqual(tableAlreadyUpdated);
    });

    it('should inject the tds with the link', async () => {
      document.body.innerHTML = `<table class="bz_buglist">
        <thead>
          <tr>
            <th>Example table heading</th>
          </tr>
        </thead>
        <tbody>
          <tr id="b1"><td>Example Cell 1</td></tr>
          <tr id="b2"><td>Example Cell 2</td></tr>
          <tr id="b3"><td>Example Cell 3</td></tr>
        </tbody>
      </table>`;

      await BZContent.initBuglist();

      const jiraLink1 = await findByText(document.body, 'WHATEVER-1');
      expect(jiraLink1.href).toBe(
        'https://mozilla-hub.atlassian.net/browse/WHATEVER-1',
      );
      expect(jiraLink1.parentNode.nodeName).toBe('TD');

      const jiraLink2 = await findByText(document.body, 'WHATEVER-2');
      expect(jiraLink2.href).toBe(
        'https://mozilla-hub.atlassian.net/browse/WHATEVER-2',
      );
      expect(jiraLink2.parentNode.nodeName).toBe('TD');

      const jiraLink3 = await findByText(document.body, 'WHATEVER-3');
      expect(jiraLink3.href).toBe(
        'https://mozilla-hub.atlassian.net/browse/WHATEVER-3',
      );
      expect(jiraLink3.parentNode.nodeName).toBe('TD');
    });

    it('should warn for non-matching data', async () => {
      document.body.innerHTML = `<table class="bz_buglist">
        <thead>
          <tr>
            <th>Example table heading</th>
          </tr>
        </thead>
        <tbody>
          <tr id="b1"><td>Example Cell 1</td></tr>
          <tr id="b4"><td>Example Cell 2</td></tr>
          <tr id="b5"><td>Example Cell 3</td></tr>
        </tbody>
      </table>`;

      const oldConsoleWarn = window.console.warn;
      window.console.warn = jest.fn();

      try {
        await BZContent.initBuglist();
        expect(window.console.warn).toHaveBeenCalledWith(
          '2 bugs not found in the bug list table',
        );
      } finally {
        window.console.warn = oldConsoleWarn;
      }
    });
  });

  describe('initBug()', () => {
    const fakeWindow = {
      location: 'https://bugzilla.mozilla.org/show_bug.cgi?id=123456789',
    };

    beforeEach(() => {
      fetch = jest.fn();
      const mockJson = jest.fn();
      mockJson.mockReturnValue({
        bugs: [
          {
            id: 123456789,
            see_also: [
              'https://bugzilla.mozilla.org/show_bug.cgi?id=987654321',
              'https://mozilla-hub.atlassian.net/browse/WHATEVER-123',
            ],
          },
        ],
      });
      fetch.mockReturnValue({ json: mockJson });
    });

    it('should return early if link has already been injected', async () => {
      document.body.innerHTML = `<span id="field-value-bug_id" data-jira-bz-link-injected="true">
        <a href="/show_bug.cgi?id=123456789">Bug 123456789</a>
      </span>`;

      const result = await BZContent.initBug();
      expect(result).toBe(undefined);
    });

    it('should add the buglink(s)', async () => {
      document.body.innerHTML = `<span id="field-value-bug_id">
        <a href="/show_bug.cgi?id=123456789">Bug 123456789</a>
      </span>`;

      const result = await BZContent.initBug(fakeWindow);
      expect(
        document.querySelectorAll('#jira-bz-buglink-123456789').length,
      ).toEqual(1);
    });

    it('should set the data attribute to indicate that the link has been added', async () => {
      document.body.innerHTML = `<span id="field-value-bug_id">
        <a href="/show_bug.cgi?id=123456789">Bug 123456789</a>
      </span>`;

      const result = await BZContent.initBug(fakeWindow);
      expect(
        !!document
          .getElementById('field-value-bug_id')
          .getAttribute('data-jira-bz-link-injected'),
      ).toBe(true);
    });
  });

  describe('whiteboardTagging()', () => {
    beforeEach(() => {
      document.body.innerHTML = `
        <select name="component" id="component" aria-labelledby="component-help-link">
           <option value="about:logins">about:logins</option>
           <option value="Firefox View" selected="">Firefox View</option>
        </select>

        <input name="status_whiteboard" id="status_whiteboard" value="" aria-labelledby="status_whiteboard-help-link">
      `;

      BZContent.getWhiteboardConfigForComponent = jest.fn();
      BZContent.getWhiteboardConfigForComponent.mockReturnValue([
        '[fidefe-test-one]',
        '[fidefe-test-two]',
      ]);
    });

    it(`should add a select to add a whiteboard tag if there's a config`, async () => {
      BZContent.whiteboardTagging();
      await waitFor(() => {
        expect(
          getByText(document.body, '[fidefe-test-one]'),
        ).toBeInTheDocument();
        expect(
          getByText(document.body, 'Add Jira Whiteboard Tag'),
        ).toBeInTheDocument();
      });
    });

    it(`should remove the select and button if there's no config`, async () => {
      BZContent.whiteboardTagging();
      const component = document.getElementById('component');
      const option = document.querySelector(
        '#component option[value="about:logins"]',
      );
      component.value = option.value;
      BZContent.getWhiteboardConfigForComponent.mockReturnValue(null);

      fireEvent.change(component);

      await waitFor(() => {
        expect(
          queryByText(document.body, '[fidefe-test-one]'),
        ).not.toBeInTheDocument();
        expect(
          queryByText(document.body, 'Add Jira Whiteboard Tag'),
        ).not.toBeInTheDocument();
      });
    });

    it('should only add one select if called multiple times', async () => {
      BZContent.whiteboardTagging();
      BZContent.whiteboardTagging();
      await waitFor(() => {
        expect(getAllByText(document.body, '[fidefe-test-one]').length).toBe(1);
        expect(
          getAllByText(document.body, 'Add Jira Whiteboard Tag').length,
        ).toBe(1);
      });
    });

    it('should disable the button if the selected string is already added', async () => {
      BZContent.whiteboardTagging();
      let button;
      await waitFor(() => {
        expect(
          getByText(document.body, '[fidefe-test-one]'),
        ).toBeInTheDocument();
        expect(
          (button = getByText(document.body, 'Add Jira Whiteboard Tag')),
        ).toBeInTheDocument();
      });

      fireEvent.click(button);
      expect(button.getAttribute('disabled')).toBe('true');
    });

    // Skipping for now, since not sure if this feature makes sense.
    it.skip('should replace the string in the whiteboard input if it starts with the same prefix', async () => {
      const wbInput = document.getElementById('status_whiteboard');
      wbInput.value = '[fidefe-whatever]';
      BZContent.whiteboardTagging();

      let button;
      await waitFor(() => {
        expect(
          getByText(document.body, '[fidefe-test-one]'),
        ).toBeInTheDocument();
        expect(
          (button = getByText(document.body, 'Add Jira Whiteboard Tag')),
        ).toBeInTheDocument();
      });

      fireEvent.click(button);
      expect(wbInput.value).not.toContain('[fidefe-whatever]');
    });
  });

  describe('initEnterBug()', () => {
    it('should call whitboardTagging', () => {
      BZContent.whiteboardTagging = jest.fn();
      BZContent.initEnterBug();
      expect(BZContent.whiteboardTagging).toHaveBeenCalled();
    });
  });

  describe('init()', () => {
    it('should call initEnterBug if the url is a bug', () => {
      const fakeWindow = {
        location: {
          href: config.BZ_ENTER_BUG_URL_BASE,
        },
      };
      BZContent.initEnterBug = jest.fn();
      BZContent.init(fakeWindow);
      expect(BZContent.initEnterBug).toHaveBeenCalled();
    });

    it('should call initBug if the url is a bug', () => {
      const fakeWindow = {
        location: {
          href: config.BZ_BUG_URL_BASE,
        },
      };
      BZContent.initBug = jest.fn();
      BZContent.init(fakeWindow);
      expect(BZContent.initBug).toHaveBeenCalled();
    });

    it('should call initBuglist if the url is a bug list', () => {
      const fakeWindow = {
        location: {
          href: config.BZ_BUGLIST_URL_BASE,
        },
      };
      BZContent.initBuglist = jest.fn();
      BZContent.init(fakeWindow);
      expect(BZContent.initBuglist).toHaveBeenCalled();
    });

    it(`shouldn't call either initBug or initBuglist if the url doesn't match`, () => {
      const fakeWindow = {
        location: {
          href: 'https://bugzilla.mozilla.org/whatever',
        },
      };
      BZContent.initBug = jest.fn();
      BZContent.initBuglist = jest.fn();
      BZContent.init(fakeWindow);
      expect(BZContent.initBug).not.toHaveBeenCalled();
      expect(BZContent.initBuglist).not.toHaveBeenCalled();
    });
  });
});
