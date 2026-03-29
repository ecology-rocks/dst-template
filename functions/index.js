const { onRequest } = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");

// We define the requirement here, but don't initialize yet
const Stripe = require("stripe");

exports.createStripeCheckout = onRequest({ 
    cors: true, 
    secrets: ["STRIPE_SECRET_KEY"] // <--- THIS IS CRITICAL
  }, async (req, res) => {
    
  // Initialize Stripe INSIDE the handler
  const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

  if (req.method !== "POST") {
    res.status(405).send("Method Not Allowed");
    return;
  }

  try {
    const { cart, customerEmail } = req.body;

    if (!cart || cart.length === 0) {
      res.status(400).send("Cart is empty.");
      return;
    }

    const lineItems = cart.map((item) => {
      return {
        price_data: {
          currency: "usd",
          product_data: {
            name: item.designTitle,
            description: `${item.blankName} - ${item.color} (${item.size})`,
            images: [item.thumbnailUrl],
            metadata: {
              designId: item.designId,
              sku: item.variantSku,
            },
          },
          unit_amount: item.price,
        },
        quantity: item.quantity,
      };
    });

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: lineItems,
      customer_email: customerEmail,
      mode: "payment",
      success_url: `${req.headers.origin}/checkout-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.headers.origin}/`,
      shipping_address_collection: {
        allowed_countries: ["US", "CA"],
      },
    });

    logger.info("Checkout session created", { sessionId: session.id });
    res.json({ url: session.url });
  } catch (error) {
    logger.error("Stripe Checkout Error", error);
    res.status(500).send({ error: error.message });
  }
});