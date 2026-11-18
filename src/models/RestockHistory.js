
import mongoose from "mongoose";

const restockHistorySchema = new mongoose.Schema(
  {
    eventId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },

    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },

    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true
    },

    productName: {
      type: String,
      required: true,
      trim: true
    },

    previousStock: {
      type: Number,
      required: true,
      min: 0
    },

    updatedStock: {
      type: Number,
      required: true,
      min: 0
    },

    quantityAdded: {
      type: Number,
      required: true,
      default: 50
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

// Efficient seller-specific history queries.
restockHistorySchema.index({ seller: 1, createdAt: -1 });

export default mongoose.model("RestockHistory", restockHistorySchema);
