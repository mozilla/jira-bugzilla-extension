export function isValidSender(sender) {
  if (sender.id !== 'jira-bz@mozilla.com') {
    throw new Error('Invalid sender');
  }
}

export function getBugId(url) {
  const bugURL = new URL(url);
  const bugParams = bugURL.searchParams;
  return bugParams.get('id');
}
