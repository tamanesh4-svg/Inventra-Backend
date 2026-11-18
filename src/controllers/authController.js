
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { HttpError } from "../utils/httpError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const signup = asyncHandler(async (req, res) => {
  const name = String(req.body.name || "").trim();
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = req.body.password;

  // Validate name
  if (name.length < 2 || name.length > 80) {
    throw new HttpError(400, "Name must be between 2 and 80 characters");
  }

  // Validate email
  if (!validEmail.test(email) || email.length > 254) {
    throw new HttpError(400, "A valid email is required");
  }

  // Validate password
  if (
    typeof password !== "string" ||
    password.length < 8 ||
    password.length > 72
  ) {
    throw new HttpError(400, "Password must be between 8 and 72 characters");
  }

  if (await User.exists({ email })) {
    throw new HttpError(409, "User already exists");
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await User.create({
    name,
    email,
    passwordHash
  });

  res.status(201).json({
    message: "User created successfully",
    user: {
      id: String(user._id),
      name: user.name,
      email: user.email
    }
  });
});

export const login = asyncHandler(async (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = req.body.password;

  if (!email || typeof password !== "string") {
    throw new HttpError(400, "Email and password are required");
  }

  const user = await User.findOne({ email }).select("+passwordHash");

  const ok = user
    ? await bcrypt.compare(password, user.passwordHash)
    : false;

  if (!ok) throw new HttpError(401, "Invalid credentials");

  const secret = process.env.JWT_SECRET;
  const expiresIn = process.env.JWT_EXPIRES_IN || "1h";

  const token = jwt.sign(
    {
      user_id: String(user._id),
      email: user.email,
      name: user.name
    },
    secret,
    {
      algorithm: "HS256",
      subject: String(user._id),
      expiresIn,
      issuer: process.env.JWT_ISSUER || "inventra-api",
      audience: process.env.JWT_AUDIENCE || "inventra-frontend"
    }
  );

  res.json({
    access_token: token,
    token_type: "bearer",
    expires_in: expiresIn
  });
});
