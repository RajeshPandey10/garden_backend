import express from "express";
import {
  createOrder,
  getUserOrders,
  getOrderById,
  cancelOrder,
  updateOrderStatus,
  getAllOrders,
  deleteOrder,
  getOrderStats,
} from "../controllers/order.controller.js";
import { isAuth, isAdmin } from "../middleware/auth.middleware.js";

const router = express.Router();

// All order routes require authentication
router.use(isAuth);

// User routes
router.post("/", createOrder);
router.get("/my-orders", getUserOrders);
router.put("/:id/cancel", cancelOrder);
router.get("/:id", getOrderById);

// Admin only routes
router.get("/", isAdmin, getAllOrders);
router.patch("/:id/status", isAdmin, updateOrderStatus);
router.delete("/:id", isAdmin, deleteOrder);
router.get("/stats", isAdmin, getOrderStats);

export default router;
