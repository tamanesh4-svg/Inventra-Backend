import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { HttpError } from "../utils/httpError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const requireAuth = asyncHandler(async (req, _res, next) => {
  const header = req.get("authorization") || "";
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) throw new HttpError(401, "Authentication required");
  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: ["HS256"], issuer: process.env.JWT_ISSUER || "inventra-api",
      audience: process.env.JWT_AUDIENCE || "inventra-frontend"
    });
  } catch { throw new HttpError(401, "Invalid or expired token"); }
  const userId = payload.user_id || payload.sub;
  if (!userId || !/^[a-f\d]{24}$/i.test(String(userId))) throw new HttpError(401, "Invalid token subject");
  const user = await User.findById(userId).select("email");
  if (!user) throw new HttpError(401, "Account no longer exists");
  req.user = { id: String(user._id), email: user.email };
  next();
});
