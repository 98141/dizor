const catchAsync = require("../utils/catchAsync");
const {
  getPublicConfig,
  subscribeNewsletter,
  trackAbandonedCart,
} = require("../services/marketingService");

exports.getMarketingConfig = catchAsync(async (req, res) => {
  const config = await getPublicConfig();
  res.status(200).json({ status: "success", config });
});

exports.subscribe = catchAsync(async (req, res) => {
  const { email, name, source } = req.body;
  const { subscriber, alreadySubscribed } = await subscribeNewsletter({
    email,
    name,
    source,
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
  const { email, name, items } = req.body;
  const cart = await trackAbandonedCart({
    email,
    name,
    items,
    userId: req.user?.id,
  });

  res.status(200).json({
    status: "success",
    message: "Carrito guardado para recordatorio",
    cart: { id: cart._id, email: cart.email },
  });
});
