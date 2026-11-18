import mongoose from "mongoose";

const productSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 160 },
  price: { type: Number, required: true, min: 0 },
  stock: { type: Number, required: true, min: 0, validate: Number.isInteger },
  seller: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  isActive: { type: Boolean, default: true, index: true },
  totalSold: { type: Number, default: 0, min: 0 },
  category: { type: String, default: "General", trim: true, maxlength: 100 },
  restockPending: {
  type: Boolean,
  default: false
},

restockEventId: {
  type: String,
  default: null
}
}, { timestamps: true, versionKey: false });
productSchema.index({ seller: 1, isActive: 1 });
export default mongoose.model("Product", productSchema);
