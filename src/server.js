import "dotenv/config";
import app from "./app.js";
import { connectDB } from "./config/db.js";

const port = Number(process.env.PORT || 5000);
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32 || process.env.JWT_SECRET === "replace_with_a_random_secret_at_least_32_characters_long") {
  console.error("JWT_SECRET must be a private random string of at least 32 characters. Configure backend/.env.");
  process.exit(1);
}
try {
  await connectDB();
  const server = app.listen(port, () => console.log(`Inventra API listening on http://localhost:${port}`));
  const shutdown = async () => { server.close(); const mongoose = await import("mongoose"); await mongoose.default.connection.close(); process.exit(0); };
  process.on("SIGINT", shutdown); process.on("SIGTERM", shutdown);
} catch (error) { console.error("Backend startup failed:", error.message); process.exit(1); }
