import { Router } from "express";
import { dashboardOverview, getInventory, productDemand } from "../controllers/analyticsController.js";
import { requireAuth } from "../middleware/auth.js";
const router = Router(); router.use(requireAuth);
router.get("/dashboard/overview", dashboardOverview);
router.get("/inventory", getInventory);
router.get("/products/demand", productDemand);
export default router;
