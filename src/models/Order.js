import mongoose from "mongoose";

const orderItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
  productName: { type: String, required: true },
  price: { type: Number, required: true, min: 0 },
  category: { type: String, default: "General" },
  quantity: { type: Number, required: true, min: 1, validate: Number.isInteger }
}, { _id: false });

const orderSchema = new mongoose.Schema({
  cart: { type: mongoose.Schema.Types.ObjectId, ref: "Cart", required: true },
  seller: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },

  buyerEmail: {
    type: String,
    required: true,
    trim: true,
    lowercase: true
  },

  totalAmount: { type: Number, required: true, min: 0 },
  items: { type: [orderItemSchema], default: [] }
}, { timestamps: true, versionKey: false });

orderSchema.index({ seller: 1, createdAt: -1 });

export default mongoose.model("Order", orderSchema);