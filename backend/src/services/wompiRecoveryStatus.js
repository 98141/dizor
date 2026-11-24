const Task = require("../models/wompiRecoveryTask");
const PaymentEvent = require("../models/paymentEvent");

exports.publicWebhookUrl = value => {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash
        || !url.pathname.endsWith("/api/webhooks/wompi")
        || !host.includes(".") || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")
        || /^(127\.|0\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host)
        || host.includes(":")) return null;
    return url.href;
  } catch { return null; }
};

exports.configuration = (env = process.env) => ({
  environment: env.WOMPI_ENV === "production" ? "prod" : "test",
  credentialsConfigured: Boolean(env.WOMPI_PRIVATE_KEY && env.WOMPI_EVENTS_SECRET),
  recoveryEnabled: env.WOMPI_RECOVERY_ENABLED !== "false",
  webhookUrl: exports.publicWebhookUrl(env.WOMPI_WEBHOOK_URL),
  webhookPath: "/api/webhooks/wompi",
  // A URL in .env proves neither provider configuration nor delivery. A real
  // Sandbox/prod event must still be observed and verified before sign-off.
  deliveryVerification: "requires_provider_test",
});

exports.inspect = async () => {
  const configuration = exports.configuration();
  const environment = configuration.environment;
  const [counts, recent, lastWebhook] = await Promise.all([
    Task.aggregate([{ $match: { environment } }, { $group: { _id: "$status", count: { $sum: 1 } } }]),
    Task.find({ environment, status: "review" }).sort({ updatedAt: 1 }).limit(20)
      .select("kind order event attempts lastCode lastAttemptAt createdAt updatedAt").lean(),
    PaymentEvent.findOne({ environment, source: "webhook", checksum: { $exists: true, $ne: "" } })
      .sort({ createdAt: -1 }).select("createdAt").lean(),
  ]);
  return { configuration, tasks: { queued: 0, running: 0, waiting: 0, complete: 0, review: 0, rejected: 0,
    ...Object.fromEntries(counts.map(row => [row._id, row.count])) },
    reviewItems: recent, lastStoredWebhookAt: lastWebhook?.createdAt || null };
};
