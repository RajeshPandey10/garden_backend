import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Product name is required"],
      trim: true,
      maxlength: [100, "Product name cannot exceed 100 characters"],
    },
    desc: {
      type: String,
      required: [true, "Product description is required"],
      maxlength: [1000, "Description cannot exceed 1000 characters"],
    },
    price: {
      type: Number,
      required: [true, "Price is required"],
      min: [0, "Price cannot be negative"],
    },
    oldPrice: {
      type: Number,
      min: [0, "Old price cannot be negative"],
      validate: {
        validator: function (value) {
          return !value || value >= this.price;
        },
        message: "Old price should be greater than or equal to current price",
      },
    },
    category: {
      type: String,
      required: [true, "Category is required"],
      enum: [
        "Plant",
        "Vase",
        "Seed",
        "Flower",
        "Vegetables",
        "Fertilizer",
        "Tools",
      ],
      trim: true,
    },
    subCategory: {
      type: String,
      trim: true,
    },
    image: {
      public_id: String,
      url: {
        type: String,
        required: [true, "Product image is required"],
      },
    },
    images: [
      {
        public_id: String,
        url: String,
      },
    ],
    stock: {
      type: Number,
      required: [true, "Stock quantity is required"],
      min: [0, "Stock cannot be negative"],
      default: 0,
    },
    isAvailable: {
      type: Boolean,
      default: true,
    },
    ratings: {
      average: {
        type: Number,
        default: 0,
        min: 0,
        max: 5,
      },
      count: {
        type: Number,
        default: 0,
      },
    },
    reviews: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        rating: {
          type: Number,
          required: true,
          min: 1,
          max: 5,
        },
        comment: {
          type: String,
          maxlength: [500, "Review comment cannot exceed 500 characters"],
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    tags: [String],
    featured: {
      type: Boolean,
      default: false,
    },
    trending: {
      type: Boolean,
      default: false,
    },
    isNew: {
      type: Boolean,
      default: true,
    },
    specifications: {
      type: Map,
      of: String,
    },
    careInstructions: {
      type: String,
      maxlength: [2000, "Care instructions cannot exceed 2000 characters"],
    },
    plantingTime: String,
    harvestTime: String,
    sunlightRequirement: {
      type: String,
      enum: ["Full Sun", "Partial Sun", "Shade"],
    },
    waterRequirement: {
      type: String,
      enum: ["Low", "Medium", "High"],
    },
    soilType: String,
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  }
);

// Index for better search performance
productSchema.index({ name: "text", desc: "text", category: "text" });
productSchema.index({ category: 1 });
productSchema.index({ price: 1 });
productSchema.index({ "ratings.average": -1 });
productSchema.index({ featured: -1 });
productSchema.index({ trending: -1 });
productSchema.index({ isNew: -1 });

// Virtual for discount percentage
productSchema.virtual("discountPercentage").get(function () {
  if (this.oldPrice && this.oldPrice > this.price) {
    return Math.round(((this.oldPrice - this.price) / this.oldPrice) * 100);
  }
  return 0;
});

// Update isNew based on creation date (products older than 30 days are not new)
productSchema.pre("save", function (next) {
  if (this.isNew && this.createdAt) {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    if (this.createdAt < thirtyDaysAgo) {
      this.isNew = false;
    }
  }
  next();
});

// Method to update ratings
productSchema.methods.updateRatings = function () {
  if (this.reviews.length > 0) {
    const totalRating = this.reviews.reduce(
      (sum, review) => sum + review.rating,
      0
    );
    this.ratings.average = totalRating / this.reviews.length;
    this.ratings.count = this.reviews.length;
  } else {
    this.ratings.average = 0;
    this.ratings.count = 0;
  }
};

// Set virtual fields to be included in JSON output
productSchema.set("toJSON", { virtuals: true });
productSchema.set("toObject", { virtuals: true });

const Product = mongoose.model("Product", productSchema);
export default Product;
