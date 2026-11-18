
export const sendOrderConfirmation = async (order) => {
  const webhookUrl = process.env.N8N_ORDER_EMAIL_WEBHOOK_URL;
  const webhookSecret = process.env.N8N_WEBHOOK_SECRET;

  if (!webhookUrl) {
    throw new Error("N8N_ORDER_EMAIL_WEBHOOK_URL is missing");
  }

  if (!webhookSecret) {
    throw new Error("N8N_WEBHOOK_SECRET is missing");
  }

  const payload = {
    buyer_email: order.buyerEmail,
    order_id: String(order._id),
    created_at: order.createdAt,
    total_amount: order.totalAmount,

    items: order.items.map(item => ({
      product_name: item.productName,
      price: item.price,
      category: item.category,
      quantity: item.quantity,
      subtotal: Number(
        (item.price * item.quantity).toFixed(2)
      )
    }))
  };

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-inventra-secret": webhookSecret
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(10000)
  });

  if (!response.ok) {
    const errorText = await response.text();

    throw new Error(
      `Order email webhook failed: ${response.status} - ${errorText}`
    );
  }

  return true;
};
