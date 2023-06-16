import { jest } from '@jest/globals';
/*
 * Fake out the webextension APIS.
 *
 */

global.browser = {
  action: {
    show: jest.fn(),
    disable: jest.fn(),
  },
  pageAction: {
    show: jest.fn(),
  },
  permissions: {
    getAll: jest.fn(),
    onAdded: {
      addListener: jest.fn(),
      removeListener: jest.fn(),
    },
    onRemoved: {
      addListener: jest.fn(),
      removeListener: jest.fn(),
    },
    request: jest.fn(),
    remove: jest.fn(),
  },
  runtime: {
    id: 'a-fake-id-for-testing',
    onMessage: {
      addListener: jest.fn(),
    },
    onSuspend: {
      addListener: jest.fn(),
    },
    getManifest: jest.fn(),
  },
  tabs: {
    onUpdated: {
      addListener: jest.fn(),
    },
    onActivated: {
      addListener: jest.fn(),
    },
  },
};
