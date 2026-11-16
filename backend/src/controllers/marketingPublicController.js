const catchAsync = require("../utils/catchAsync");
const {
  getPublicConfig,
  subscribeNewsletter,
  trackAbandonedCart,
  unsubscribeByToken,
} = require("../services/marketingService");

exports.getMarketingConfig = catchAsync(async (req, res) => {
  const config = await getPublicConfig();
  res.status(200).json({ status: "success", config });
});

exports.subscribe = catchAsync(async (req, res) => {
  const { email, name, source, marketingConsent } = req.body;
  const { subscriber, alreadySubscribed } = await subscribeNewsletter({
    email,
    name,
    source,
    marketingConsent,
  });

  res.status(alreadySubscribed ? 200 : 201).json({
    status: "success",
    message: alreadySubscribed
      ? "Ya estabas suscrito a nuestro newsletter"
      : "Suscripción exitosa",
    subscriber: {
      email: subscriber.email,
      name: subscriber.name,
    },
  });
});

exports.saveAbandonedCart = catchAsync(async (req, res) => {
  const { email, name, items, marketingConsent } = req.body;
  await trackAbandonedCart({
    email,
    name,
    items,
    userId: req.user?.id,
    marketingConsent,
  });

  // No se devuelve el correo: el cliente ya lo conoce (minimización).
  res.status(200).json({
    status: "success",
    message: "Carrito guardado para recordatorio",
  });
});

// Baja pública e idempotente (H-04, H-05). POST para que los escáneres de
// enlaces de los clientes de correo no den de baja por accidente.
exports.unsubscribe = catchAsync(async (req, res) => {
  const { purpose } = await unsubscribeByToken(req.body?.token);
  res.status(200).json({
    status: "success",
    message: "Tu baja quedó registrada. No recibirás más correos de este tipo.",
    purpose,
  });
});
