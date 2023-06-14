/*
 * @jest-environment jsdom
 *
 */

import { jest } from '@jest/globals';

import * as config from '../src/shared/config.js';
import BZContentScript from '../src/content/bugzilla';

const BZContent = new BZContentScript();

describe('Bugzilla Content Script', () => {
  describe('getBuglistRestURL()', () => {
    it('should get a REST url from the DOM', () => {
      document.body.innerHTML = `<div class="bz_query_links">
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
        json: async () => ({
          data: 'WHATEVER',
        }),
      });
      const url = 'https://example.com';
      const result = await BZContent.fetchBZData(url, fakeWindow);
      expect(result).toEqual({ data: 'WHATEVER' });
    });
  });

  describe('initBuglist()', () => {});

  describe('initBug()', () => {});

  describe('init()', () => {
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
