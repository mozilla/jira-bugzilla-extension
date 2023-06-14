/*
 * @jest-environment jsdom
 *
 */

import * as config from '../src/shared/config.js';
import BzJiraBackground from '../src/background';

const BzJira = new BzJiraBackground();

describe('Background Script', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
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

  describe('isValidJiraId()', () => {
    it('should return false for an invalid jira id', () => {
      expect(BzJira.isValidJiraId('../../etc/passwd')).toBe(false);
    });

    it('should return true for valid jira id', () => {
      expect(BzJira.isValidJiraId('FIDEFE-12345')).toBe(true);
    });

    it('should return false for non string', () => {
      expect(BzJira.isValidJiraId({})).toBe(false);
    });
  });
});
