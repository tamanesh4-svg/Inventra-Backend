
import express from "express";
import { completeRestock } from "../controllers/automationController.js";

const router = express.Router();

router.post("/complete-restock", completeRestock);

export default router;
