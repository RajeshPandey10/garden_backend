import express from "express";
import {
  getDashboardStats,
  getNewOrdersCount,
  getPendingOrdersCount,
  getRecentActivities,
  getSalesAnalytics,
  getProductAnalytics,
  updateUserRole,
  toggleUserStatus,
} from "../controllers/admin.controller.js";
import { isAuth, isAdmin } from "../middleware/auth.middleware.js";

const router = express.Router();

// All admin routes require authentication and admin role
router.use(isAuth, isAdmin);

// Dashboard routes
router.get("/dashboard-stats", getDashboardStats);
router.get("/orders/new", getNewOrdersCount);
router.get("/orders/pending-count", getPendingOrdersCount);
router.get("/recent-activities", getRecentActivities);

// Analytics routes
router.get("/analytics/sales", getSalesAnalytics);
router.get("/analytics/products", getProductAnalytics);

// User management routes
router.patch("/users/:id/role", updateUserRole);
router.patch("/users/:id/status", toggleUserStatus);

export default router;
