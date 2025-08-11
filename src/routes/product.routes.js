import express from "express";
import {
  getAllProducts,
  getProductById,
  addProduct,
  updateProduct,
  deleteProduct,
  addProductReview,
  getFeaturedProducts,
  getTrendingProducts,
  getNewProducts,
  searchProducts,
  updateProductStock,
} from "../controllers/product.controller.js";
import { isAuth, isAdmin } from "../middleware/auth.middleware.js";
import {
  uploadProductImages,
  handleMulterError,
} from "../middleware/upload.middleware.js";

const router = express.Router();

// Public routes
router.get("/", getAllProducts);
router.get("/featured", getFeaturedProducts);
router.get("/trending", getTrendingProducts);
router.get("/new", getNewProducts);
router.get("/search", searchProducts);
router.get("/:id", getProductById);

// Protected routes
router.use(isAuth); // All routes below require authentication

// User routes
router.post("/:id/review", addProductReview);

// Admin only routes
router.post("/", isAdmin, uploadProductImages, handleMulterError, addProduct);
router.patch(
  "/:id",
  isAdmin,
  uploadProductImages,
  handleMulterError,
  updateProduct
);
router.delete("/:id", isAdmin, deleteProduct);
router.patch("/:id/stock", isAdmin, updateProductStock);

export default router;
