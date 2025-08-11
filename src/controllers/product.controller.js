import Product from "../models/product.model.js";
import {
  sendSuccessResponse,
  sendErrorResponse,
  asyncHandler,
  validateRequiredFields,
  sendPaginatedResponse,
} from "../utils/api.utils.js";
import {
  uploadToCloudinary,
  uploadMultipleToCloudinary,
  deleteFromCloudinary,
} from "../utils/cloudinary.utils.js";


export const getAllProducts = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 10,
    category = "",
    search = "",
    minPrice = 0,
    maxPrice = "",
    sortBy = "createdAt",
    sortOrder = "desc",
    featured = "",
    trending = "",
    isNew = "",
  } = req.query;

  // Build query
  const query = { isAvailable: true };

  if (category && category !== "All") {
    query.category = category;
  }

  if (search) {
    query.$or = [
      { name: { $regex: search, $options: "i" } },
      { desc: { $regex: search, $options: "i" } },
      { tags: { $in: [new RegExp(search, "i")] } },
    ];
  }

  if (minPrice || maxPrice) {
    query.price = {};
    if (minPrice) query.price.$gte = parseFloat(minPrice);
    if (maxPrice) query.price.$lte = parseFloat(maxPrice);
  }

  if (featured !== "") query.featured = featured === "true";
  if (trending !== "") query.trending = trending === "true";
  if (isNew !== "") query.isNew = isNew === "true";

  // Build sort
  const sort = {};
  sort[sortBy] = sortOrder === "desc" ? -1 : 1;

  // Calculate pagination
  const skip = (page - 1) * limit;

  // Get products
  const products = await Product.find(query)
    .sort(sort)
    .skip(skip)
    .limit(parseInt(limit))
    .select("-reviews");

  const total = await Product.countDocuments(query);

  sendPaginatedResponse(
    res,
    products,
    parseInt(page),
    parseInt(limit),
    total,
    "Products fetched successfully"
  );
});

export const getProductById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const product = await Product.findById(id).populate({
    path: "reviews.user",
    select: "fullName avatar",
  });

  if (!product) {
    return sendErrorResponse(res, 404, "Product not found");
  }

  sendSuccessResponse(res, 200, "Product fetched successfully", {
    product,
  });
});

// @desc    Add new product (Admin only)
// @route   POST /api/v1/product
// @access  Private/Admin
export const addProduct = asyncHandler(async (req, res) => {
  const {
    name,
    desc,
    price,
    oldPrice,
    category,
    subCategory,
    stock,
    tags,
    featured,
    trending,
    specifications,
    careInstructions,
    plantingTime,
    harvestTime,
    sunlightRequirement,
    waterRequirement,
    soilType,
  } = req.body;

  // Validate required fields
  const validation = validateRequiredFields(req.body, [
    "name",
    "desc",
    "price",
    "category",
    "stock",
  ]);
  if (!validation.isValid) {
    return sendErrorResponse(
      res,
      400,
      `Missing required fields: ${validation.missingFields.join(", ")}`
    );
  }

  // Check if main image is provided
  if (!req.files || !req.files.image) {
    return sendErrorResponse(res, 400, "Main product image is required");
  }

  try {
    // Upload main image
    const mainImageResult = await uploadToCloudinary(
      req.files.image[0].buffer,
      "garden/products",
      `product_${Date.now()}_main`
    );

    // Prepare product data
    const productData = {
      name,
      desc,
      price: parseFloat(price),
      category,
      stock: parseInt(stock),
      image: {
        public_id: mainImageResult.public_id,
        url: mainImageResult.url,
      },
      createdBy: req.id,
    };

    // Optional fields
    if (oldPrice) productData.oldPrice = parseFloat(oldPrice);
    if (subCategory) productData.subCategory = subCategory;
    if (tags) productData.tags = JSON.parse(tags);
    if (featured !== undefined) productData.featured = featured === "true";
    if (trending !== undefined) productData.trending = trending === "true";
    if (specifications)
      productData.specifications = new Map(
        Object.entries(JSON.parse(specifications))
      );
    if (careInstructions) productData.careInstructions = careInstructions;
    if (plantingTime) productData.plantingTime = plantingTime;
    if (harvestTime) productData.harvestTime = harvestTime;
    if (sunlightRequirement)
      productData.sunlightRequirement = sunlightRequirement;
    if (waterRequirement) productData.waterRequirement = waterRequirement;
    if (soilType) productData.soilType = soilType;

    // Upload additional images if provided
    if (req.files.images && req.files.images.length > 0) {
      const additionalImagesResults = await uploadMultipleToCloudinary(
        req.files.images,
        "garden/products"
      );
      productData.images = additionalImagesResults;
    }

    const product = await Product.create(productData);

    sendSuccessResponse(res, 201, "Product added successfully", {
      product,
    });
  } catch (error) {
    console.error("Error adding product:", error);
    return sendErrorResponse(res, 500, "Failed to add product");
  }
});

// @desc    Update product (Admin only)
// @route   PATCH /api/v1/product/:id
// @access  Private/Admin
export const updateProduct = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updateData = { ...req.body };

  // Find existing product
  const product = await Product.findById(id);
  if (!product) {
    return sendErrorResponse(res, 404, "Product not found");
  }

  try {
    // Handle main image update
    if (req.files && req.files.image) {
      // Delete old main image
      if (product.image && product.image.public_id) {
        await deleteFromCloudinary(product.image.public_id);
      }

      // Upload new main image
      const mainImageResult = await uploadToCloudinary(
        req.files.image[0].buffer,
        "garden/products",
        `product_${id}_main_${Date.now()}`
      );

      updateData.image = {
        public_id: mainImageResult.public_id,
        url: mainImageResult.url,
      };
    }

    // Handle additional images update
    if (req.files && req.files.images) {
      // Delete old additional images
      if (product.images && product.images.length > 0) {
        for (const img of product.images) {
          if (img.public_id) {
            await deleteFromCloudinary(img.public_id);
          }
        }
      }

      // Upload new additional images
      const additionalImagesResults = await uploadMultipleToCloudinary(
        req.files.images,
        "garden/products"
      );
      updateData.images = additionalImagesResults;
    }

    // Convert numeric fields
    if (updateData.price) updateData.price = parseFloat(updateData.price);
    if (updateData.oldPrice)
      updateData.oldPrice = parseFloat(updateData.oldPrice);
    if (updateData.stock) updateData.stock = parseInt(updateData.stock);

    // Convert JSON fields
    if (updateData.tags && typeof updateData.tags === "string") {
      updateData.tags = JSON.parse(updateData.tags);
    }
    if (
      updateData.specifications &&
      typeof updateData.specifications === "string"
    ) {
      updateData.specifications = new Map(
        Object.entries(JSON.parse(updateData.specifications))
      );
    }

    // Convert boolean fields
    if (updateData.featured !== undefined)
      updateData.featured = updateData.featured === "true";
    if (updateData.trending !== undefined)
      updateData.trending = updateData.trending === "true";
    if (updateData.isAvailable !== undefined)
      updateData.isAvailable = updateData.isAvailable === "true";

    const updatedProduct = await Product.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    });

    sendSuccessResponse(res, 200, "Product updated successfully", {
      product: updatedProduct,
    });
  } catch (error) {
    console.error("Error updating product:", error);
    return sendErrorResponse(res, 500, "Failed to update product");
  }
});


export const deleteProduct = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const product = await Product.findById(id);
  if (!product) {
    return sendErrorResponse(res, 404, "Product not found");
  }

  try {
    // Delete main image from cloudinary
    if (product.image && product.image.public_id) {
      await deleteFromCloudinary(product.image.public_id);
    }

    // Delete additional images from cloudinary
    if (product.images && product.images.length > 0) {
      for (const img of product.images) {
        if (img.public_id) {
          await deleteFromCloudinary(img.public_id);
        }
      }
    }

    // Delete product from database
    await Product.findByIdAndDelete(id);

    sendSuccessResponse(res, 200, "Product deleted successfully");
  } catch (error) {
    console.error("Error deleting product:", error);
    return sendErrorResponse(res, 500, "Failed to delete product");
  }
});


export const addProductReview = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { rating, comment } = req.body;

  // Validate required fields
  const validation = validateRequiredFields(req.body, ["rating"]);
  if (!validation.isValid) {
    return sendErrorResponse(
      res,
      400,
      `Missing required fields: ${validation.missingFields.join(", ")}`
    );
  }

  // Validate rating
  if (rating < 1 || rating > 5) {
    return sendErrorResponse(res, 400, "Rating must be between 1 and 5");
  }

  const product = await Product.findById(id);
  if (!product) {
    return sendErrorResponse(res, 404, "Product not found");
  }

  // Check if user already reviewed this product
  const existingReview = product.reviews.find(
    (review) => review.user.toString() === req.id
  );

  if (existingReview) {
    return sendErrorResponse(
      res,
      400,
      "You have already reviewed this product"
    );
  }

  // Add review
  product.reviews.push({
    user: req.id,
    rating: parseInt(rating),
    comment: comment || "",
  });

  // Update ratings
  product.updateRatings();

  await product.save();

  sendSuccessResponse(res, 201, "Review added successfully");
});


export const getFeaturedProducts = asyncHandler(async (req, res) => {
  const { limit = 8 } = req.query;

  const products = await Product.find({
    featured: true,
    isAvailable: true,
  })
    .sort({ createdAt: -1 })
    .limit(parseInt(limit))
    .select("-reviews");

  sendSuccessResponse(res, 200, "Featured products fetched successfully", {
    products,
  });
});


export const getTrendingProducts = asyncHandler(async (req, res) => {
  const { limit = 8 } = req.query;

  const products = await Product.find({
    trending: true,
    isAvailable: true,
  })
    .sort({ "ratings.average": -1 })
    .limit(parseInt(limit))
    .select("-reviews");

  sendSuccessResponse(res, 200, "Trending products fetched successfully", {
    products,
  });
});


export const getNewProducts = asyncHandler(async (req, res) => {
  const { limit = 8 } = req.query;

  const products = await Product.find({
    isNew: true,
    isAvailable: true,
  })
    .sort({ createdAt: -1 })
    .limit(parseInt(limit))
    .select("-reviews");

  sendSuccessResponse(res, 200, "New products fetched successfully", {
    products,
  });
});


export const searchProducts = asyncHandler(async (req, res) => {
  const { q, category, minPrice, maxPrice, limit = 20 } = req.query;

  if (!q) {
    return sendErrorResponse(res, 400, "Search query is required");
  }

  const query = {
    isAvailable: true,
    $or: [
      { name: { $regex: q, $options: "i" } },
      { desc: { $regex: q, $options: "i" } },
      { tags: { $in: [new RegExp(q, "i")] } },
    ],
  };

  if (category && category !== "All") {
    query.category = category;
  }

  if (minPrice || maxPrice) {
    query.price = {};
    if (minPrice) query.price.$gte = parseFloat(minPrice);
    if (maxPrice) query.price.$lte = parseFloat(maxPrice);
  }

  const products = await Product.find(query)
    .sort({ "ratings.average": -1, createdAt: -1 })
    .limit(parseInt(limit))
    .select("-reviews");

  sendSuccessResponse(res, 200, "Search results fetched successfully", {
    products,
    query: q,
    resultCount: products.length,
  });
});


export const updateProductStock = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { stock, operation = "set" } = req.body;

  if (stock === undefined) {
    return sendErrorResponse(res, 400, "Stock value is required");
  }

  const product = await Product.findById(id);
  if (!product) {
    return sendErrorResponse(res, 404, "Product not found");
  }

  let newStock;
  switch (operation) {
    case "add":
      newStock = product.stock + parseInt(stock);
      break;
    case "subtract":
      newStock = product.stock - parseInt(stock);
      break;
    case "set":
    default:
      newStock = parseInt(stock);
      break;
  }

  if (newStock < 0) {
    return sendErrorResponse(res, 400, "Stock cannot be negative");
  }

  product.stock = newStock;
  product.isAvailable = newStock > 0;
  await product.save();

  sendSuccessResponse(res, 200, "Product stock updated successfully", {
    product: {
      id: product._id,
      name: product.name,
      stock: product.stock,
      isAvailable: product.isAvailable,
    },
  });
});
