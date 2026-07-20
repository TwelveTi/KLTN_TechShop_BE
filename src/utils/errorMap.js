const errorMap = {
  validation: {
    names: ["SequelizeValidationError"],
    statusCode: 400,
    getMessage: (error) => error.errors?.[0]?.message || "Validation error",
  },
  duplicate: {
    names: ["SequelizeUniqueConstraintError"],
    statusCode: 400,
    getMessage: (error) => error.errors?.[0]?.message || "Duplicate data",
  },
  invalidRelation: {
    names: ["SequelizeForeignKeyConstraintError"],
    statusCode: 400,
    message: "Invalid related data",
  },
  database: {
    names: ["SequelizeDatabaseError"],
    statusCode: 500,
    message: "Database error",
  },
  invalidToken: {
    names: ["JsonWebTokenError"],
    statusCode: 401,
    message: "Invalid access token",
  },
  expiredToken: {
    names: ["TokenExpiredError"],
    statusCode: 401,
    message: "Access token expired",
  },
  upload: {
    names: ["MulterError"],
    statusCode: 400,
    getMessage: (error) => error.message || "Upload file error",
  },
};

const getErrorConfig = (errorName) => {
  return Object.values(errorMap).find((config) => config.names.includes(errorName));
};

module.exports = {
  errorMap,
  getErrorConfig,
};
