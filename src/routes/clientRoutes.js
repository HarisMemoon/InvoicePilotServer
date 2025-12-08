import express from "express";
import { verifyuser } from "../middleware/authMiddleware.js";
import {
  createClient,
  getClients,
  updateClient,
  deleteClient,
} from "../controllers/clientController.js";

const router = express.Router();

router.post("/", verifyuser, createClient);
router.get("/", verifyuser, getClients);
router.put("/:id", verifyuser, updateClient);
router.delete("/:id", verifyuser, deleteClient);

export default router;
