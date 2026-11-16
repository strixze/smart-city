import webpush from "web-push";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

// Resolve directory paths so .env is reliably loaded whether running from /server, root, or deployment
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serverEnvPath = path.resolve(__dirname, "../../.env");
const cwdEnvPath = path.resolve(process.cwd(), ".env");

if (fs.existsSync(serverEnvPath)) {
  dotenv.config({ path: serverEnvPath });
} else if (fs.existsSync(cwdEnvPath)) {
  dotenv.config({ path: cwdEnvPath });
} else {
  dotenv.config();
}

/**
 * Normalizes the VAPID subject to a valid URI required by RFC 8292.
 * Prepend 'mailto:' if missing and not already an http/https URL.
 *
 * @param {string} subject
 * @returns {string}
 */
export function normalizeVapidSubject(subject) {
  if (!subject || typeof subject !== "string") {
    return "mailto:smartcity@example.com";
  }
  const trimmed = subject.trim();
  if (
    trimmed.startsWith("mailto:") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("http://")
  ) {
    return trimmed;
  }
  return `mailto:${trimmed}`;
}

export let vapidPublicKey = (process.env.VAPID_PUBLIC_KEY || "").trim();
let isConfigured = false;

/**
 * Returns the current VAPID public key.
 * Always inspects process.env first to ensure latest value is returned.
 *
 * @returns {string}
 */
export function getVapidPublicKey() {
  return (process.env.VAPID_PUBLIC_KEY || vapidPublicKey || "").trim();
}

/**
 * Checks whether VAPID credentials are fully configured and verified.
 *
 * @returns {boolean}
 */
export function isVapidConfigured() {
  return isConfigured && Boolean(getVapidPublicKey());
}

/**
 * Validates environment variables and initializes webpush.setVapidDetails.
 * Logs status safely without ever leaking private keys.
 *
 * @returns {boolean} true if successfully configured, false otherwise.
 */
export function initWebPush() {
  const publicKey = (process.env.VAPID_PUBLIC_KEY || "").trim();
  const privateKey = (process.env.VAPID_PRIVATE_KEY || "").trim();
  const rawSubject = (process.env.VAPID_SUBJECT || "").trim();
  const subject = normalizeVapidSubject(rawSubject);

  vapidPublicKey = publicKey;

  if (publicKey && privateKey) {
    try {
      webpush.setVapidDetails(subject, publicKey, privateKey);
      isConfigured = true;
      console.log(
        `[WebPush] VAPID keys configured successfully (subject: ${subject}, public key length: ${publicKey.length})`
      );
      return true;
    } catch (err) {
      isConfigured = false;
      console.error(
        `[WebPush] Failed to configure VAPID details: ${err.message}`
      );
      return false;
    }
  } else {
    isConfigured = false;
    const missing = [];
    if (!publicKey) missing.push("VAPID_PUBLIC_KEY");
    if (!privateKey) missing.push("VAPID_PRIVATE_KEY");
    if (!rawSubject) missing.push("VAPID_SUBJECT");

    console.warn(
      `[WebPush] VAPID keys not configured — push notifications disabled. Missing: ${missing.join(
        ", "
      )}. Set in .env or deployment environment.`
    );
    return false;
  }
}

// Auto-initialize on module load
initWebPush();

export { webpush };
export default webpush;
