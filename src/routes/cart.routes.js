import express from "express";
import {
  getCart,
  addToCart,
  updateCartItem,
  removeCartItem,
  clearCart,
  getCartItemCount,
  validateCart,
} from "../controllers/cart.controller.js";
import { isAuth } from "../middleware/auth.middleware.js";

const router = express.Router();

// All cart routes require authentication
router.use(isAuth);

router.get("/", getCart);
router.get("/count", getCartItemCount);
router.get("/validate", validateCart);
router.post("/add", addToCart);
router.put("/update", updateCartItem);
router.delete("/remove", removeCartItem);
router.delete("/clear", clearCart);

export default router;
