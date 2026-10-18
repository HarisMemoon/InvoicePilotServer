// src/app.js
import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import authRoutes from "./routes/authRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import clientRoutes from "./routes/clientRoutes.js";
import invoiceRoutes from "./routes/invoiceRoutes.js";
import stripeRoutes from "./routes/stripeRoutes.js";
import paymentsRoutes from "./routes/paymentsRoute.js";
import { stripeWebhook } from "./controllers/stripeController.js";

dotenv.config();

const app = express();
app.set("trust proxy", 1);
app.use(helmet());

// ------------------------------------------------------------------
// 1. STRIPE WEBHOOK FIRST — raw body, NO auth, NO json parser before it.
//    express.json() consumes the raw body, so it must be registered AFTER.
// ------------------------------------------------------------------
app.post(
  "/api/stripe/webhook",
  express.raw({ type: "application/json" }),
  stripeWebhook,
);

// ------------------------------------------------------------------
// 2. Everything else
// ------------------------------------------------------------------
// Localhost is always allowed (local dev). FRONTEND_URL adds the deployed
// frontend — set it on Render to the live site URL. Both work at once.
const allowedOrigins = [
  "http://localhost:5173",
  process.env.FRONTEND_URL,
].filter(Boolean);
app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));

// Rate limit: login/signup/refresh only (not the whole API).
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
});

// Routes
app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/user", userRoutes);
app.use("/api/clients", clientRoutes);
app.use("/api/invoices", invoiceRoutes);
app.use("/api/stripe", stripeRoutes);
app.use("/api/payments", paymentsRoutes);

// ————————————————————————————
// DO NOT START SERVER HERE
// ————————————————————————————
export default app;
