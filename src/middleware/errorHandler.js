import mongoose from "mongoose";
import { HttpError } from "../utils/httpError.js";

export function notFound(req, _res, next) { next(new HttpError(404, `Route not found: ${req.method} ${req.originalUrl}`)); }
export function errorHandler(err, _req, res, _next) {
  if (res.headersSent) return;
  let status = err.status || 500;
  let message = err.message || "Internal server error";
  if (err instanceof mongoose.Error.ValidationError) { status = 400; message = Object.values(err.errors).map(e => e.message).join(", "); }
  if (err instanceof mongoose.Error.CastError) { status = 400; message = "Invalid resource ID"; }
  if (err?.code === 11000) { status = 409; message = "An account with this email already exists"; }
  if (status >= 500) { console.error(err); if (process.env.NODE_ENV === "production") message = "Internal server error"; }
  res.status(status).json({ detail: message, message });
}
