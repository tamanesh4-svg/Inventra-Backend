import mongoose from "mongoose";
import Cart from "../models/Cart.js";
import Product from "../models/Product.js";
import Order from "../models/Order.js";
import { HttpError } from "../utils/httpError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { orderJSON } from "../utils/serializers.js";

import { sendOrderConfirmation } from "../services/orderEmailAutomation.js";
import { checkAndTriggerRestock } from "../services/inventoryAutomation.js";


// ==========================================
// CREATE CART
// ==========================================

export const createCart = asyncHandler(async (req, res) => {
  const cart = await Cart.create({
    seller: req.user.id
  });

  res.status(201).json({
    cart_id: String(cart._id)
  });
});


// ==========================================
// ADD TO CART
// ==========================================

export const addToCart = asyncHandler(async (req, res) => {
  const {
    cart_id: cartId,
    product_id: productId,
    quantity
  } = req.body;

  if (
    !mongoose.isValidObjectId(cartId) ||
    !mongoose.isValidObjectId(productId)
  ) {
    throw new HttpError(
      400,
      "Valid cart_id and product_id are required"
    );
  }

  if (
    !Number.isInteger(quantity) ||
    quantity === 0 ||
    Math.abs(quantity) > 1000
  ) {
    throw new HttpError(
      400,
      "Quantity must be a non-zero integer"
    );
  }

  const cart = await Cart.findOne({
    _id: cartId,
    seller: req.user.id,
    checkedOut: false
  });

  if (!cart) {
    throw new HttpError(404, "Cart not found");
  }

  const product = await Product.findOne({
    _id: productId,
    seller: req.user.id,
    isActive: true
  });

  if (!product) {
    throw new HttpError(400, "Product not available");
  }

  const index = cart.items.findIndex(
    item => String(item.product) === String(product._id)
  );

  const currentQty = index >= 0
    ? cart.items[index].quantity
    : 0;

  const nextQty = currentQty + quantity;

  if (nextQty > product.stock) {
    throw new HttpError(400, "Not enough stock");
  }

  if (nextQty <= 0) {
    if (index >= 0) {
      cart.items.splice(index, 1);
    }
  } else if (index >= 0) {
    cart.items[index].quantity = nextQty;
  } else {
    cart.items.push({
      product: product._id,
      quantity: nextQty
    });
  }

  await cart.save();

  res.json({
    message: "Added"
  });
});


// ==========================================
// VIEW CART
// ==========================================

export const viewCart = asyncHandler(async (req, res) => {
  const cart = await Cart.findOne({
    _id: req.params.cartId,
    seller: req.user.id
  });

  if (!cart) {
    throw new HttpError(404, "Cart not found");
  }

  const items = [];
  let total = 0;

  for (const item of cart.items) {
    const product = await Product.findOne({
      _id: item.product,
      seller: req.user.id
    });

    if (!product) continue;

    const subtotal = Number(
      (product.price * item.quantity).toFixed(2)
    );

    total += subtotal;

    items.push({
      name: product.name,
      qty: item.quantity,
      subtotal
    });
  }

  res.json({
    items,
    total: Number(total.toFixed(2))
  });
});


// ==========================================
// CHECKOUT
// ==========================================

export const checkout = asyncHandler(async (req, res) => {

  // Validate buyer email
  const buyerEmail =
    typeof req.body?.buyerEmail === "string"
      ? req.body.buyerEmail.trim().toLowerCase()
      : "";

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!buyerEmail || !emailRegex.test(buyerEmail)) {
    throw new HttpError(
      400,
      "A valid buyer email is required"
    );
  }

  const session = await mongoose.startSession();

  let total = 0;
  let updatedProductIds = [];
  let createdOrder = null;

  try {

    // ======================================
    // DATABASE TRANSACTION
    // ======================================

    await session.withTransaction(async () => {

      total = 0;
      updatedProductIds = [];

      const cart = await Cart.findOne({
        _id: req.params.cartId,
        seller: req.user.id,
        checkedOut: false
      }).session(session);

      if (!cart) {
        throw new HttpError(404, "Cart not found");
      }

      if (!cart.items.length) {
        throw new HttpError(400, "Empty cart");
      }

      const orderItems = [];

      // Process every cart item
      for (const item of cart.items) {

        const product = await Product.findOne({
          _id: item.product,
          seller: req.user.id,
          isActive: true
        }).session(session);

        if (!product) {
          throw new HttpError(
            400,
            "A product in this cart is no longer available"
          );
        }

        if (product.stock < item.quantity) {
          throw new HttpError(400, "Stock issue");
        }

        // Reduce product stock
        const updated = await Product.findOneAndUpdate(
          {
            _id: product._id,
            seller: req.user.id,
            stock: { $gte: item.quantity }
          },
          {
            $inc: {
              stock: -item.quantity,
              totalSold: item.quantity
            }
          },
          {
            new: true,
            session
          }
        );

        if (!updated) {
          throw new HttpError(
            400,
            "Stock issue; please refresh the cart"
          );
        }

        // Remember products for automatic restocking
        updatedProductIds.push(String(updated._id));

        // Calculate total
        total += product.price * item.quantity;

        // Store order item details
        orderItems.push({
          product: product._id,
          productName: product.name,
          price: product.price,
          category: product.category,
          quantity: item.quantity
        });
      }

      total = Number(total.toFixed(2));

      // ======================================
      // CREATE ORDER
      // ======================================

      const [order] = await Order.create(
        [
          {
            cart: cart._id,
            seller: req.user.id,
            buyerEmail,
            totalAmount: total,
            items: orderItems
          }
        ],
        { session }
      );

      createdOrder = order;

      // Clear cart after checkout
      cart.items = [];
      cart.checkedOut = true;

      await cart.save({ session });

    });

    // ======================================
    // TRANSACTION COMMITTED SUCCESSFULLY
    // ======================================

    // ======================================
    // AUTOMATIC RESTOCK WORKFLOW
    // ======================================

    const restockResults = await Promise.allSettled(
      updatedProductIds.map(productId =>
        checkAndTriggerRestock(productId, req.user.id)
      )
    );

    restockResults.forEach((result, index) => {

      if (result.status === "rejected") {
        console.error(
          "Restock trigger failed for product:",
          updatedProductIds[index],
          result.reason
        );
      }

    });


    // ======================================
    // BUYER EMAIL WORKFLOW
    // ======================================

    let emailAutomationStatus = "triggered";

    try {

      await sendOrderConfirmation(createdOrder);

      console.log(
        `Order confirmation email triggered for ${buyerEmail}`
      );

    } catch (error) {

      emailAutomationStatus = "failed";

      console.error(
        "Buyer order email automation failed:",
        error
      );

    }


    // ======================================
    // CHECKOUT RESPONSE
    // ======================================

    res.json({
      message: "Done",
      total,
      order_id: String(createdOrder._id),
      buyer_email: buyerEmail,
      automation_checked: updatedProductIds.length,
      email_automation: emailAutomationStatus
    });

  } finally {

    await session.endSession();

  }

});


// ==========================================
// GET ALL ORDERS
// ==========================================

export const getOrders = asyncHandler(async (req, res) => {

  const orders = await Order.find({
    seller: req.user.id
  }).sort({
    createdAt: -1
  });

  res.json(
    orders.map(orderJSON)
  );

});


// ==========================================
// GET ORDER DETAILS
// ==========================================

export const getOrderDetails = asyncHandler(async (req, res) => {

  const order = await Order.findOne({
    _id: req.params.orderId,
    seller: req.user.id
  });

  if (!order) {
    throw new HttpError(404, "Order not found");
  }

  const items = order.items.map(item => ({
    product_id: String(item.product),
    product_name: item.productName,
    price: item.price,
    quantity: item.quantity,
    subtotal: Number(
      (item.price * item.quantity).toFixed(2)
    ),
    category: item.category
  }));

  res.json({
    id: String(order._id),
    cart_id: String(order.cart),
    total_amount: order.totalAmount,
    created_at: order.createdAt,
    items
  });

});