import User from "../models/user.model.js";
import Product from "../models/product.model.js";
import Order from "../models/order.model.js";
import {
  sendSuccessResponse,
  sendErrorResponse,
  asyncHandler,
} from "../utils/api.utils.js";

n
export const getDashboardStats = asyncHandler(async (req, res) => {
  const { period = "30" } = req.query; // days

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - parseInt(period));

  // Get basic counts
  const [
    totalUsers,
    totalProducts,
    totalOrders,
    newUsers,
    newOrders,
    orderStats,
    revenueStats,
    topProducts,
  ] = await Promise.all([
    // Total users
    User.countDocuments({ role: "user" }),

    // Total products
    Product.countDocuments(),

    // Total orders
    Order.countDocuments(),

    // New users in period
    User.countDocuments({
      role: "user",
      createdAt: { $gte: startDate },
    }),

    // New orders in period
    Order.countDocuments({
      createdAt: { $gte: startDate },
    }),

    // Order status breakdown
    Order.aggregate([
      {
        $group: {
          _id: "$orderStatus",
          count: { $sum: 1 },
        },
      },
    ]),

    // Revenue statistics
    Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
          orderStatus: { $ne: "cancelled" },
        },
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$totalAmount" },
          averageOrderValue: { $avg: "$totalAmount" },
          totalOrdersCount: { $sum: 1 },
        },
      },
    ]),

    // Top selling products
    Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
          orderStatus: { $ne: "cancelled" },
        },
      },
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.product",
          totalSold: { $sum: "$items.quantity" },
          revenue: { $sum: "$items.total" },
          productName: { $first: "$items.name" },
        },
      },
      {
        $sort: { totalSold: -1 },
      },
      {
        $limit: 5,
      },
    ]),
  ]);

  // Format order stats
  const orderStatusCounts = {
    pending: 0,
    confirmed: 0,
    processing: 0,
    shipped: 0,
    delivered: 0,
    cancelled: 0,
  };

  orderStats.forEach((stat) => {
    orderStatusCounts[stat._id] = stat.count;
  });

  // Format revenue stats
  const revenue = revenueStats[0] || {
    totalRevenue: 0,
    averageOrderValue: 0,
    totalOrdersCount: 0,
  };

  // Calculate growth rates (simplified - comparing with previous period)
  const previousPeriodStart = new Date(startDate);
  previousPeriodStart.setDate(previousPeriodStart.getDate() - parseInt(period));

  const [previousUsers, previousOrders, previousRevenue] = await Promise.all([
    User.countDocuments({
      role: "user",
      createdAt: {
        $gte: previousPeriodStart,
        $lt: startDate,
      },
    }),

    Order.countDocuments({
      createdAt: {
        $gte: previousPeriodStart,
        $lt: startDate,
      },
    }),

    Order.aggregate([
      {
        $match: {
          createdAt: {
            $gte: previousPeriodStart,
            $lt: startDate,
          },
          orderStatus: { $ne: "cancelled" },
        },
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$totalAmount" },
        },
      },
    ]),
  ]);

  const prevRevenue = previousRevenue[0]?.totalRevenue || 0;

  // Calculate growth percentages
  const userGrowth =
    previousUsers > 0 ? ((newUsers - previousUsers) / previousUsers) * 100 : 0;
  const orderGrowth =
    previousOrders > 0
      ? ((newOrders - previousOrders) / previousOrders) * 100
      : 0;
  const revenueGrowth =
    prevRevenue > 0
      ? ((revenue.totalRevenue - prevRevenue) / prevRevenue) * 100
      : 0;

  const stats = {
    overview: {
      totalUsers,
      totalProducts,
      totalOrders,
      totalRevenue: revenue.totalRevenue,
    },
    growth: {
      newUsers,
      newOrders,
      userGrowth: Math.round(userGrowth * 100) / 100,
      orderGrowth: Math.round(orderGrowth * 100) / 100,
      revenueGrowth: Math.round(revenueGrowth * 100) / 100,
    },
    orders: {
      statusBreakdown: orderStatusCounts,
      averageOrderValue: Math.round(revenue.averageOrderValue * 100) / 100,
    },
    topProducts,
    period: `${period} days`,
  };

  sendSuccessResponse(res, 200, "Dashboard statistics fetched successfully", {
    stats,
  });
});

// @desc    Get new orders count
// @route   GET /api/v1/admin/orders/new
// @access  Private/Admin
export const getNewOrdersCount = asyncHandler(async (req, res) => {
  const twentyFourHoursAgo = new Date();
  twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

  const newOrdersCount = await Order.countDocuments({
    createdAt: { $gte: twentyFourHoursAgo },
    orderStatus: "pending",
  });

  sendSuccessResponse(res, 200, "New orders count fetched successfully", {
    count: newOrdersCount,
  });
});


export const getPendingOrdersCount = asyncHandler(async (req, res) => {
  const pendingOrdersCount = await Order.countDocuments({
    orderStatus: { $in: ["pending", "confirmed"] },
  });

  sendSuccessResponse(res, 200, "Pending orders count fetched successfully", {
    count: pendingOrdersCount,
  });
});


export const getRecentActivities = asyncHandler(async (req, res) => {
  const { limit = 10 } = req.query;

  // Get recent orders
  const recentOrders = await Order.find()
    .sort({ createdAt: -1 })
    .limit(parseInt(limit) / 2)
    .populate("user", "fullName email")
    .select("orderId orderStatus totalAmount createdAt user");

  // Get recent users
  const recentUsers = await User.find({ role: "user" })
    .sort({ createdAt: -1 })
    .limit(parseInt(limit) / 2)
    .select("fullName email createdAt");

  // Combine and format activities
  const activities = [
    ...recentOrders.map((order) => ({
      type: "order",
      id: order._id,
      title: `New order ${order.orderId}`,
      description: `Order placed by ${order.user.fullName}`,
      amount: order.totalAmount,
      status: order.orderStatus,
      timestamp: order.createdAt,
      user: order.user,
    })),
    ...recentUsers.map((user) => ({
      type: "user",
      id: user._id,
      title: "New user registration",
      description: `${user.fullName} joined`,
      timestamp: user.createdAt,
      user: {
        fullName: user.fullName,
        email: user.email,
      },
    })),
  ];

  // Sort by timestamp
  activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  sendSuccessResponse(res, 200, "Recent activities fetched successfully", {
    activities: activities.slice(0, parseInt(limit)),
  });
});


export const getSalesAnalytics = asyncHandler(async (req, res) => {
  const { period = "30", groupBy = "day" } = req.query;

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - parseInt(period));

  let groupFormat;
  switch (groupBy) {
    case "hour":
      groupFormat = {
        year: { $year: "$createdAt" },
        month: { $month: "$createdAt" },
        day: { $dayOfMonth: "$createdAt" },
        hour: { $hour: "$createdAt" },
      };
      break;
    case "day":
      groupFormat = {
        year: { $year: "$createdAt" },
        month: { $month: "$createdAt" },
        day: { $dayOfMonth: "$createdAt" },
      };
      break;
    case "week":
      groupFormat = {
        year: { $year: "$createdAt" },
        week: { $week: "$createdAt" },
      };
      break;
    case "month":
      groupFormat = {
        year: { $year: "$createdAt" },
        month: { $month: "$createdAt" },
      };
      break;
    default:
      groupFormat = {
        year: { $year: "$createdAt" },
        month: { $month: "$createdAt" },
        day: { $dayOfMonth: "$createdAt" },
      };
  }

  const salesData = await Order.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate },
        orderStatus: { $ne: "cancelled" },
      },
    },
    {
      $group: {
        _id: groupFormat,
        totalSales: { $sum: "$totalAmount" },
        totalOrders: { $sum: 1 },
        averageOrderValue: { $avg: "$totalAmount" },
      },
    },
    {
      $sort: { _id: 1 },
    },
  ]);

  sendSuccessResponse(res, 200, "Sales analytics fetched successfully", {
    salesData,
    period: `${period} days`,
    groupBy,
  });
});

export const getProductAnalytics = asyncHandler(async (req, res) => {
  const { period = "30" } = req.query;

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - parseInt(period));

  const [categoryAnalytics, topSellingProducts, lowStockProducts] =
    await Promise.all([
      // Category wise sales
      Order.aggregate([
        {
          $match: {
            createdAt: { $gte: startDate },
            orderStatus: { $ne: "cancelled" },
          },
        },
        { $unwind: "$items" },
        {
          $lookup: {
            from: "products",
            localField: "items.product",
            foreignField: "_id",
            as: "productInfo",
          },
        },
        { $unwind: "$productInfo" },
        {
          $group: {
            _id: "$productInfo.category",
            totalSales: { $sum: "$items.total" },
            totalQuantity: { $sum: "$items.quantity" },
            productCount: { $addToSet: "$items.product" },
          },
        },
        {
          $project: {
            category: "$_id",
            totalSales: 1,
            totalQuantity: 1,
            uniqueProducts: { $size: "$productCount" },
          },
        },
        {
          $sort: { totalSales: -1 },
        },
      ]),

      // Top selling products
      Order.aggregate([
        {
          $match: {
            createdAt: { $gte: startDate },
            orderStatus: { $ne: "cancelled" },
          },
        },
        { $unwind: "$items" },
        {
          $group: {
            _id: "$items.product",
            totalSold: { $sum: "$items.quantity" },
            totalRevenue: { $sum: "$items.total" },
            productName: { $first: "$items.name" },
          },
        },
        {
          $sort: { totalSold: -1 },
        },
        {
          $limit: 10,
        },
      ]),

      // Low stock products
      Product.find({
        stock: { $lte: 10 },
        isAvailable: true,
      })
        .select("name stock category price")
        .sort({ stock: 1 })
        .limit(10),
    ]);

  sendSuccessResponse(res, 200, "Product analytics fetched successfully", {
    categoryAnalytics,
    topSellingProducts,
    lowStockProducts,
    period: `${period} days`,
  });
});


export const updateUserRole = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { role } = req.body;

  if (!["user", "admin"].includes(role)) {
    return sendErrorResponse(
      res,
      400,
      "Invalid role. Must be 'user' or 'admin'"
    );
  }

  const user = await User.findByIdAndUpdate(
    id,
    { role },
    { new: true, runValidators: true }
  ).select("-password -refreshToken");

  if (!user) {
    return sendErrorResponse(res, 404, "User not found");
  }

  sendSuccessResponse(res, 200, "User role updated successfully", {
    user,
  });
});


export const toggleUserStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const user = await User.findById(id);
  if (!user) {
    return sendErrorResponse(res, 404, "User not found");
  }

  user.isActive = !user.isActive;
  await user.save();

  sendSuccessResponse(
    res,
    200,
    `User ${user.isActive ? "activated" : "deactivated"} successfully`,
    {
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        isActive: user.isActive,
      },
    }
  );
});
