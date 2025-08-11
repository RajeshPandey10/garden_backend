import Order from "../models/order.model.js";
import Cart from "../models/cart.model.js";
import Product from "../models/product.model.js";
import {
  sendSuccessResponse,
  sendErrorResponse,
  asyncHandler,
  validateRequiredFields,
  sendPaginatedResponse,
} from "../utils/api.utils.js";


export const createOrder = asyncHandler(async (req, res) => {
  const { shippingAddress, paymentMethod = "cod", notes } = req.body;

  // Validate required fields
  const validation = validateRequiredFields(req.body, ["shippingAddress"]);
  if (!validation.isValid) {
    return sendErrorResponse(
      res,
      400,
      `Missing required fields: ${validation.missingFields.join(", ")}`
    );
  }

  // Validate shipping address fields
  const addressValidation = validateRequiredFields(shippingAddress, [
    "fullName",
    "street",
    "city",
    "state",
    "zipCode",
    "phone",
  ]);
  if (!addressValidation.isValid) {
    return sendErrorResponse(
      res,
      400,
      `Missing shipping address fields: ${addressValidation.missingFields.join(
        ", "
      )}`
    );
  }

  // Get user's cart
  const cart = await Cart.findOne({ user: req.id }).populate({
    path: "items.product",
    select: "name price image stock isAvailable",
  });

  if (!cart || cart.items.length === 0) {
    return sendErrorResponse(res, 400, "Cart is empty");
  }

  // Validate cart items
  const orderItems = [];
  let subtotal = 0;

  for (const item of cart.items) {
    const product = item.product;

    // Check product availability
    if (!product || !product.isAvailable) {
      return sendErrorResponse(
        res,
        400,
        `Product ${product?.name || "Unknown"} is not available`
      );
    }

    // Check stock
    if (product.stock < item.quantity) {
      return sendErrorResponse(
        res,
        400,
        `Insufficient stock for ${product.name}. Available: ${product.stock}`
      );
    }

    // Prepare order item
    const orderItem = {
      product: product._id,
      name: product.name,
      image: product.image.url,
      quantity: item.quantity,
      price: product.price,
      total: product.price * item.quantity,
    };

    orderItems.push(orderItem);
    subtotal += orderItem.total;
  }

  // Calculate totals
  const shippingCost = 150; // Fixed shipping cost
  const tax = 0; // No tax for now
  const totalAmount = subtotal + shippingCost + tax;

  // Create order
  const orderData = {
    user: req.id,
    items: orderItems,
    shippingAddress: {
      ...shippingAddress,
      country: shippingAddress.country || "India",
    },
    paymentInfo: {
      method: paymentMethod,
      status: paymentMethod === "cod" ? "pending" : "pending",
      amount: totalAmount,
    },
    subtotal,
    shippingCost,
    tax,
    totalAmount,
    totalItems: cart.totalItems,
    notes: notes || "",
  };

  try {
    const order = await Order.create(orderData);

    // Update product stock
    for (const item of cart.items) {
      await Product.findByIdAndUpdate(item.product._id, {
        $inc: { stock: -item.quantity },
      });
    }

    // Clear cart
    cart.clearCart();
    await cart.save();

    // Populate order for response
    await order.populate({
      path: "items.product",
      select: "name category",
    });

    sendSuccessResponse(res, 201, "Order created successfully", {
      order,
    });
  } catch (error) {
    console.error("Error creating order:", error);
    return sendErrorResponse(res, 500, "Failed to create order");
  }
});


export const getUserOrders = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, status = "" } = req.query;

  // Build query
  const query = { user: req.id };
  if (status) {
    query.orderStatus = status;
  }

  // Calculate pagination
  const skip = (page - 1) * limit;

  // Get orders
  const orders = await Order.find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit))
    .populate({
      path: "items.product",
      select: "name category",
    });

  const total = await Order.countDocuments(query);

  sendPaginatedResponse(
    res,
    orders,
    parseInt(page),
    parseInt(limit),
    total,
    "Orders fetched successfully"
  );
});


export const getOrderById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const order = await Order.findById(id).populate({
    path: "items.product",
    select: "name category",
  });

  if (!order) {
    return sendErrorResponse(res, 404, "Order not found");
  }

  // Check if user owns the order (unless admin)
  if (req.user.role !== "admin" && order.user.toString() !== req.id) {
    return sendErrorResponse(res, 403, "Access denied");
  }

  sendSuccessResponse(res, 200, "Order fetched successfully", {
    order,
  });
});

// @desc    Cancel order
// @route   PUT /api/v1/order/:id/cancel
// @access  Private
export const cancelOrder = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { reason = "" } = req.body;

  const order = await Order.findById(id);
  if (!order) {
    return sendErrorResponse(res, 404, "Order not found");
  }

  // Check if user owns the order
  if (order.user.toString() !== req.id) {
    return sendErrorResponse(res, 403, "Access denied");
  }

  // Check if order can be cancelled
  if (!["pending", "confirmed"].includes(order.orderStatus)) {
    return sendErrorResponse(
      res,
      400,
      "Order cannot be cancelled at this stage"
    );
  }

  try {
    // Update order status
    order.updateStatus("cancelled", reason);
    await order.save();

    // Restore product stock
    for (const item of order.items) {
      await Product.findByIdAndUpdate(item.product, {
        $inc: { stock: item.quantity },
      });
    }

    sendSuccessResponse(res, 200, "Order cancelled successfully", {
      order,
    });
  } catch (error) {
    console.error("Error cancelling order:", error);
    return sendErrorResponse(res, 500, "Failed to cancel order");
  }
});


export const updateOrderStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status, trackingId, carrier, notes = "" } = req.body;

  // Validate required fields
  const validation = validateRequiredFields(req.body, ["status"]);
  if (!validation.isValid) {
    return sendErrorResponse(
      res,
      400,
      `Missing required fields: ${validation.missingFields.join(", ")}`
    );
  }

  const order = await Order.findById(id);
  if (!order) {
    return sendErrorResponse(res, 404, "Order not found");
  }

  try {
    // Update order status
    order.updateStatus(status, notes);

    // Update tracking info if provided
    if (trackingId && carrier) {
      order.trackingInfo = {
        trackingId,
        carrier,
        status: status,
        lastUpdate: new Date(),
      };
    }

    await order.save();

    sendSuccessResponse(res, 200, "Order status updated successfully", {
      order,
    });
  } catch (error) {
    if (error.message.includes("Cannot change status")) {
      return sendErrorResponse(res, 400, error.message);
    }
    console.error("Error updating order status:", error);
    return sendErrorResponse(res, 500, "Failed to update order status");
  }
});


export const getAllOrders = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 10,
    status = "",
    search = "",
    startDate = "",
    endDate = "",
  } = req.query;

  // Build query
  const query = {};

  if (status) {
    query.orderStatus = status;
  }

  if (search) {
    query.$or = [
      { orderId: { $regex: search, $options: "i" } },
      { "shippingAddress.fullName": { $regex: search, $options: "i" } },
      { "shippingAddress.phone": { $regex: search, $options: "i" } },
    ];
  }

  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = new Date(startDate);
    if (endDate) query.createdAt.$lte = new Date(endDate);
  }

  // Calculate pagination
  const skip = (page - 1) * limit;

  // Get orders
  const orders = await Order.find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit))
    .populate({
      path: "user",
      select: "fullName email phone",
    })
    .populate({
      path: "items.product",
      select: "name category",
    });

  const total = await Order.countDocuments(query);

  sendPaginatedResponse(
    res,
    orders,
    parseInt(page),
    parseInt(limit),
    total,
    "Orders fetched successfully"
  );
});


export const deleteOrder = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const order = await Order.findById(id);
  if (!order) {
    return sendErrorResponse(res, 404, "Order not found");
  }

  // Only allow deletion of cancelled orders
  if (order.orderStatus !== "cancelled") {
    return sendErrorResponse(res, 400, "Only cancelled orders can be deleted");
  }

  await Order.findByIdAndDelete(id);

  sendSuccessResponse(res, 200, "Order deleted successfully");
});


export const getOrderStats = asyncHandler(async (req, res) => {
  const { period = "30" } = req.query; // days

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - parseInt(period));

  const stats = await Order.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate },
      },
    },
    {
      $group: {
        _id: null,
        totalOrders: { $sum: 1 },
        totalRevenue: { $sum: "$totalAmount" },
        averageOrderValue: { $avg: "$totalAmount" },
        pendingOrders: {
          $sum: {
            $cond: [{ $eq: ["$orderStatus", "pending"] }, 1, 0],
          },
        },
        confirmedOrders: {
          $sum: {
            $cond: [{ $eq: ["$orderStatus", "confirmed"] }, 1, 0],
          },
        },
        shippedOrders: {
          $sum: {
            $cond: [{ $eq: ["$orderStatus", "shipped"] }, 1, 0],
          },
        },
        deliveredOrders: {
          $sum: {
            $cond: [{ $eq: ["$orderStatus", "delivered"] }, 1, 0],
          },
        },
        cancelledOrders: {
          $sum: {
            $cond: [{ $eq: ["$orderStatus", "cancelled"] }, 1, 0],
          },
        },
      },
    },
  ]);

  const result = stats[0] || {
    totalOrders: 0,
    totalRevenue: 0,
    averageOrderValue: 0,
    pendingOrders: 0,
    confirmedOrders: 0,
    shippedOrders: 0,
    deliveredOrders: 0,
    cancelledOrders: 0,
  };

  sendSuccessResponse(res, 200, "Order statistics fetched successfully", {
    stats: result,
    period: `${period} days`,
  });
});
