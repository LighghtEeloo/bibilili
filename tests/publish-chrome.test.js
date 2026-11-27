const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createVerify, generateKeyPairSync } = require('node:crypto');

const input = {
  archive: Buffer.from('fixture ZIP'),
  version: '0.1.15',
  publisherId: '1234',
  extensionId: 'a'.repeat(32),
  accessToken: 'fixture-token',
};
const store = 'https://chromewebstore.googleapis.com';
const item = '/v2/publishers/1234/items/' + input.extensionId;

async function fixture(responses, options = {}) {
  const { publishChrome } = await import('../scripts/publish-chrome.mjs');
  const calls = [];
  const result = publishChrome(input, {
    fetchImpl: async (url, request) => {
      calls.push({ url, request });
      assert.ok(responses.length, 'unexpected request to ' + url);
      return Response.json(responses.shift());
    },
    pause: async () => {},
    ...options,
  });
  return { result, calls };
}

test('Chrome exchanges a signed, scoped service account assertion', async () => {
  const { getAccessToken } = await import('../scripts/publish-chrome.mjs');
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const key = JSON.stringify({
    type: 'service_account',
    client_email: 'release@example.invalid',
    private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }),
  });
  const token = await getAccessToken(key, async (url, request) => {
    assert.equal(url, 'https://oauth2.googleapis.com/token');
    assert.equal(request.method, 'POST');
    const [header, payload, signature] = request.body.get('assertion').split('.');
    const claims = JSON.parse(Buffer.from(payload, 'base64url'));
    assert.equal(claims.aud, url);
    assert.equal(claims.iss, 'release@example.invalid');
    assert.equal(claims.scope, 'https://www.googleapis.com/auth/chromewebstore');
    assert.ok(createVerify('RSA-SHA256').update(header + '.' + payload).verify(publicKey, signature, 'base64url'));
    return Response.json({ access_token: 'test-access-token' });
  });
  assert.equal(token, 'test-access-token');
});

test('Chrome polls an async upload then submits the ZIP for normal review', async () => {
  const { result, calls } = await fixture([
    {}, { uploadState: 'IN_PROGRESS' }, { lastAsyncUploadState: 'IN_PROGRESS' },
    { lastAsyncUploadState: 'SUCCEEDED' }, { state: 'PENDING_REVIEW' },
  ]);
  assert.equal(await result, 'Chrome 0.1.15 was submitted (PENDING_REVIEW).');
  assert.deepEqual(calls.map(({ url }) => url), [
    store + item + ':fetchStatus', store + '/upload' + item + ':upload',
    store + item + ':fetchStatus', store + item + ':fetchStatus', store + item + ':publish',
  ]);
  assert.equal(calls[1].request.body, input.archive);
  assert.equal(calls[1].request.headers.Authorization, 'Bearer fixture-token');
  assert.deepEqual(JSON.parse(calls[4].request.body), { publishType: 'DEFAULT_PUBLISH' });
});

test('Chrome does not resubmit a version already awaiting review', async () => {
  const { result, calls } = await fixture([{ submittedItemRevisionStatus: {
    state: 'PENDING_REVIEW', distributionChannels: [{ crxVersion: input.version }],
  } }]);
  assert.match(await result, /already submitted/);
  assert.equal(calls.length, 1);
});

test('Chrome leaves an unrelated pending submission untouched', async () => {
  const { result, calls } = await fixture([{ submittedItemRevisionStatus: {
    state: 'PENDING_REVIEW', distributionChannels: [{ crxVersion: '0.1.14' }],
  } }]);
  await assert.rejects(result, /another submission/);
  assert.equal(calls.length, 1);
});

test('Chrome does not request publication after a failed or mismatched upload', async () => {
  for (const upload of [{ uploadState: 'FAILED' }, { uploadState: 'SUCCEEDED', crxVersion: '0.1.14' }]) {
    const { result, calls } = await fixture([{}, upload]);
    await assert.rejects(result, /could not confirm the upload/);
    assert.equal(calls.length, 2);
  }
});
