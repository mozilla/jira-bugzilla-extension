/*
 * @jest-environment jsdom
 *
 */

import * as util from '../src/shared/util.js';

describe('util', () => {
  describe('getBugId()', () => {
    it('should get bugId from bug URL', () => {
      const bugId = util.getBugId(
        'https://bugzilla.mozilla.org/show_bug.cgi?id=123456',
      );
      expect(bugId).toEqual('123456');
    });

    it(`should return null if there's no bugId in the URL`, () => {
      const bugId = util.getBugId('https://bugzilla.mozilla.org/show_bug.cgi');
      expect(bugId).toEqual(null);
    });
  });

  describe('isValidSender()', () => {
    it('should throw if sender is invalid', () => {
      const fakeSender = { id: 'whatever@example.com' };
      expect(() => {
        util.isValidSender(fakeSender);
      }).toThrow(/^Invalid sender$/);
    });
  });
});
