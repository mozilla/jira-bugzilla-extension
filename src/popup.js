/*
 * When opened this popup script sends a message to the background script to request
 * the comparison data for JIRA and BZ.
 *
 */

import { html, render } from '../vendor/lit-html/lit-html.js';

const comparisonTable = (title, data) => {
  function getMatchContent(match) {
    const matchContent = '';
    if (match === 'undefined') {
      return 'N/A';
    }
    return match ? '✅ YES' : '⛔️ NO';
  }

  return html` <h2>
      <img
        width="16"
        height="16"
        src="${browser.runtime.getURL('icons/jira-32.png')}"
        alt=""
      />
      ${data.errorTitle ? data.errorTitle : title}
    </h2>

    ${data.error
      ? html`<p>${data.error}</p>`
      : html`<table>
          <thead>
            <tr>
              <th>Field</th>
              <th>Matches?</th>
              <th>Jira</th>
              <th>Bugzilla</th>
            </tr>
          </thead>
          <tbody>
            ${Object.keys(data).map(
              (key) => html` <tr>
                <th>${key}</th>
                <td class="match">${getMatchContent(data[key].matches)}</td>
                <td>${data[key].jira}</td>
                <td>${data[key].bz}</td>
              </tr>`,
            )}
          </tbody>
        </table>`}`;
};

browser.runtime.sendMessage(
  { instruction: 'getComparisonDataForPopup' },
  (response) => {
    console.log('popup response', response);
    if (!response) {
      return;
    }

    const { comparisonData, bugId, jiraIssueIds } = response;
    const jiraIssueId = jiraIssueIds[0];

    const dataPlaceholder = document.getElementById('data');
    const title = ` Comparing ${jiraIssueId} to Bug ${bugId}`;

    render(comparisonTable(title, comparisonData), dataPlaceholder);
  },
);
