import { jest } from '@jest/globals';
import {
  getByText,
  getByTestId,
  queryByTestId,
  findByText,
  waitFor,
} from '@testing-library/dom';
import '@testing-library/jest-dom';

describe('Popup', () => {
  beforeEach(() => {
    jest.resetModules();
    document.body.innerHTML = '<div id="data"></div>';
  });

  it('should send a message when the module is loaded', async () => {
    await import('../src/popup.js');
    expect(browser.runtime.sendMessage).toHaveBeenCalled();
  });

  it('should render a comparison table', async () => {
    const fakeResponse = {
      bugId: '123456',
      jiraIssueIds: ['JIRA-12345'],
      comparisonData: {
        title: { jira: 'Whatever', bz: 'Whatever', matches: true },
        assignee: {
          jira: 'example@example.com',
          bz: 'example@example.com',
          matches: true,
        },
        priority: { jira: '(none)', bz: 'P1', matches: false },
        status: { jira: 'Up Next', bz: 'NEW', matches: false },
        whatever: { jira: 'test', bz: 'test', matches: undefined },
      },
    };

    await import('../src/popup.js');

    // Get the callback function and call it with a fake response.
    const callback = browser.runtime.sendMessage.mock.calls[0][1];

    callback(fakeResponse);

    await waitFor(() => {
      expect(
        getByText(document.body, /Comparing JIRA-12345 to Bug 123456/),
      ).toBeInTheDocument();
      expect(getByTestId(document.body, 'priority')).toHaveTextContent(
        '⛔️ NO',
      );
      expect(getByTestId(document.body, 'title')).toHaveTextContent('✅ YES');
      expect(getByTestId(document.body, 'whatever')).toHaveTextContent('N/A');
    });
  });

  it('should render an error message', async () => {
    const fakeResponse = {
      comparisonData: {
        error: 'This is an error message',
        errorTitle: 'error-title',
      },
      bugId: '123456',
      jiraIssueIds: [],
    };

    await import('../src/popup.js');

    // Get the callback function and call it with a fake response.
    const callback = browser.runtime.sendMessage.mock.calls[0][1];

    callback(fakeResponse);

    await waitFor(() => {
      expect(
        getByText(document.body, /This is an error message/),
      ).toBeInTheDocument();
    });
  });

  it('should escape HTML in data', async () => {
    const fakeResponse = {
      comparisonData: {
        error: '<span data-test-id="test-injection"></span>',
        errorTitle: 'error-title',
      },
      bugId: '123456',
      jiraIssueIds: [],
    };

    await import('../src/popup.js');

    // Get the callback function and call it with a fake response.
    const callback = browser.runtime.sendMessage.mock.calls[0][1];

    callback(fakeResponse);

    await waitFor(() => {
      expect(
        queryByTestId(document.body, 'test-injection'),
      ).not.toBeInTheDocument();
    });
  });

  it('should be noop if no response', async () => {
    await import('../src/popup.js');

    // Get the callback function and call it with a fake response.
    browser.runtime.sendMessage.mock.calls[0][1]();

    await waitFor(() => {
      expect(document.body.innerHTML).toBe('<div id="data"></div>');
    });
  });
});
