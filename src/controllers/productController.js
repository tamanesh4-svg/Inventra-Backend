import Product from "../models/Product.js";
import { HttpError } from "../utils/httpError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { productJSON } from "../utils/serializers.js";

function validateProduct(input, partial = false) {
  const out = {};
  if (!partial || input.name !== undefined) { if (typeof input.name !== "string" || !input.name.trim()) throw new HttpError(400, "Product name is required"); out.name = input.name.trim(); }
  if (!partial || input.price !== undefined) { const n = Number(input.price); if (!Number.isFinite(n) || n < 0) throw new HttpError(400, "Price must be a non-negative number"); out.price = n; }
  if (!partial || input.stock !== undefined) { const n = Number(input.stock); if (!Number.isInteger(n) || n < 0) throw new HttpError(400, "Stock must be a non-negative integer"); out.stock = n; }
  if (!partial || input.category !== undefined) out.category = typeof input.category === "string" && input.category.trim() ? input.category.trim() : "General";
  return out;
}
export const createProducts = asyncHandler(async (req, res) => {
  const inputs = Array.isArray(req.body) ? req.body : [req.body];
  if (!inputs.length || inputs.length > 100) throw new HttpError(400, "Provide between 1 and 100 products");
  const docs = inputs.map(input => ({ ...validateProduct(input), seller: req.user.id }));
  await Product.insertMany(docs);
  res.status(201).json({ message: "Products created" });
});
export const getProducts = asyncHandler(async (req, res) => {
  const products = await Product.find({ seller: req.user.id, isActive: true }).sort({ createdAt: -1 });
  res.json(products.map(productJSON));
});
export const updateProduct = asyncHandler(async (req, res) => {
  const updates = validateProduct(req.body, true);
  if (!Object.keys(updates).length) throw new HttpError(400, "At least one field is required");
  const product = await Product.findOneAndUpdate({ _id: req.params.productId, seller: req.user.id }, { $set: updates }, { new: true, runValidators: true });
  if (!product) throw new HttpError(404, "Product not found");
  res.json(productJSON(product));
});
export const deleteProduct = asyncHandler(async (req, res) => {
  const product = await Product.findOneAndUpdate({ _id: req.params.productId, seller: req.user.id }, { $set: { isActive: false } }, { new: true });
  if (!product) throw new HttpError(404, "Product not found");
  res.json({ message: "Product deactivated" });
});
export const restoreProduct = asyncHandler(async (req, res) => {
  const product = await Product.findOne({ _id: req.params.productId, seller: req.user.id });
  if (!product) throw new HttpError(404, "Product not found");
  if (product.isActive) throw new HttpError(400, "Product already active");
  product.isActive = true; await product.save();
  res.json({ message: "Product restored successfully" });
});
