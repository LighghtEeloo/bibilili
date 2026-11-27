import { createSign } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { setTimeout as sleep } from 'node:timers/promises';
import { pathToFileURL } from 'node:url';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const STORE_URL = 'https://chromewebstore.googleapis.com';
const SCOPE = 'https://www.googleapis.com/auth/chromewebstore';
const ACTIVE_STATES = new Set(['PENDING_REVIEW', 'STAGED']);
const PUBLISHED_STATES = new Set(['PUBLISHED', 'PUBLISHED_TO_TESTERS']);

/** Exchange a service account assertion for a scoped access token. */
export async function getAccessToken(serviceAccountJson, fetchImpl = fetch) {
  let account;
  try {
    account = JSON.parse(serviceAccountJson);
  } catch {
    throw new Error('CWS_SERVICE_ACCOUNT_JSON must contain a service account JSON key.');
  }
  if (account?.type !== 'service_account' || !account.client_email || !account.private_key) {
    throw new Error('CWS_SERVICE_ACCOUNT_JSON is missing service account key fields.');
  }
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const claims = encode({ iss: account.client_email, scope: SCOPE, aud: TOKEN_URL, iat: now, exp: now + 600 });
  const unsigned = encode({ alg: 'RS256', typ: 'JWT' }) + '.' + claims;
  const assertion = unsigned + '.' + createSign('RSA-SHA256').update(unsigned).sign(account.private_key, 'base64url');
  const body = new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion });
  const result = await request(fetchImpl, 'Chrome OAuth', TOKEN_URL, { method: 'POST', body });
  if (typeof result.access_token !== 'string' || !result.access_token) {
    throw new Error('Chrome OAuth did not return an access token.');
  }
  return result.access_token;
}

/** Read the official JSON response. Never log raw responses or auth headers. */
async function request(fetchImpl, operation, url, options) {
  const response = await fetchImpl(url, { ...options, redirect: 'error', signal: AbortSignal.timeout(30_000) });
  if (!response.ok) {
    throw new Error(operation + ' failed (HTTP ' + response.status + '). Check the Chrome Web Store dashboard and credentials.');
  }
  return response.json();
}

/** Upload the verified Chrome archive and request normal review and publication. */
export async function publishChrome({ archive, version, publisherId, extensionId, accessToken }, {
  fetchImpl = fetch, pause = sleep, pollLimit = 60,
} = {}) {
  if (!/^[A-Za-z0-9_-]+$/.test(publisherId ?? '') || !/^[a-p]{32}$/.test(extensionId ?? '')) {
    throw new Error('Set CWS_PUBLISHER_ID and CWS_EXTENSION_ID to the IDs in the Chrome developer dashboard.');
  }
  const item = 'v2/publishers/' + publisherId + '/items/' + extensionId;
  const headers = { Authorization: 'Bearer ' + accessToken };
  const status = () => request(fetchImpl, 'Chrome item status', STORE_URL + '/' + item + ':fetchStatus', { headers });
  const current = await status();
  const hasVersion = (revision) => revision?.distributionChannels?.some((channel) => channel.crxVersion === version);
  if (hasVersion(current.publishedItemRevisionStatus)) {
    return 'Chrome ' + version + ' is already published.';
  }
  const submitted = current.submittedItemRevisionStatus;
  if (ACTIVE_STATES.has(submitted?.state)) {
    if (hasVersion(submitted)) return 'Chrome ' + version + ' was already submitted (' + submitted.state + ').';
    throw new Error('Chrome has another submission in review or staged. Resolve it in the dashboard before retrying.');
  }
  if (current.lastAsyncUploadState === 'IN_PROGRESS') {
    throw new Error('Chrome is still processing a previous upload. Check the dashboard before retrying.');
  }

  const upload = await request(fetchImpl, 'Chrome ZIP upload', STORE_URL + '/upload/' + item + ':upload', {
    method: 'POST', headers: { ...headers, 'Content-Type': 'application/zip' }, body: archive,
  });
  let state = upload.uploadState;
  for (let i = 0; state === 'IN_PROGRESS' && i < pollLimit; i++) {
    await pause(5_000);
    state = (await status()).lastAsyncUploadState;
  }
  if (state !== 'SUCCEEDED' || (upload.crxVersion && upload.crxVersion !== version)) {
    throw new Error('Chrome could not confirm the upload for version ' + version + '. Check the dashboard before retrying.');
  }

  const result = await request(fetchImpl, 'Chrome publication request', STORE_URL + '/' + item + ':publish', {
    method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ publishType: 'DEFAULT_PUBLISH' }),
  });
  if (PUBLISHED_STATES.has(result.state)) return 'Chrome ' + version + ' is ' + result.state + '.';
  if (ACTIVE_STATES.has(result.state)) return 'Chrome ' + version + ' was submitted (' + result.state + ').';
  throw new Error('Chrome did not confirm submission. Check the developer dashboard before retrying.');
}

async function main() {
  const [path, version] = process.argv.slice(2);
  if (!path || !version) throw new Error('Usage: node scripts/publish-chrome.mjs ARCHIVE VERSION');
  const { CWS_SERVICE_ACCOUNT_JSON, CWS_PUBLISHER_ID, CWS_EXTENSION_ID } = process.env;
  if (!CWS_SERVICE_ACCOUNT_JSON || !CWS_PUBLISHER_ID || !CWS_EXTENSION_ID) {
    throw new Error('Configure CWS_SERVICE_ACCOUNT_JSON, CWS_PUBLISHER_ID, and CWS_EXTENSION_ID before publishing.');
  }
  const archive = await readFile(path);
  const accessToken = await getAccessToken(CWS_SERVICE_ACCOUNT_JSON);
  console.log(await publishChrome({ archive, version, accessToken, publisherId: CWS_PUBLISHER_ID, extensionId: CWS_EXTENSION_ID }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
