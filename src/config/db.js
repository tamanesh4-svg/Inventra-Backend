import mongoose from "mongoose";
import User from "../models/User.js";
import Product from "../models/Product.js";
import Cart from "../models/Cart.js";
import Order from "../models/Order.js";

export async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is missing. Copy .env.example to .env and configure it.");
  await mongoose.connect(uri, { dbName: "inventory_mern_db", serverSelectionTimeoutMS: 10000 });
  // Ensure collections exist before the first multi-document checkout transaction.
  await Promise.all([User.init(), Product.init(), Cart.init(), Order.init()]);
  console.log(`MongoDB connected (database: ${mongoose.connection.name})`);
}
