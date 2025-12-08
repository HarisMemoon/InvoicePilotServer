// server.js
import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import authRoutes from "./routes/authRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import clientRoutes from "./routes/clientRoutes.js";
import invoiceRoutes from "./routes/invoiceRoutes.js";
import stripeRoutes from "./routes/stripeRoutes.js";
import paymentsRoutes from "./routes/paymentsRoute.js";
import { stripeWebhook } from "./controllers/stripeController.js";

dotenv.config();

const app = express();
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));
// CORS
app.use(cors({ origin: "http://localhost:5173", credentials: true }));

// Stripe webhook (raw body)
app.post(
  "/api/stripe/webhook",
  express.raw({ type: "application/json" }),
  stripeWebhook
);

// JSON parser
app.use(express.json());

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);
app.use("/api/clients", clientRoutes);
app.use("/api/invoices", invoiceRoutes);
app.use("/api/stripe", stripeRoutes);
app.use("/api/payments", paymentsRoutes);

// ————————————————————————————
// DO NOT START SERVER HERE
// ————————————————————————————
export default app;
