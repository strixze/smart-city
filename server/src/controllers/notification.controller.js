import { Notification } from "../models/notifications.model.js";
import { PushSubscription } from "../models/pushSubscription.model.js";
import { getVapidPublicKey as getServiceVapidPublicKey, vapidPublicKey } from "../services/webpush.service.js";
import { ApiResponse } from "../utils/apiUtils.js";
import { asyncHandler } from "../utils/asyncHandler.js";

/**
 * GET /notifications
 * Get current user's notifications (paginated)
 */
export const getMyNotifications = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 30));
  const skip = (page - 1) * limit;

  const notifications = await Notification.find({ recipient: req.user._id })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate("complaint", "complaintNumber title status");

  const unreadCount = await Notification.countDocuments({
    recipient: req.user._id,
    isRead: false
  });

  const total = await Notification.countDocuments({ recipient: req.user._id });

  res.status(200).json(
    new ApiResponse(
      200,
      {
        notifications,
        unreadCount,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) }
      },
      "Notifications fetched successfully."
    )
  );
});

/**
 * GET /notifications/unread-count
 * Get only the unread notification count (lightweight)
 */
export const getUnreadCount = asyncHandler(async (req, res) => {
  const unreadCount = await Notification.countDocuments({
    recipient: req.user._id,
    isRead: false
  });

  res.status(200).json(
    new ApiResponse(200, { unreadCount }, "Unread count fetched.")
  );
});

/**
 * PATCH /notifications/:id/read
 * Mark a single notification as read
 */
export const markAsRead = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const notification = await Notification.findOneAndUpdate(
    { _id: id, recipient: req.user._id },
    { isRead: true, readAt: new Date() },
    { new: true }
  );

  res.status(200).json(
    new ApiResponse(200, { notification }, "Notification marked as read.")
  );
});

/**
 * PATCH /notifications/read-all
 * Mark all current user's notifications as read
 */
export const markAllAsRead = asyncHandler(async (req, res) => {
  await Notification.updateMany(
    { recipient: req.user._id, isRead: false },
    { isRead: true, readAt: new Date() }
  );

  res.status(200).json(
    new ApiResponse(200, {}, "All notifications marked as read.")
  );
});

/**
 * GET /notifications/vapid-public-key
 * Return the VAPID public key for frontend push subscription
 */
export const getVapidPublicKey = asyncHandler(async (req, res) => {
  const key = getServiceVapidPublicKey() || vapidPublicKey || "";
  res.status(200).json(
    new ApiResponse(200, { vapidPublicKey: key }, "VAPID public key.")
  );
});

/**
 * POST /notifications/push/subscribe
 * Subscribe a device for push notifications
 */
export const pushSubscribe = asyncHandler(async (req, res) => {
  const { subscription, deviceName } = req.body;

  if (
    !subscription ||
    !subscription.endpoint ||
    !subscription.keys ||
    !subscription.keys.p256dh ||
    !subscription.keys.auth
  ) {
    console.warn("[PushSubscribe] Validation failed: missing endpoint or required keys (p256dh, auth)");
    return res.status(400).json(
      new ApiResponse(400, null, "Invalid push subscription data: endpoint and cryptographic keys (p256dh, auth) are required.")
    );
  }

  try {
    // Upsert: if endpoint already exists, update it (same device re-subscribing)
    const pushSub = await PushSubscription.findOneAndUpdate(
      { endpoint: subscription.endpoint },
      {
        user: req.user._id,
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth
        },
        deviceName: deviceName || "Unknown Device",
        userAgent: req.headers["user-agent"] || "",
        lastUsedAt: new Date()
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    console.log(
      `[PushSubscribe] Subscription saved in MongoDB (id: ${pushSub._id}, user: ${req.user._id}, device: "${pushSub.deviceName}")`
    );

    res.status(201).json(
      new ApiResponse(201, { subscription: pushSub }, "Push subscription registered.")
    );
  } catch (dbError) {
    console.error("[PushSubscribe] MongoDB persistence error:", dbError.message);
    res.status(500).json({
      success: false,
      statusCode: 500,
      isDatabaseError: true,
      message: `Database error saving push subscription: ${dbError.message}`
    });
  }
});

/**
 * DELETE /notifications/push/unsubscribe
 * Remove a push subscription
 */
export const pushUnsubscribe = asyncHandler(async (req, res) => {
  const { endpoint } = req.body;

  if (!endpoint) {
    return res.status(400).json(
      new ApiResponse(400, null, "Endpoint is required.")
    );
  }

  await PushSubscription.deleteOne({
    endpoint,
    user: req.user._id
  });

  res.status(200).json(
    new ApiResponse(200, {}, "Push subscription removed.")
  );
});
