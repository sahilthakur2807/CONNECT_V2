export class AppError extends Error {
  constructor(statusCode, code, message, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.message = message;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace(this, this.constructor);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Resource not found", details = null) {
    super(404, "NOT_FOUND", message, details);
  }
}

export class BadRequestError extends AppError {
  constructor(message = "Bad request", details = null) {
    super(400, "BAD_REQUEST", message, details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Unauthorized", details = null) {
    super(401, "UNAUTHORIZED", message, details);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Forbidden", details = null) {
    super(403, "FORBIDDEN", message, details);
  }
}

export class ValidationError extends AppError {
  constructor(message = "Validation failed", details = null) {
    super(400, "VALIDATION_ERROR", message, details);
  }
}

export class ConflictError extends AppError {
  constructor(message = "Resource conflict", details = null) {
    super(409, "CONFLICT", message, details);
  }
}
