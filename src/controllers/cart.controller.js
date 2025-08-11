import Cart from "../models/cart.model.js";
import Product from "../models/product.model.js";
import {
  sendSuccessResponse,
  sendErrorResponse,
  asyncHandler,
  validateRequiredFields,
} from "../utils/api.utils.js";


export const getCart = asyncHandler(async (req, res) => {
  let cart = await Cart.findOne({ user: req.id }).populate({
    path: "items.product",
    select: "name price oldPrice image stock isAvailable category",
  });

  // Create empty cart if doesn't exist
  if (!cart) {
    cart = await Cart.create({ user: req.id, items: [] });
  }

  // Filter out unavailable products
  const availableItems = cart.items.filter(
    (item) => item.product && item.product.isAvailable
  );

  // Update cart if items were filtered out
  if (availableItems.length !== cart.items.length) {
    cart.items = availableItems;
    await cart.save();
  }

  sendSuccessResponse(res, 200, "Cart fetched successfully", {
    cart: {
      items: cart.items,
      totalItems: cart.totalItems,
      totalPrice: cart.totalPrice,
      lastUpdated: cart.lastUpdated,
    },
  });
});


export const addToCart = asyncHandler(async (req, res) => {
  const { productId, quantity = 1 } = req.body;

  // Validate required fields
  const validation = validateRequiredFields(req.body, ["productId"]);
  if (!validation.isValid) {
    return sendErrorResponse(
      res,
      400,
      `Missing required fields: ${validation.missingFields.join(", ")}`
    );
  }

  // Validate quantity
  if (quantity < 1 || quantity > 10) {
    return sendErrorResponse(res, 400, "Quantity must be between 1 and 10");
  }

  // Check if product exists and is available
  const product = await Product.findById(productId);
  if (!product) {
    return sendErrorResponse(res, 404, "Product not found");
  }

  if (!product.isAvailable) {
    return sendErrorResponse(res, 400, "Product is not available");
  }

  if (product.stock < quantity) {
    return sendErrorResponse(
      res,
      400,
      `Only ${product.stock} items available in stock`
    );
  }

  // Find or create cart
  let cart = await Cart.findOne({ user: req.id });
  if (!cart) {
    cart = await Cart.create({ user: req.id, items: [] });
  }

  try {
    // Add item to cart using model method
    cart.addItem(productId, parseInt(quantity), product.price);
    await cart.save();

    // Populate and return updated cart
    await cart.populate({
      path: "items.product",
      select: "name price oldPrice image stock isAvailable category",
    });

    sendSuccessResponse(res, 200, "Item added to cart successfully", {
      cart: {
        items: cart.items,
        totalItems: cart.totalItems,
        totalPrice: cart.totalPrice,
      },
    });
  } catch (error) {
    if (error.message.includes("Cannot add more than 10")) {
      return sendErrorResponse(res, 400, error.message);
    }
    throw error;
  }
});


export const updateCartItem = asyncHandler(async (req, res) => {
  const { productId, quantity } = req.body;

  // Validate required fields
  const validation = validateRequiredFields(req.body, [
    "productId",
    "quantity",
  ]);
  if (!validation.isValid) {
    return sendErrorResponse(
      res,
      400,
      `Missing required fields: ${validation.missingFields.join(", ")}`
    );
  }

  // Validate quantity
  if (quantity < 0 || quantity > 10) {
    return sendErrorResponse(res, 400, "Quantity must be between 0 and 10");
  }

  // Find cart
  const cart = await Cart.findOne({ user: req.id });
  if (!cart) {
    return sendErrorResponse(res, 404, "Cart not found");
  }

  // Check product availability and stock
  if (quantity > 0) {
    const product = await Product.findById(productId);
    if (!product) {
      return sendErrorResponse(res, 404, "Product not found");
    }

    if (!product.isAvailable) {
      return sendErrorResponse(res, 400, "Product is not available");
    }

    if (product.stock < quantity) {
      return sendErrorResponse(
        res,
        400,
        `Only ${product.stock} items available in stock`
      );
    }
  }

  try {
    // Update item quantity using model method
    cart.updateItemQuantity(productId, parseInt(quantity));
    await cart.save();

    // Populate and return updated cart
    await cart.populate({
      path: "items.product",
      select: "name price oldPrice image stock isAvailable category",
    });

    const message =
      quantity === 0
        ? "Item removed from cart"
        : "Cart item updated successfully";

    sendSuccessResponse(res, 200, message, {
      cart: {
        items: cart.items,
        totalItems: cart.totalItems,
        totalPrice: cart.totalPrice,
      },
    });
  } catch (error) {
    if (
      error.message.includes("Item not found") ||
      error.message.includes("Quantity cannot exceed")
    ) {
      return sendErrorResponse(res, 400, error.message);
    }
    throw error;
  }
});


export const removeCartItem = asyncHandler(async (req, res) => {
  const { productId } = req.body;

  // Validate required fields
  const validation = validateRequiredFields(req.body, ["productId"]);
  if (!validation.isValid) {
    return sendErrorResponse(
      res,
      400,
      `Missing required fields: ${validation.missingFields.join(", ")}`
    );
  }

  // Find cart
  const cart = await Cart.findOne({ user: req.id });
  if (!cart) {
    return sendErrorResponse(res, 404, "Cart not found");
  }

  // Remove item using model method
  cart.removeItem(productId);
  await cart.save();

  // Populate and return updated cart
  await cart.populate({
    path: "items.product",
    select: "name price oldPrice image stock isAvailable category",
  });

  sendSuccessResponse(res, 200, "Item removed from cart successfully", {
    cart: {
      items: cart.items,
      totalItems: cart.totalItems,
      totalPrice: cart.totalPrice,
    },
  });
});

export const clearCart = asyncHandler(async (req, res) => {
  // Find cart
  const cart = await Cart.findOne({ user: req.id });
  if (!cart) {
    return sendErrorResponse(res, 404, "Cart not found");
  }

  // Clear cart using model method
  cart.clearCart();
  await cart.save();

  sendSuccessResponse(res, 200, "Cart cleared successfully", {
    cart: {
      items: [],
      totalItems: 0,
      totalPrice: 0,
    },
  });
});


export const getCartItemCount = asyncHandler(async (req, res) => {
  const cart = await Cart.findOne({ user: req.id });

  const count = cart ? cart.totalItems : 0;

  sendSuccessResponse(res, 200, "Cart count fetched successfully", {
    count,
  });
});


export const validateCart = asyncHandler(async (req, res) => {
  const cart = await Cart.findOne({ user: req.id }).populate({
    path: "items.product",
    select: "name price stock isAvailable",
  });

  if (!cart || cart.items.length === 0) {
    return sendSuccessResponse(res, 200, "Cart is empty", {
      isValid: true,
      issues: [],
    });
  }

  const issues = [];
  let cartUpdated = false;

  // Check each item
  for (let i = cart.items.length - 1; i >= 0; i--) {
    const item = cart.items[i];

    if (!item.product) {
      // Product doesn't exist anymore
      cart.items.splice(i, 1);
      cartUpdated = true;
      issues.push({
        type: "product_removed",
        message: "A product in your cart is no longer available",
      });
      continue;
    }

    if (!item.product.isAvailable) {
      // Product is not available
      cart.items.splice(i, 1);
      cartUpdated = true;
      issues.push({
        type: "product_unavailable",
        product: item.product.name,
        message: `${item.product.name} is currently unavailable`,
      });
      continue;
    }

    if (item.product.stock < item.quantity) {
      // Insufficient stock
      if (item.product.stock === 0) {
        cart.items.splice(i, 1);
        cartUpdated = true;
        issues.push({
          type: "out_of_stock",
          product: item.product.name,
          message: `${item.product.name} is out of stock`,
        });
      } else {
        cart.items[i].quantity = item.product.stock;
        cartUpdated = true;
        issues.push({
          type: "quantity_reduced",
          product: item.product.name,
          oldQuantity: item.quantity,
          newQuantity: item.product.stock,
          message: `${item.product.name} quantity reduced to ${item.product.stock} (limited stock)`,
        });
      }
    }

    // Check if price has changed
    if (item.price !== item.product.price) {
      cart.items[i].price = item.product.price;
      cartUpdated = true;
      issues.push({
        type: "price_changed",
        product: item.product.name,
        oldPrice: item.price,
        newPrice: item.product.price,
        message: `${item.product.name} price has been updated`,
      });
    }
  }

  // Save cart if updated
  if (cartUpdated) {
    await cart.save();
  }

  sendSuccessResponse(res, 200, "Cart validation completed", {
    isValid: issues.length === 0,
    issues,
    cart: {
      items: cart.items,
      totalItems: cart.totalItems,
      totalPrice: cart.totalPrice,
    },
  });
});
