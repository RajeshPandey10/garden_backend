
export const sendSuccessResponse = (
  res,
  statusCode = 200,
  message = "Success",
  data = null
) => {
  const response = {
    success: true,
    message,
    ...(data && { data }),
  };

  return res.status(statusCode).json(response);
};


export const sendErrorResponse = (
  res,
  statusCode = 500,
  message = "Internal Server Error",
  error = null
) => {
  const response = {
    success: false,
    message,
    ...(error && { error }),
  };

  return res.status(statusCode).json(response);
};


export const sendPaginatedResponse = (
  res,
  data,
  page,
  limit,
  total,
  message = "Data fetched successfully"
) => {
  const totalPages = Math.ceil(total / limit);

  const response = {
    success: true,
    message,
    data,
    pagination: {
      currentPage: page,
      totalPages,
      totalItems: total,
      itemsPerPage: limit,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
  };

  return res.status(200).json(response);
};


export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};


export const validateRequiredFields = (body, requiredFields) => {
  const missingFields = [];

  requiredFields.forEach((field) => {
    if (
      !body[field] ||
      (typeof body[field] === "string" && body[field].trim() === "")
    ) {
      missingFields.push(field);
    }
  });

  return {
    isValid: missingFields.length === 0,
    missingFields,
  };
};


export const getPaginationQuery = (page = 1, limit = 10) => {
  const skip = (page - 1) * limit;
  return { skip, limit: parseInt(limit) };
};


export const sanitizeInput = (input) => {
  if (typeof input !== "string") return input;

  return input
    .trim()
    .replace(/[<>]/g, "") // Remove potential HTML tags
    .replace(/javascript:/gi, "") // Remove javascript: protocols
    .substring(0, 1000); // Limit length
};
