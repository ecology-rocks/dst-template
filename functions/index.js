const { onRequest } = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const Stripe = require("stripe");

// Initialize Firebase Admin to write to Firestore
const admin = require("firebase-admin");
admin.initializeApp();
const db = admin.firestore();

exports.createStripeCheckout = onRequest({ 
  cors: true, 
  secrets: ["STRIPE_SECRET_KEY"] 
}, async (req, res) => {
  const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

  if (req.method !== "POST") {
    res.status(405).send("Method Not Allowed");
    return;
  }

  try {
    const { cart, customerEmail } = req.body;
    if (!cart || cart.length === 0) return res.status(400).send("Cart is empty.");

    const lineItems = cart.map((item) => ({
      price_data: {
        currency: "usd",
        product_data: {
          name: item.designTitle,
          description: `${item.blankName} | Color: ${item.color} | Size: ${item.size}`,
          images: [item.designAssetUrl], 
          metadata: {
            designId: item.designId,
            sku: item.variantSku,
            blankName: item.blankName,
            color: item.color,
            size: item.size
          },
        },
        unit_amount: item.price,
      },
      quantity: item.quantity,
    }));

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: lineItems,
      customer_email: customerEmail,
      mode: "payment",
      success_url: `${req.headers.origin}/checkout-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.headers.origin}/`,
      shipping_address_collection: { allowed_countries: ["US", "CA"] },
    });

    res.json({ url: session.url });
  } catch (error) {
    logger.error("Checkout Error", error);
    res.status(500).send({ error: error.message });
  }
});

exports.stripeWebhook = onRequest({ 
  cors: false, // Webhooks don't need CORS
  secrets: ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"] 
}, async (req, res) => {
  const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
  const sig = req.headers["stripe-signature"];
  let event;

  try {
    // req.rawBody is automatically provided by Firebase v2
    event = stripe.webhooks.constructEvent(req.rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    logger.error("Webhook signature verification failed.", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;

    try {
      const lineItems = await stripe.checkout.sessions.listLineItems(session.id, {
        expand: ["data.price.product"]
      });

      // We will group items by their sellerId
      const ordersBySeller = {};

      for (const item of lineItems.data) {
        const product = item.price.product;
        const designId = product.metadata.designId;
        let sellerId = "platform_admin"; // Fallback if no owner is found

        if (designId) {
          const designDoc = await db.collection("designs").doc(designId).get();
          if (designDoc.exists) {
            sellerId = designDoc.data().ownerId || "platform_admin";
          }
        }

        const itemData = {
          designTitle: product.name,
          designAssetUrl: product.images.length ? product.images[0] : "",
          quantity: item.quantity,
          blankName: product.metadata.blankName || "Unknown Product",
          color: product.metadata.color || "N/A",
          size: product.metadata.size || "N/A",
          sku: product.metadata.sku,
          designId: designId
        };

        // Initialize the array for this seller if it doesn't exist yet
        if (!ordersBySeller[sellerId]) {
          ordersBySeller[sellerId] = [];
        }
        
        ordersBySeller[sellerId].push(itemData);
      }

      // Extract shipping details robustly
      const shipDetails = session.shipping_details || {};
      const shipAddress = shipDetails.address || {};
      const custDetails = session.customer_details || {};
      const custAddress = custDetails.address || {};

      const finalAddress = {
        name: shipDetails.name || custDetails.name || "Customer",
        line1: shipAddress.line1 || custAddress.line1 || "No Address Provided",
        line2: shipAddress.line2 || custAddress.line2 || "",
        city: shipAddress.city || custAddress.city || "",
        state: shipAddress.state || custAddress.state || "",
        postal_code: shipAddress.postal_code || custAddress.postal_code || "",
        country: shipAddress.country || custAddress.country || ""
      };

      // Create a separate order document for EACH seller involved in this checkout
      const orderPromises = Object.keys(ordersBySeller).map(async (seller) => {
        const orderData = {
          stripeSessionId: session.id,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          customerEmail: custDetails.email || session.customer_email || "No email provided",
          shipping: finalAddress,
          items: ordersBySeller[seller],
          status: "received",
          sellerId: seller,
          trackingNumber: "",
          isSplitOrder: Object.keys(ordersBySeller).length > 1 // Handy flag to know if this was part of a larger cart
        };

        return db.collection("orders").add(orderData);
      });

      // Wait for all order documents to be created
      await Promise.all(orderPromises);
      logger.info(`Processed ${Object.keys(ordersBySeller).length} split order(s) for session`, { sessionId: session.id });

    } catch (error) {
      logger.error("Error processing webhook order payload", error);
      return res.status(500).send("Internal Server Error");
    }
  }

  // Acknowledge receipt to Stripe
  res.json({ received: true });
});