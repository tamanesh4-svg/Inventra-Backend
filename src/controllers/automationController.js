import mongoose from "mongoose";
import { timingSafeEqual } from "crypto";

import Product from "../models/Product.js";
import RestockHistory from "../models/RestockHistory.js";

import { asyncHandler } from "../utils/asyncHandler.js";
import { HttpError } from "../utils/httpError.js";

export const completeRestock = asyncHandler(async (req, res) => {
  // 1. Verify shared secret
  const expectedSecret = process.env.N8N_WEBHOOK_SECRET;
  const providedSecret = req.get("x-inventra-secret");

  if (!expectedSecret) {
    throw new HttpError(500, "Automation secret is not configured");
  }

  if (!providedSecret) {
    throw new HttpError(401, "Unauthorized: Secret header missing");
  }

  const expectedBuffer = Buffer.from(expectedSecret);
  const providedBuffer = Buffer.from(providedSecret);

  if (
    expectedBuffer.length !== providedBuffer.length ||
    !timingSafeEqual(expectedBuffer, providedBuffer)
  ) {
    throw new HttpError(401, "Invalid automation secret");
  }

  // 2. Validate incoming data
  const { product_id, event_id } = req.body || {};

  if (
    !mongoose.isValidObjectId(product_id) ||
    typeof event_id !== "string" ||
    !event_id.trim()
  ) {
    throw new HttpError(
      400,
      "Valid product_id and event_id are required"
    );
  }

  // 3. Update stock and create history in one transaction
  const session = await mongoose.startSession();

  let restockResult;

  try {
    await session.withTransaction(async () => {
      // Atomically claim and complete this specific restock event
      const updatedProduct = await Product.findOneAndUpdate(
        {
          _id: product_id,
          restockPending: true,
          restockEventId: event_id
        },
        {
          $inc: { stock: 50 },
          $set: { restockPending: false },
          $unset: { restockEventId: 1 }
        },
        {
          new: true,
          runValidators: true,
          session
        }
      );

      if (!updatedProduct) {
        throw new HttpError(
          409,
          "No matching pending restock event found. It may already be completed."
        );
      }

      const previousStock = updatedProduct.stock - 50;

      // Save restock history
      await RestockHistory.create(
        [
          {
            product: updatedProduct._id,
            productName: updatedProduct.name,
            seller: updatedProduct.seller,
            previousStock,
            updatedStock: updatedProduct.stock,
            quantityAdded: 50,
            eventId: event_id
          }
        ],
        { session }
      );

      restockResult = {
        product_id: String(updatedProduct._id),
        product_name: updatedProduct.name,
        previous_stock: previousStock,
        added_quantity: 50,
        updated_stock: updatedProduct.stock,
        event_id: event_id
      };
    });
  } finally {
    await session.endSession();
  }

  console.log("RESTOCK COMPLETED AND HISTORY SAVED");
  console.log(restockResult);

  // 4. Confirm success to n8n
  return res.status(200).json({
    success: true,
    message: "Restock completed and history saved successfully",
    ...restockResult
  });
});


// 5. Fetch restock history for the logged-in seller
export const getRestockHistory = asyncHandler(async (req, res) => {
  const history = await RestockHistory.find({
    seller: req.user.id
  })
    .sort({ createdAt: -1 })
    .limit(100)
    .populate("product", "name category");

  res.status(200).json({
    success: true,
    count: history.length,
    history
  });
});