
import { randomUUID } from "crypto";
import Product from "../models/Product.js";
import Order from "../models/Order.js";
import User from "../models/User.js";

// Calculate the stock threshold using the last 7 days of sales.
async function calculateThreshold(product) {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const totals = await Order.aggregate([
    {
      $match: {
        seller: product.seller,
        createdAt: { $gte: since }
      }
    },
    { $unwind: "$items" },
    {
      $group: {
        _id: "$items.product",
        sold: { $sum: "$items.quantity" }
      }
    }
  ]);

  const row = totals.find(
    item => String(item._id) === String(product._id)
  );

  const weeklySales = row?.sold || 0;
  const daily = weeklySales / 7;
  const threshold = Math.max(Math.floor(daily * 3), 2);

  console.log("📊 Threshold calculation:", {
    product: product.name,
    weeklySales,
    dailySales: daily,
    threshold
  });

  return threshold;
}

export async function checkAndTriggerRestock(productId, sellerId) {
  console.log("\n========== RESTOCK AUTOMATION STARTED ==========");
  console.log("Product ID:", String(productId));
  console.log("Seller ID:", String(sellerId));

  // 1. Validate n8n configuration.
  const webhookUrl = process.env.N8N_INVENTORY_WEBHOOK_URL;
  const webhookSecret = process.env.N8N_WEBHOOK_SECRET;
  
  console.log("its is thsi ",webhookUrl);
  console.log("Webhook URL configured:", Boolean(webhookUrl));
  console.log("Webhook secret configured:", Boolean(webhookSecret));

  if (!webhookUrl || !webhookSecret) {
    throw new Error(
      "n8n webhook URL or secret is missing in environment variables"
    );
  }

  // 2. Find the product.
  const product = await Product.findOne({
    _id: productId,
    seller: sellerId
  });

  if (!product) {
    console.log("❌ Product not found for this seller.");
    return;
  }

  console.log("Product found:", product.name);
  console.log("Current stock:", product.stock);
  console.log("Restock pending:", product.restockPending);

  // 3. Retrieve seller email for notification.
  const seller = await User.findById(sellerId).select("email");
  const sellerEmail = seller?.email || null;

  if (sellerEmail) {
    console.log("✅ Seller email retrieved:", sellerEmail);
  } else {
    console.log("⚠️ Seller email not found. Notification will be skipped.");
  }

  // 4. Calculate threshold.
  const threshold = await calculateThreshold(product);

  console.log("Current stock:", product.stock);
  console.log("Required threshold:", threshold);

  if (product.stock > threshold) {
    console.log("⏭️ RESTOCK SKIPPED: Stock is above threshold.");
    console.log("================================================\n");
    return;
  }

  console.log("⚠️ LOW STOCK DETECTED! Restock required.");

  // 5. Generate unique event ID.
  const eventId = randomUUID();

  // 6. Atomically claim the product.
  const claimed = await Product.findOneAndUpdate(
    {
      _id: productId,
      seller: sellerId,
      stock: { $lte: threshold },
      restockPending: { $ne: true }
    },
    {
      $set: {
        restockPending: true,
        restockEventId: eventId
      }
    },
    { new: true }
  );

  if (!claimed) {
    console.log(
      "⏭️ RESTOCK SKIPPED: Product already claimed or stock changed."
    );
    console.log("================================================\n");
    return;
  }

  console.log("✅ Product successfully claimed for restocking.");
  console.log("Event ID:", eventId);

  try {
    // 7. Trigger n8n workflow.
    console.log("🚀 Sending request to n8n...");
    console.log("Target:", webhookUrl);

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-inventra-secret": webhookSecret
      },
      body: JSON.stringify({
        event_id: eventId,
        product_id: String(productId),
        seller_id: String(sellerId),
        seller_email: sellerEmail,
        product_name: product.name,
        current_stock: claimed.stock,
        threshold,
        restock_quantity: 50
      }),
      signal: AbortSignal.timeout(15000)
    });

    console.log("n8n HTTP response status:", response.status);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`n8n returned ${response.status}: ${errorText}`);
    }

    console.log("✅ n8n webhook accepted the request.");
    console.log(`Restock workflow triggered for ${product.name}.`);
    console.log("Seller email:", sellerEmail || "Not available");
    console.log("Event ID:", eventId);
    console.log("================================================\n");

  } catch (error) {
    console.error("❌ RESTOCK WEBHOOK FAILED:", error.message);

    // 8. Release pending lock if the request fails.
    await Product.updateOne(
      {
        _id: productId,
        seller: sellerId,
        restockEventId: eventId
      },
      {
        $set: { restockPending: false },
        $unset: { restockEventId: 1 }
      }
    );

    console.log("🔓 Restock pending lock released.");
    console.log("================================================\n");

    throw error;
  }
}
