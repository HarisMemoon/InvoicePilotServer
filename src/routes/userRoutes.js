import express from "express";
import { verifyuser } from "../middleware/authMiddleware.js";
import { getProfile, updateProfile } from "../controllers/userController.js";

const router = express.Router();

router.get("/profile", verifyuser, getProfile);
router.put("/profile", verifyuser, updateProfile);

export default router;
