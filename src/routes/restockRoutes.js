import { Router } from "express";

import { getRestockHistory } from "../controllers/automationController.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.use(requireAuth);

router.get("/history", getRestockHistory);

export default router;