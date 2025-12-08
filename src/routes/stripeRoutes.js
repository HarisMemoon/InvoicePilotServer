import express from "express";
import { createCheckoutSession } from "../controllers/stripeController.js";
import { verifyuser } from "../middleware/authMiddleware.js";

const router = express.Router();

// ✅ Only checkout session handled here
router.post("/create-checkout-session", verifyuser, createCheckoutSession);

export default router;
