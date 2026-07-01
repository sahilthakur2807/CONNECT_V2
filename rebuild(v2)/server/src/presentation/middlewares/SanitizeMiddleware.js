import { sanitizeRequestData } from "../../shared/utils/Sanitizer.js";

export const sanitizeRequestMiddleware = (req, res, next) => {
  if (req.body && typeof req.body === "object") {
    req.body = sanitizeRequestData(req.body);
  }
  next();
};
