import { createHmac, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { basename, extname } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { pathToFileURL } from "node:url";

const AMO_API = "https://addons.mozilla.org/api/v5/";
const UPLOADS = "addons/upload/";
const REQUEST_TIMEOUT_MS = 30_000;
const VALIDATION_TIMEOUT_MS = 120_000;
const VALIDATION_ATTEMPTS = 30;
const VALIDATION_INTERVAL_MS = 2_000;
const VERSION_PATTERN = /^(0|[1-9][0-9]*)(\.(0|[1-9][0-9]*)){2}$/;
const UUID_PATTERN = /^(?:[a-f0-9]{32}|[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12})$/i;
const USAGE = "Usage: node scripts/publish-firefox.mjs ARCHIVE VERSION GECKO_ID";

/** Sign a short-lived AMO JWT with a unique nonce per request. */
function signJwt(issuer, secret) {
  const iat = Math.floor(Date.now() / 1000);
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const claims = { iss: issuer, iat, exp: iat + 60, jti: randomUUID() };
  const unsigned = encode({ alg: "HS256", typ: "JWT" }) + "." + encode(claims);
  return unsigned + "." + createHmac("sha256", secret).update(unsigned).digest("base64url");
}

/** Report only controlled diagnostics. Raw AMO responses and fetch errors may echo request data. */
class AmoError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

function makeAmoRequest(fetchImpl, issuer, secret) {
  return async (operation, path, { method = "GET", body, signal, allowNotFound = false } = {}) => {
    const headers = { Accept: "application/json", Authorization: "JWT " + signJwt(issuer, secret) };
    if (typeof body === "string") headers["Content-Type"] = "application/json";
    const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
    let response;
    try {
      response = await fetchImpl(AMO_API + path, {
        method, headers, body, redirect: "error",
        signal: signal ? AbortSignal.any([signal, timeout]) : timeout
      });
    } catch {
      throw new AmoError(operation + " failed before an HTTP response was received.");
    }
    if (allowNotFound && response.status === 404) return null;
    if (!response.ok) throw new AmoError(operation + " failed (HTTP " + response.status + ").", response.status);
    try {
      const data = await response.json();
      if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error();
      return data;
    } catch {
      throw new AmoError(operation + " returned an invalid JSON response.");
    }
  };
}

function normalizeUploadUuid(uuid) {
  if (typeof uuid !== "string" || !UUID_PATTERN.test(uuid)) {
    throw new AmoError("Expected a valid AMO upload UUID.");
  }
  return uuid.replaceAll("-", "").toLowerCase();
}

async function uploadArchive(request, archive) {
  const mimeType = extname(archive).toLowerCase() === ".xpi" ? "application/x-xpinstall" : "application/zip";
  let contents;
  try {
    contents = await readFile(archive);
  } catch {
    throw new AmoError("Could not read the Firefox archive.");
  }
  if (!contents.length) throw new AmoError("The Firefox archive is empty.");
  const body = new FormData();
  body.set("channel", "listed");
  body.set("upload", new Blob([contents], { type: mimeType }), basename(archive));
  const upload = await request("AMO archive upload", UPLOADS, { method: "POST", body });
  return normalizeUploadUuid(upload.uuid);
}

async function waitForValidation(request, uuid, version, attempts, intervalMs) {
  const signal = AbortSignal.timeout(VALIDATION_TIMEOUT_MS);
  const timedOut = () => new AmoError("AMO validation did not finish within the polling limit.");
  for (let attempt = 0; attempt < attempts; attempt++) {
    let upload;
    try {
      if (attempt > 0 && intervalMs > 0) await delay(intervalMs, undefined, { signal });
      upload = await request("AMO validation lookup", UPLOADS + uuid + "/", { signal });
    } catch (error) {
      if (signal.aborted) throw timedOut();
      throw error;
    }
    if (upload.channel !== "listed") throw new AmoError("AMO upload is not in the listed channel.");
    if (upload.processed === false) continue;
    if (upload.processed !== true || typeof upload.valid !== "boolean") {
      throw new AmoError("AMO returned an invalid validation status.");
    }
    if (!upload.valid) throw new AmoError("AMO rejected archive validation. See the AMO developer hub for details.");
    if (upload.version !== version) throw new AmoError("The uploaded manifest version does not match VERSION.");
    if (typeof upload.submitted !== "boolean") throw new AmoError("AMO returned an invalid submission status.");
    return upload;
  }
  throw timedOut();
}

/** Submit an existing add-on's listed version, or report that AMO already has it. */
export async function publishFirefox({
  archive, version, geckoId, issuer, secret, uploadUuid,
  fetchImpl = globalThis.fetch, onUpload = () => {},
  pollAttempts = VALIDATION_ATTEMPTS, pollIntervalMs = VALIDATION_INTERVAL_MS
}) {
  if (typeof archive !== "string" || !/\.(zip|xpi)$/i.test(archive)) {
    throw new AmoError("ARCHIVE must be a Firefox .zip or .xpi package.");
  }
  if (typeof version !== "string" || !VERSION_PATTERN.test(version)) {
    throw new AmoError("VERSION must be the major.minor.patch version in the Firefox manifest.");
  }
  if (typeof geckoId !== "string" || !/^(?:[a-z0-9._-]*@[a-z0-9._-]+|\{[a-f0-9-]+\})$/i.test(geckoId)) {
    throw new AmoError("GECKO_ID must be the Gecko ID in the Firefox manifest (for Bibilili, @bibilili).");
  }
  if (typeof issuer !== "string" || !issuer.trim() || typeof secret !== "string" || !secret.trim()) {
    throw new AmoError("Set AMO_JWT_ISSUER and AMO_JWT_SECRET in the environment.");
  }
  if (!Number.isInteger(pollAttempts) || pollAttempts < 1 || pollAttempts > VALIDATION_ATTEMPTS ||
      !Number.isInteger(pollIntervalMs) || pollIntervalMs < 0 || pollIntervalMs > VALIDATION_TIMEOUT_MS) {
    throw new AmoError("Invalid AMO validation polling settings.");
  }
  if (uploadUuid !== undefined) uploadUuid = normalizeUploadUuid(uploadUuid);

  const request = makeAmoRequest(fetchImpl, issuer, secret);
  const versionsPath = "addons/addon/" + encodeURIComponent(geckoId) + "/versions/";
  const lookupVersion = async () => {
    const existing = await request("AMO version lookup", versionsPath + version + "/", { allowNotFound: true });
    if (!existing) return false;
    if (existing.version !== version) throw new AmoError("AMO version lookup returned an unexpected version.");
    if (existing.channel !== "listed") throw new AmoError("This version already exists in AMO outside the listed channel.");
    return true;
  };
  const alreadyExists = { status: "already-exists", version };
  if (await lookupVersion()) return alreadyExists;

  const uuid = uploadUuid ?? await uploadArchive(request, archive);
  onUpload(uuid);
  const upload = await waitForValidation(request, uuid, version, pollAttempts, pollIntervalMs);
  if (upload.submitted) {
    if (await lookupVersion()) return alreadyExists;
    throw new AmoError("This upload has already been used, but the requested listed version was not found.");
  }

  try {
    const created = await request("AMO listed version creation", versionsPath, {
      method: "POST", body: JSON.stringify({ upload: uuid })
    });
    if (created.version !== version || created.channel !== "listed") {
      throw new AmoError("AMO version creation returned an unexpected version or channel.");
    }
  } catch (error) {
    // Creation may have committed even if the response was lost, or a concurrent run may have won.
    if (error.status === undefined || error.status === 400 || error.status === 409 || error.status >= 500) {
      if (await lookupVersion()) return alreadyExists;
    }
    if (error.status === 400) {
      throw new AmoError(error.message + " Check the existing listing metadata and version license in the AMO developer hub.");
    }
    if (error.status === 404) throw new AmoError("AMO add-on not found. Create its listing in the developer hub before submitting a version.");
    throw error;
  }
  return { status: "submitted", version };
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length !== 3) throw new AmoError(USAGE);
  const [archive, version, geckoId] = args;
  const result = await publishFirefox({
    archive, version, geckoId,
    issuer: process.env.AMO_JWT_ISSUER,
    secret: process.env.AMO_JWT_SECRET,
    uploadUuid: process.env.AMO_UPLOAD_UUID,
    onUpload(uuid) {
      console.error("AMO upload " + uuid + " (set AMO_UPLOAD_UUID to resume this archive if needed).");
    }
  });
  console.log(result.status === "submitted"
    ? "Submitted listed Firefox version " + version + " to AMO."
    : "Listed Firefox version " + version + " already exists on AMO. No new version was submitted by this run.");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await main();
  } catch (error) {
    console.error(error instanceof AmoError ? error.message : "Unexpected Firefox submission error.");
    process.exitCode = 1;
  }
}
