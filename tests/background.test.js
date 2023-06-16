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
