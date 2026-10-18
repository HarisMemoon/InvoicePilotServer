import { verifyuser } from "../middleware/authMiddleware.js";
import {
  getPayments,
  getPaymentById,
  getPaymentByInvoiceId,
} from "../controllers/paymentsController.js";
import express from "express";

const router = express.Router();

router.use(verifyuser); // <-- auth guard (same as invoices)
router.get("/", getPayments); // GET /api/payments
router.get("/invoice/:invoiceId", getPaymentByInvoiceId);
router.get("/:id", getPaymentById); // GET /api/payments/:id

export default router;
