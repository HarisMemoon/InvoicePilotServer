import express from "express";
import {
  createInvoice,
  getInvoices,
  getInvoiceById,
  updateInvoice,
  deleteInvoice,
} from "../controllers/invoiceController.js";
import { verifyuser } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/", verifyuser, createInvoice);

router.get("/", verifyuser, getInvoices);

router.get("/:id", verifyuser, getInvoiceById);

router.put("/:id", verifyuser, updateInvoice);

router.delete("/:id", verifyuser, deleteInvoice);

export default router;
