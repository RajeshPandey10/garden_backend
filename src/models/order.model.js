import mongoose from "mongoose";

const orderItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    image: {
      type: String,
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: [1, "Quantity must be at least 1"],
    },
    price: {
      type: Number,
      required: true,
      min: [0, "Price cannot be negative"],
    },
    total: {
      type: Number,
      required: true,
      min: [0, "Total cannot be negative"],
    },
  },
  {
    _id: false,
  }
);

const shippingAddressSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: true,
      trim: true,
    },
    street: {
      type: String,
      required: true,
      trim: true,
    },
    city: {
      type: String,
      required: true,
      trim: true,
    },
    state: {
      type: String,
      required: true,
      trim: true,
    },
    zipCode: {
      type: String,
      required: true,
      trim: true,
    },
    country: {
      type: String,
      required: true,
      trim: true,
      default: "India",
    },
    phone: {
      type: String,
      required: true,
      trim: true,
    },
  },
  {
    _id: false,
  }
);

const paymentInfoSchema = new mongoose.Schema(
  {
    method: {
      type: String,
      required: true,
      enum: ["card", "cod", "upi", "netbanking"],
      default: "cod",
    },
    status: {
      type: String,
      required: true,
      enum: ["pending", "paid", "failed", "refunded"],
      default: "pending",
    },
    transactionId: String,
    paidAt: Date,
    amount: {
      type: Number,
      required: true,
      min: [0, "Amount cannot be negative"],
    },
  },
  {
    _id: false,
  }
);

const orderSchema = new mongoose.Schema(
  {
    orderId: {
      type: String,
      required: true,
      unique: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    items: [orderItemSchema],
    shippingAddress: {
      type: shippingAddressSchema,
      required: true,
    },
    paymentInfo: {
      type: paymentInfoSchema,
      required: true,
    },
    orderStatus: {
      type: String,
      required: true,
      enum: [
        "pending",
        "confirmed",
        "processing",
        "shipped",
        "delivered",
        "cancelled",
      ],
      default: "pending",
    },
    subtotal: {
      type: Number,
      required: true,
      min: [0, "Subtotal cannot be negative"],
    },
    shippingCost: {
      type: Number,
      required: true,
      min: [0, "Shipping cost cannot be negative"],
      default: 150,
    },
    tax: {
      type: Number,
      default: 0,
      min: [0, "Tax cannot be negative"],
    },
    totalAmount: {
      type: Number,
      required: true,
      min: [0, "Total amount cannot be negative"],
    },
    totalItems: {
      type: Number,
      required: true,
      min: [1, "Order must have at least one item"],
    },
    expectedDelivery: {
      type: Date,
    },
    deliveredAt: {
      type: Date,
    },
    shippedAt: {
      type: Date,
    },
    cancelledAt: {
      type: Date,
    },
    cancellationReason: {
      type: String,
      maxlength: [500, "Cancellation reason cannot exceed 500 characters"],
    },
    trackingInfo: {
      trackingId: String,
      carrier: String,
      status: String,
      lastUpdate: Date,
    },
    notes: {
      type: String,
      maxlength: [1000, "Notes cannot exceed 1000 characters"],
    },
  },
  {
    timestamps: true,
  }
);

// Index for better query performance
orderSchema.index({ user: 1, createdAt: -1 });
orderSchema.index({ orderId: 1 });
orderSchema.index({ orderStatus: 1 });
orderSchema.index({ createdAt: -1 });

// Generate order ID before saving
orderSchema.pre("save", function (next) {
  if (!this.orderId) {
    const timestamp = Date.now().toString(36);
    const randomStr = Math.random().toString(36).substring(2, 8);
    this.orderId = `ORD-${timestamp}${randomStr}`.toUpperCase();
  }

  // Set expected delivery date (7 days from now)
  if (!this.expectedDelivery && this.orderStatus === "confirmed") {
    const deliveryDate = new Date();
    deliveryDate.setDate(deliveryDate.getDate() + 7);
    this.expectedDelivery = deliveryDate;
  }

  next();
});

// Method to update order status
orderSchema.methods.updateStatus = function (newStatus, notes = "") {
  const validTransitions = {
    pending: ["confirmed", "cancelled"],
    confirmed: ["processing", "cancelled"],
    processing: ["shipped", "cancelled"],
    shipped: ["delivered"],
    delivered: [],
    cancelled: [],
  };

  if (!validTransitions[this.orderStatus].includes(newStatus)) {
    throw new Error(
      `Cannot change status from ${this.orderStatus} to ${newStatus}`
    );
  }

  this.orderStatus = newStatus;

  switch (newStatus) {
    case "shipped":
      this.shippedAt = new Date();
      break;
    case "delivered":
      this.deliveredAt = new Date();
      this.paymentInfo.status = "paid";
      this.paymentInfo.paidAt = new Date();
      break;
    case "cancelled":
      this.cancelledAt = new Date();
      this.cancellationReason = notes;
      break;
  }
};

// Method to calculate refund amount
orderSchema.methods.getRefundAmount = function () {
  if (this.orderStatus === "cancelled" && this.paymentInfo.status === "paid") {
    // If shipped, no refund
    if (this.shippedAt) return 0;

    // Full refund if cancelled before shipping
    return this.totalAmount;
  }
  return 0;
};

// Virtual for order age in days
orderSchema.virtual("orderAge").get(function () {
  return Math.floor((Date.now() - this.createdAt) / (1000 * 60 * 60 * 24));
});

// Set virtual fields to be included in JSON output
orderSchema.set("toJSON", { virtuals: true });
orderSchema.set("toObject", { virtuals: true });

const Order = mongoose.model("Order", orderSchema);
export default Order;
