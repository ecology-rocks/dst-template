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

    const lineItems = cart.map((item) => {
      const textFields = Array.isArray(item.customization?.textFields) ? item.customization.textFields : [];
      const customizationSummaryParts = textFields
        .filter((field) => field?.label && field?.text)
        .map((field) => `${field.label}: ${field.text}`);

      if (item.customization?.notes) {
        customizationSummaryParts.push(`Notes: ${item.customization.notes}`);
      }

      const baseDescription = `${item.blankName} | Color: ${item.color} | Size: ${item.size}`;
      const customizationDescription = customizationSummaryParts.length
        ? ` | Custom: ${customizationSummaryParts.join(' / ')}`
        : "";
      const finalDescription = `${baseDescription}${customizationDescription}`.slice(0, 499);

      const customization = {
        customText1Label: textFields[0]?.label || "",
        customText1Value: textFields[0]?.text || "",
        customText1Font: textFields[0]?.fontStyle || "",
        customText2Label: textFields[1]?.label || "",
        customText2Value: textFields[1]?.text || "",
        customText2Font: textFields[1]?.fontStyle || "",
        customText3Label: textFields[2]?.label || "",
        customText3Value: textFields[2]?.text || "",
        customText3Font: textFields[2]?.fontStyle || "",
        customNotes: item.customization?.notes || "",
      };

      return {
      price_data: {
        currency: "usd",
        product_data: {
          name: item.designTitle,
          description: finalDescription,
          images: [item.designAssetUrl], 
          metadata: {
            designId: item.designId,
            sku: item.variantSku,
            blankName: item.blankName,
            color: item.color,
            size: item.size,
            ...customization,
          },
        },
        unit_amount: item.price,
      },
      quantity: item.quantity,
    }});

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
          designId: designId,
          customization: {
            textFields: [1, 2, 3]
              .map((index) => ({
                label: product.metadata[`customText${index}Label`] || "",
                text: product.metadata[`customText${index}Value`] || "",
                fontStyle: product.metadata[`customText${index}Font`] || "",
              }))
              .filter((field) => field.label && field.text),
            notes: product.metadata.customNotes || "",
          },
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

exports.lookupOrders = onRequest({
  cors: true,
}, async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).send("Method Not Allowed");
    return;
  }

  try {
    const email = (req.body?.email || "").trim().toLowerCase();
    const orderRef = (req.body?.orderRef || "").trim();

    if (!email) {
      res.status(400).json({ error: "Email is required." });
      return;
    }

    const emailQuery = await db
      .collection("orders")
      .where("customerEmail", "==", email)
      .get();

    const normalizedRef = orderRef.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();

    const matchingDocs = emailQuery.docs.filter((orderDoc) => {
      if (!normalizedRef) return true;
      const normalizedId = orderDoc.id.toLowerCase();
      return normalizedId === normalizedRef || normalizedId.endsWith(normalizedRef);
    });

    const orders = matchingDocs.map((orderDoc) => {
      const data = orderDoc.data() || {};
      return {
        id: orderDoc.id,
        shortId: orderDoc.id.slice(-6).toUpperCase(),
        createdAt: data.createdAt || null,
        status: data.status || "received",
        trackingNumber: data.trackingNumber || "",
        customerEmail: data.customerEmail || "",
        shipping: data.shipping || null,
        items: Array.isArray(data.items)
          ? data.items.map((item) => ({
            designTitle: item.designTitle || "Design",
            designAssetUrl: item.designAssetUrl || "",
            quantity: item.quantity || 1,
            blankName: item.blankName || "",
            color: item.color || "",
            size: item.size || "",
            customization: item.customization || null,
          }))
          : [],
      };
    }).sort((a, b) => {
      const aSeconds = a.createdAt?.seconds || 0;
      const bSeconds = b.createdAt?.seconds || 0;
      return bSeconds - aSeconds;
    });

    res.json({ orders });
  } catch (error) {
    logger.error("lookupOrders failed", error);
    res.status(500).json({ error: "Failed to look up orders." });
  }
});

exports.getOrderRefsBySession = onRequest({
  cors: true,
}, async (req, res) => {
  if (req.method !== "GET") {
    res.status(405).send("Method Not Allowed");
    return;
  }

  try {
    const sessionId = (req.query?.session_id || "").toString().trim();

    if (!sessionId) {
      res.status(400).json({ error: "session_id is required." });
      return;
    }

    const snap = await db
      .collection("orders")
      .where("stripeSessionId", "==", sessionId)
      .get();

    const orderRefs = snap.docs.map((orderDoc) => ({
      id: orderDoc.id,
      shortId: orderDoc.id.slice(-6).toUpperCase(),
    }));

    res.json({ orderRefs });
  } catch (error) {
    logger.error("getOrderRefsBySession failed", error);
    res.status(500).json({ error: "Failed to load order references." });
  }
});