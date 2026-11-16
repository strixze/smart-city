import { notificationApi } from "../api/client.js";

/**
 * ============================================================================
 * Custom Push Notification Error Classes
 * Distinguishes Service Worker, PushManager, VAPID, Backend API, and Database errors
 * ============================================================================
 */

export class ServiceWorkerError extends Error {
  constructor(message, details = null) {
    super(`[Service Worker Error] ${message}`);
    this.name = "ServiceWorkerError";
    this.details = details;
  }
}

export class VapidKeyError extends Error {
  constructor(message, details = null) {
    super(`[VAPID Key Error] ${message}`);
    this.name = "VapidKeyError";
    this.details = details;
  }
}

export class PushManagerError extends Error {
  constructor(message, details = null) {
    super(`[PushManager Error] ${message}`);
    this.name = "PushManagerError";
    this.details = details;
  }
}

export class BackendApiError extends Error {
  constructor(message, statusCode = null, details = null) {
    super(`[Backend API Error] ${message}`);
    this.name = "BackendApiError";
    this.statusCode = statusCode;
    this.details = details;
  }
}

export class DatabaseError extends Error {
  constructor(message, details = null) {
    super(`[Database Error] ${message}`);
    this.name = "DatabaseError";
    this.details = details;
  }
}

/**
 * Utility to convert base64 URL VAPID public key to Uint8Array required by PushManager.subscribe().
 * Validates key format, strips whitespace/quotes, and ensures decoded key is a valid uncompressed P-256 EC point.
 *
 * @param {string} base64String
 * @returns {Uint8Array}
 */
export function urlBase64ToUint8Array(base64String) {
  if (!base64String || typeof base64String !== "string") {
    throw new VapidKeyError("VAPID public key must be a non-empty string.");
  }

  // Sanitize: strip whitespace and surrounding quotes
  const cleanKey = base64String.trim().replace(/^["']|["']$/g, "").trim();
  if (!cleanKey) {
    throw new VapidKeyError("VAPID public key is empty after trimming.");
  }

  try {
    // Strip any trailing '=' before calculating required base64 padding
    const base64Url = cleanKey.replace(/=+$/, "");
    const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
    const base64 = (base64Url + padding).replace(/-/g, "+").replace(/_/g, "/");

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }

    // A valid VAPID public key MUST be an uncompressed P-256 EC point:
    // exactly 65 bytes long, beginning with 0x04.
    if (outputArray.length !== 65) {
      throw new VapidKeyError(
        `Invalid VAPID public key length: expected 65 bytes (P-256 point), decoded ${outputArray.length} bytes.`
      );
    }
    if (outputArray[0] !== 4) {
      throw new VapidKeyError(
        `Invalid VAPID public key header: expected uncompressed EC point starting with 0x04, got 0x${outputArray[0].toString(16)}.`
      );
    }

    return outputArray;
  } catch (err) {
    if (err instanceof VapidKeyError) throw err;
    throw new VapidKeyError(`Failed to decode Base64 URL VAPID key: ${err.message}`, err);
  }
}

/**
 * Generate human-readable device name based on User-Agent
 */
export function getFriendlyDeviceName() {
  const ua = navigator.userAgent || "";
  let browser = "Browser";
  let os = "Device";

  if (ua.includes("Firefox/")) browser = "Firefox";
  else if (ua.includes("Edg/")) browser = "Edge";
  else if (ua.includes("Chrome/")) browser = "Chrome";
  else if (ua.includes("Safari/")) browser = "Safari";

  if (ua.includes("Windows")) os = "Windows";
  else if (ua.includes("Android")) os = "Android";
  else if (ua.includes("iPhone") || ua.includes("iPad")) os = "iOS";
  else if (ua.includes("Mac OS")) os = "macOS";
  else if (ua.includes("Linux")) os = "Linux";

  const isStandalone = window.matchMedia("(display-mode: standalone)").matches;
  return `${browser} on ${os}${isStandalone ? " (PWA App)" : ""}`;
}

/**
 * Check if the browser supports Push Notifications and Service Workers
 */
export function isPushSupported() {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/**
 * Get current browser notification permission
 */
export function getNotificationPermission() {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported";
  }
  return Notification.permission;
}

/**
 * Register the Service Worker.
 * Uses navigator.serviceWorker.ready to guarantee active/controlling registration.
 */
export async function registerServiceWorker() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    throw new ServiceWorkerError("Service Worker is not supported by this browser.");
  }

  try {
    console.log("[PushService] Registering Service Worker at /sw.js...");
    await navigator.serviceWorker.register("/sw.js", { scope: "/" });

    // Always resolve with the READY (active) registration
    const registration = await navigator.serviceWorker.ready;

    // Ensure worker has reached 'activated' state before proceeding
    if (registration.installing || registration.waiting) {
      const pendingWorker = registration.installing || registration.waiting;
      if (pendingWorker && pendingWorker.state !== "activated") {
        console.log("[PushService] Waiting for Service Worker to activate...");
        await new Promise((resolve) => {
          const timeout = setTimeout(resolve, 1500);
          pendingWorker.addEventListener("statechange", () => {
            if (pendingWorker.state === "activated") {
              clearTimeout(timeout);
              resolve();
            }
          });
        });
      }
    }

    console.log("[PushService] Service Worker ready, scope:", registration.scope);
    return registration;
  } catch (error) {
    if (error instanceof ServiceWorkerError) throw error;
    console.error("[PushService] Service Worker registration failed:", error);
    throw new ServiceWorkerError(`Failed to register Service Worker: ${error.message}`, error);
  }
}

/**
 * Check if there is currently an active push subscription.
 */
export async function getActiveSubscription() {
  if (!isPushSupported()) return null;
  try {
    const registration = await navigator.serviceWorker.ready;
    return await registration.pushManager.getSubscription();
  } catch (err) {
    console.warn("[PushService] Failed to check active subscription:", err);
    return null;
  }
}

/**
 * Subscribe user to Web Push.
 *
 * Sequence:
 *   1. Check permission
 *   2. Register & await active Service Worker
 *   3. Obtain & validate VAPID public key
 *   4. Check existing subscription (clearing mismatched keys)
 *   5. Call PushManager.subscribe() with recovery retry
 *   6. Send subscription payload to backend MongoDB storage
 */
export async function subscribeToPushNotifications(customDeviceName = null) {
  if (!isPushSupported()) {
    throw new PushManagerError("Push notifications and PushManager are not supported by this browser.");
  }

  // 1. Request permission FIRST (must be done from user gesture)
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new PushManagerError(
      permission === "denied"
        ? "Push notifications were blocked by browser site permissions. Please allow notifications in site settings."
        : "Push notification permission was not granted."
    );
  }

  // 2. Register SW and wait for active registration
  const registration = await registerServiceWorker();

  // 3. Obtain VAPID public key (frontend env var preferred; fallback to backend API)
  let vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY || import.meta.env.VAPID_PUBLIC_KEY;
  if (!vapidPublicKey) {
    try {
      const res = await notificationApi.getVapidPublicKey();
      vapidPublicKey = res.data?.data?.vapidPublicKey;
    } catch (err) {
      console.error("[PushService] Failed to fetch VAPID public key from backend:", err);
      throw new BackendApiError(
        `Failed to fetch VAPID public key from backend (${err.response?.status || err.message}).`,
        err.response?.status,
        err
      );
    }
  }

  if (!vapidPublicKey) {
    console.error(
      "[PushService] VAPID public key missing. Ensure VITE_VAPID_PUBLIC_KEY is configured in frontend environment or VAPID_PUBLIC_KEY is configured on the backend."
    );
    throw new VapidKeyError("VAPID public key not configured on server or client.");
  }

  // Convert & validate Base64 URL VAPID key into Uint8Array
  const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);

  // 4. Inspect existing subscription: check for key mismatch or stale subscription
  let subscription = await registration.pushManager.getSubscription();
  if (subscription) {
    const existingKeyBuffer = subscription.options?.applicationServerKey;
    let keyMatches = false;

    if (existingKeyBuffer) {
      const existingKeyArray = new Uint8Array(existingKeyBuffer);
      if (existingKeyArray.length === applicationServerKey.length) {
        keyMatches = existingKeyArray.every((byte, idx) => byte === applicationServerKey[idx]);
      }
    }

    if (!keyMatches) {
      console.warn(
        "[PushService] Existing subscription uses an outdated or mismatched VAPID key. Unsubscribing old subscription..."
      );
      try {
        await subscription.unsubscribe();
        if (subscription.endpoint) {
          await notificationApi.pushUnsubscribe(subscription.endpoint).catch(() => {});
        }
      } catch (unsubErr) {
        console.warn("[PushService] Failed to clean up outdated subscription:", unsubErr);
      }
      subscription = null;
    } else {
      console.log("[PushService] Existing subscription key matches current VAPID key.");
    }
  }

  // 5. Create fresh subscription if not existing
  if (!subscription) {
    console.log("[PushService] Creating fresh push subscription with PushManager...");
    try {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey
      });
      console.log("[PushService] New push subscription created:", subscription.endpoint.slice(0, 60) + "...");
    } catch (subErr) {
      console.warn("[PushService] First subscription attempt failed:", subErr.name, subErr.message);

      // Attempt recovery: unsubscribe any ghost subscription in browser and retry once
      try {
        const staleSub = await registration.pushManager.getSubscription();
        if (staleSub) {
          console.log("[PushService] Unsubscribing stale ghost subscription before retry...");
          await staleSub.unsubscribe();
        }
        await new Promise((resolve) => setTimeout(resolve, 250));

        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey
        });
        console.log("[PushService] Retry subscription succeeded:", subscription.endpoint.slice(0, 60) + "...");
      } catch (retryErr) {
        console.error("[PushService] PushManager subscription failed on retry:", retryErr);

        const isBrave =
          (typeof navigator !== "undefined" && navigator.brave && typeof navigator.brave.isBrave === "function") ||
          (navigator.userAgent && navigator.userAgent.includes("Brave"));

        if (retryErr.message && retryErr.message.includes("push service error")) {
          if (isBrave) {
            throw new PushManagerError(
              "Push service error: Brave disables Google Push Services by default. Enable 'Use Google services for push messaging' in brave://settings/privacy, then reload.",
              retryErr
            );
          }
          throw new PushManagerError(
            `Push service error: Browser push service (FCM) unreachable (${retryErr.message}). Check internet connectivity or firewall rules for fcm.googleapis.com.`,
            retryErr
          );
        }

        throw new PushManagerError(
          `PushManager subscription failed (${retryErr.name}: ${retryErr.message}).`,
          retryErr
        );
      }
    }
  }

  // 6. Send subscription details to backend for MongoDB storage
  const deviceName = customDeviceName || getFriendlyDeviceName();
  const subData = typeof subscription.toJSON === "function" ? subscription.toJSON() : subscription;

  try {
    await notificationApi.pushSubscribe(subData, deviceName);
    console.log("[PushService] Push subscription saved to backend MongoDB for device:", deviceName);
  } catch (apiErr) {
    console.error("[PushService] Backend subscription registration failed:", apiErr);
    const status = apiErr.response?.status;
    const msg = apiErr.response?.data?.message || apiErr.message;

    if (status === 401) {
      throw new BackendApiError("Session expired or authentication token required. Please log in again.", 401, apiErr);
    } else if (status === 400) {
      throw new BackendApiError(`Invalid subscription data submitted: ${msg}`, 400, apiErr);
    } else if (
      apiErr.response?.data?.isDatabaseError ||
      (msg && (msg.toLowerCase().includes("mongodb") || msg.toLowerCase().includes("database")))
    ) {
      throw new DatabaseError(`Database failed to store push subscription: ${msg}`, apiErr);
    } else {
      throw new BackendApiError(
        `Server failed to register subscription (${status || "Network Error"}): ${msg}`,
        status,
        apiErr
      );
    }
  }

  return subscription;
}

/**
 * Unsubscribe current browser/device from Web Push
 */
export async function unsubscribeFromPushNotifications() {
  if (!isPushSupported()) return false;

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    if (subscription) {
      const endpoint = subscription.endpoint;

      // Unsubscribe locally in browser first
      await subscription.unsubscribe();
      console.log("[PushService] Browser unsubscribed from push");

      // Then tell backend to remove from DB
      try {
        await notificationApi.pushUnsubscribe(endpoint);
        console.log("[PushService] Backend subscription removed");
      } catch (err) {
        console.warn("[PushService] Backend push unsubscribe failed:", err);
      }
      return true;
    }
    return false;
  } catch (error) {
    console.error("[PushService] Failed to unsubscribe from push:", error);
    throw error;
  }
}

/**
 * Early SW registration — call this on app startup so the SW is
 * active before the user ever touches push settings.
 */
export async function earlyRegisterServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  try {
    await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    navigator.serviceWorker.ready.then((reg) => {
      console.log("[PushService] SW active and controlling, scope:", reg.scope);
    });
  } catch (err) {
    console.warn("[PushService] Early SW registration failed:", err.message);
  }
}
