import mongoose from "mongoose";
import Product from "../models/Product.js";
import Cart from "../models/Cart.js";
import Order from "../models/Order.js";
import { asyncHandler } from "../utils/asyncHandler.js";

async function thresholdsFor(products) {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const totals = await Order.aggregate([
    { $match: { seller: products[0]?.seller, createdAt: { $gte: since } } },
    { $unwind: "$items" },
    { $group: { _id: "$items.product", sold: { $sum: "$items.quantity" } } }
  ]);
  const sales = new Map(totals.map(row => [String(row._id), row.sold]));
  return new Map(products.map(p => { const daily = (sales.get(String(p._id)) || 0) / 7; return [String(p._id), Math.max(Math.floor(daily * 3), 2)]; }));
}

export const getInventory = asyncHandler(async (req, res) => {
  const products = await Product.find({ seller: req.user.id }).sort({ createdAt: -1 });
  if (!products.length) return res.json([]);
  const thresholds = await thresholdsFor(products);
  res.json(products.map(p => { const threshold = thresholds.get(String(p._id)); const status = p.stock === 0 ? "out_of_stock" : p.stock <= threshold ? "low_stock" : "normal"; return { id: String(p._id), name: p.name, stock: p.stock, threshold, status, restock_suggestion: Math.max(threshold - p.stock, 0) }; }));
});

export const dashboardOverview = asyncHandler(async (req, res) => {
  const [totalProducts, totalCarts, amount, products] = await Promise.all([
    Product.countDocuments({ seller: req.user.id }), Cart.countDocuments({ seller: req.user.id }),
    Order.aggregate([{ $match: { seller: new mongoose.Types.ObjectId(req.user.id) } }, { $group: { _id: null, total: { $sum: "$totalAmount" } } }]),
    Product.find({ seller: req.user.id }).sort({ createdAt: -1 })
  ]);
  let lowStock = null;
  if (products.length) { const thresholds = await thresholdsFor(products); const p = products.find(item => item.stock <= thresholds.get(String(item._id))); if (p) lowStock = { name: p.name, quantity: p.stock }; }
  res.json({ total_products: totalProducts, total_carts: totalCarts, total_amount: amount[0]?.total || 0, low_stock: lowStock });
});

export const productDemand = asyncHandler(async (req, res) => {
  const products = await Product.find({ seller: req.user.id, isActive: true });
  const result = products.map(p => { const total = p.stock + p.totalSold; const ratio = total ? p.totalSold / total : 0; return { product_id: String(p._id), product_name: p.name, total_sold: p.totalSold, current_stock: p.stock, demand_ratio: Number(ratio.toFixed(2)), demand: ratio > 0.6 ? "High" : ratio > 0.3 ? "Medium" : "Low" }; });
  result.sort((a, b) => b.demand_ratio - a.demand_ratio); res.json(result);
});
