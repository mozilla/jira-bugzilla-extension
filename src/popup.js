/*
 * When opened this popup script sends a message to the background script to request
 * the comparison data for JIRA and BZ.
 *
 * Once the data is returned it's rendered. This is currently using DOM methods to build the
 * nodes and insert them. This works since it's not much HTML but if this grows, switching
 * to a more developer friendly method would make sense.
 *
 */

browser.runtime.sendMessage({ greeting: 'getComparisonData' }, (response) => {
  if (!response) {
    return;
  }
  const { comparisonData, bugId, jiraIssueID, error, errorTitle } = response;
  const dataPlaceholder = document.getElementById('data');
  dataPlaceholder.innerHTML = '';

  // Setup the heading
  const heading = document.createElement('h2');

  if (error) {
    heading.textContent = errorTitle;
    const errorMessage = document.createElement('p');
    errorMessage.textContent = error;
    dataPlaceholder.appendChild(heading);
    dataPlaceholder.appendChild(errorMessage);
    return;
  }

  const img = document.createElement('img');
  img.src = browser.runtime.getURL('icons/jira-32.png');
  img.alt = 'Jira';
  img.height = '16';
  img.width = '16';
  heading.appendChild(img);
  const headingText = document.createTextNode(
    ` Comparing ${jiraIssueID} to Bug ${bugId}`,
  );
  heading.appendChild(headingText);

  dataPlaceholder.appendChild(heading);

  const table = document.createElement('table');
  const thead = document.createElement('thead');
  const thRow = document.createElement('tr');

  const th0 = document.createElement('th');
  th0.textContent = 'Field';

  const th1 = document.createElement('th');
  th1.textContent = 'Matches?';
  const th2 = document.createElement('th');
  th2.textContent = 'JIRA';
  const th3 = document.createElement('th');
  th3.textContent = 'Bugzilla';

  thRow.appendChild(th0);
  thRow.appendChild(th1);
  thRow.appendChild(th2);
  thRow.appendChild(th3);
  thead.appendChild(thRow);
  table.appendChild(thead);

  for (let item in comparisonData) {
    const tr = document.createElement('tr');
    const td0 = document.createElement('th');
    td0.textContent = item;

    const td1 = document.createElement('td');
    if (typeof comparisonData[item].matches === 'undefined') {
      td1.textContent = 'N/A';
    } else {
      td1.textContent = comparisonData[item].matches ? ' ✅ ' : '⛔️';
    }
    td1.className = 'match';

    const td2 = document.createElement('td');
    td2.textContent = comparisonData[item].jira;

    const td3 = document.createElement('td');
    td3.textContent = comparisonData[item].bz;

    tr.appendChild(td0);
    tr.appendChild(td1);
    tr.appendChild(td2);
    tr.appendChild(td3);

    table.appendChild(tr);
  }

  dataPlaceholder.appendChild(table);
});
