import express from "express";
import {
  register,
  login,
  logout,
  getUserProfile,
  getMyInfo,
  updateUserProfile,
  getAllUsers,
  toggleWishlist,
  getWishlist,
  changePassword,
} from "../controllers/user.controller.js";
import { isAuth, isAdmin } from "../middleware/auth.middleware.js";
import {
  uploadSingle,
  handleMulterError,
} from "../middleware/upload.middleware.js";

const router = express.Router();

// Public routes
router.post("/register", register);
router.post("/login", login);

// Protected routes
router.use(isAuth); // All routes below require authentication

router.get("/logout", logout);
router.get("/profile", getUserProfile);
router.get("/getMyInfo", getMyInfo);
router.patch(
  "/profile/edit",
  uploadSingle,
  handleMulterError,
  updateUserProfile
);
router.patch("/change-password", changePassword);

// Wishlist routes
router.patch("/wishlist/:productId", toggleWishlist);
router.get("/wishlist", getWishlist);

// Admin only routes
router.get("/all", isAdmin, getAllUsers);

export default router;
