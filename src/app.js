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

// Stripe requires the unparsed body to validate the webhook signature.
app.post(
  "/api/stripe/webhook",
  express.raw({ type: "application/json" }),
  stripeWebhook,
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));
app.use(cors({ origin: process.env.FRONTEND_URL, credentials: true }));

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
