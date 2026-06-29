export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly message: string,
    public readonly details: any = null
  ) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace(this, this.constructor);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found', details: any = null) {
    super(404, message, details);
  }
}

export class BadRequestError extends AppError {
  constructor(message = 'Bad request', details: any = null) {
    super(400, message, details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized', details: any = null) {
    super(401, message, details);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden', details: any = null) {
    super(403, message, details);
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Validation failed', details: any = null) {
    super(400, message, details);
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Resource conflict', details: any = null) {
    super(409, message, details);
  }
}
