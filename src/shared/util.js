import config from './config.js';

export function isValidSender(sender) {
  if (!sender || sender.id !== config.EXT_ID) {
    throw new Error('Invalid sender');
  }
  return true;
}

export function getBugId(url) {
  const bugURL = new URL(url);
  const bugParams = bugURL.searchParams;
  return bugParams.get('id');
}
