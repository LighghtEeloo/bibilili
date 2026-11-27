const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const { createHmac } = require("node:crypto");
const { mkdtemp, rm, writeFile } = require("node:fs/promises");
const { tmpdir } = require("node:os");
const { join, resolve } = require("node:path");
const test = require("node:test");

const script = import("../scripts/publish-firefox.mjs");
const api = "https://addons.mozilla.org/api/v5/";
const version = "0.1.99";
const geckoId = "@bibilili";
const versions = "addons/addon/%40bibilili/versions/";
const uploads = "addons/upload/";
const uuid = "37cddd881f2b4615b0bbda16bbce8031";
const issuer = "test-amo-issuer";
const secret = "test-amo-secret";
const listed = { version, channel: "listed" };
const validated = { ...listed, uuid, processed: true, valid: true, submitted: false };
const archiveBytes = Buffer.from([0x50, 0x4b, 0x03, 0x04]);

async function makeArchive(t) {
  const directory = await mkdtemp(join(tmpdir(), "bibilili-amo-test-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const archive = join(directory, "bibilili-firefox-" + version + ".zip");
  await writeFile(archive, archiveBytes);
  return archive;
}

/** Supply responses in order, checking the method and endpoint for every API call. */
function mockAmo(t, ...responses) {
  const calls = [];
  t.after(() => assert.equal(calls.length, responses.length, "API call count"));
  const fetchImpl = async (url, options) => {
    const current = responses[calls.length];
    calls.push({ url, ...options });
    // Verify outside fetch so a failed assertion cannot be mistaken for a transport error.
    if (current?.[2] instanceof Error) throw current[2];
    return Response.json(current?.[3] ?? {}, { status: current?.[2] ?? 500 });
  };
  t.after(() => assert.deepEqual(
    calls.map(({ url, method }) => [method, url]),
    responses.map(([method, path]) => [method, api + path])
  ));
  return { calls, fetchImpl };
}

async function publish(fetchImpl, overrides = {}) {
  const { publishFirefox } = await script;
  return publishFirefox({
    archive: "unused.zip", version, geckoId, issuer, secret, pollIntervalMs: 0, fetchImpl,
    ...overrides
  });
}

const missingVersion = ["GET", versions + version + "/", 404];
const existingVersion = ["GET", versions + version + "/", 200, listed];
const uploaded = ["POST", uploads, 201, { uuid }];
const validationPath = uploads + uuid + "/";
const pending = ["GET", validationPath, 200, { ...listed, processed: false, valid: false }];
const valid = ["GET", validationPath, 200, validated];

test("uploads the existing ZIP as listed, polls it, and creates a version using the UUID", async (t) => {
  const archive = await makeArchive(t);
  const { fetchImpl, calls } = mockAmo(t, missingVersion, uploaded, pending, valid,
    ["POST", versions, 201, listed]);
  const uploadIds = [];
  assert.deepEqual(await publish(fetchImpl, { archive, onUpload: (id) => uploadIds.push(id) }),
    { status: "submitted", version });
  assert.deepEqual(uploadIds, [uuid]);

  const form = calls[1].body;
  assert.ok(form instanceof FormData);
  assert.deepEqual([...form.keys()].sort(), ["channel", "upload"]);
  assert.equal(form.get("channel"), "listed");
  assert.equal(form.get("upload").name, "bibilili-firefox-" + version + ".zip");
  assert.equal(form.get("upload").type, "application/zip");
  assert.deepEqual(Buffer.from(await form.get("upload").arrayBuffer()), archiveBytes);
  assert.equal(calls[1].headers["Content-Type"], undefined);
  assert.equal(calls[4].headers["Content-Type"], "application/json");
  assert.deepEqual(JSON.parse(calls[4].body), { upload: uuid });

  const nonces = new Set();
  for (const { headers, redirect, signal } of calls) {
    assert.equal(redirect, "error");
    assert.ok(signal instanceof AbortSignal);
    assert.match(headers.Authorization, /^JWT /);
    const [header, payload, signature] = headers.Authorization.slice(4).split(".");
    const decode = (value) => JSON.parse(Buffer.from(value, "base64url"));
    assert.deepEqual(decode(header), { alg: "HS256", typ: "JWT" });
    const claims = decode(payload);
    assert.equal(claims.iss, issuer);
    assert.ok(Number.isInteger(claims.iat));
    assert.ok(Math.abs(claims.iat - Math.floor(Date.now() / 1000)) < 10);
    assert.ok(claims.exp > claims.iat && claims.exp - claims.iat <= 300);
    nonces.add(claims.jti);
    assert.equal(signature, createHmac("sha256", secret).update(header + "." + payload).digest("base64url"));
  }
  assert.equal(nonces.size, calls.length);
});

test("treats an existing listed version as a successful no-op", async (t) => {
  const { fetchImpl } = mockAmo(t, existingVersion);
  assert.deepEqual(await publish(fetchImpl), { status: "already-exists", version });
});

test("fails when the version exists in another channel", async (t) => {
  const { fetchImpl } = mockAmo(t, ["GET", versions + version + "/", 200, { ...listed, channel: "unlisted" }]);
  await assert.rejects(publish(fetchImpl), /outside the listed channel/);
});

test("resumes a prior upload without resending the archive", async (t) => {
  const { fetchImpl } = mockAmo(t, missingVersion, valid, ["POST", versions, 201, listed]);
  assert.deepEqual(await publish(fetchImpl, { uploadUuid: "37cddd88-1f2b-4615-b0bb-da16bbce8031" }),
    { status: "submitted", version });
});

test("reports an existing version after ambiguous creation", async (t) => {
  for (const status of [400, 409, 503, new Error("response connection closed")]) {
    await t.test(String(status), async (t) => {
      const { fetchImpl, calls } = mockAmo(t, missingVersion, valid, ["POST", versions, status], existingVersion);
      assert.deepEqual(await publish(fetchImpl, { uploadUuid: uuid }), { status: "already-exists", version });
      assert.equal(calls.filter(({ method }) => method === "POST").length, 1);
    });
  }
});

test("rechecks the target before accepting an already-consumed upload", async (t) => {
  const consumed = ["GET", validationPath, 200, { ...validated, submitted: true }];
  await t.test("matching version", async (t) => {
    const { fetchImpl } = mockAmo(t, missingVersion, consumed, existingVersion);
    assert.deepEqual(await publish(fetchImpl, { uploadUuid: uuid }), { status: "already-exists", version });
  });
  await t.test("missing version", async (t) => {
    const { fetchImpl } = mockAmo(t, missingVersion, consumed, missingVersion);
    await assert.rejects(publish(fetchImpl, { uploadUuid: uuid }), /already been used.*was not found/);
  });
});

test("does not create a version for rejected, mismatched, or still pending uploads", async (t) => {
  const cases = [
    ["validation rejection", { ...validated, valid: false, version: null }, /rejected archive validation/],
    ["manifest version mismatch", { ...validated, version: "0.1.98" }, /does not match VERSION/],
    ["channel mismatch", { ...validated, channel: "unlisted" }, /not in the listed channel/]
  ];
  for (const [name, upload, message] of cases) {
    await t.test(name, async (t) => {
      const { fetchImpl } = mockAmo(t, missingVersion, ["GET", validationPath, 200, upload]);
      await assert.rejects(publish(fetchImpl, { uploadUuid: uuid }), message);
    });
  }
  await t.test("exhausted polling", async (t) => {
    const { fetchImpl } = mockAmo(t, missingVersion, pending, pending);
    await assert.rejects(publish(fetchImpl, { uploadUuid: uuid, pollAttempts: 2 }), /within the polling limit/);
  });
});

test("reports HTTP status without exposing raw API responses or transport errors", async (t) => {
  const echoedToken = "echoed-authorization-token";
  for (const [status, pattern] of [[400, /creation failed \(HTTP 400\)/],
    [new Error([issuer, secret, echoedToken].join(" ")), /before an HTTP response/]]) {
    await t.test(typeof status === "number" ? "HTTP error" : "transport error", async (t) => {
      const { fetchImpl } = mockAmo(t, missingVersion, valid, ["POST", versions, status,
        { detail: [issuer, secret, echoedToken].join(" ") }], missingVersion);
      await assert.rejects(publish(fetchImpl, { uploadUuid: uuid }), (error) => {
        assert.match(error.message, pattern);
        for (const value of [issuer, secret, echoedToken]) assert.ok(!error.message.includes(value));
        assert.equal(error.cause, undefined);
        return true;
      });
    });
  }
});

test("CLI documents its arguments and requires credentials before networking", () => {
  const path = resolve(__dirname, "../scripts/publish-firefox.mjs");
  const env = { ...process.env };
  delete env.AMO_JWT_ISSUER;
  delete env.AMO_JWT_SECRET;
  const invoke = (...args) => spawnSync(process.execPath, [path, ...args], { env, encoding: "utf8" });
  const usage = invoke();
  assert.equal(usage.status, 1);
  assert.match(usage.stderr, /ARCHIVE VERSION GECKO_ID/);
  const missing = invoke("unused.zip", version, geckoId);
  assert.equal(missing.status, 1);
  assert.match(missing.stderr, /Set AMO_JWT_ISSUER and AMO_JWT_SECRET/);
  assert.equal(missing.stdout, "");
});
