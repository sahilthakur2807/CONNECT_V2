import express from "express";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { config } from "./config/index.js";
import { Logger } from "./shared/logger/Logger.js";
import { prisma } from "./infrastructure/db/PrismaClient.js";
import {
  initializeSocketServer,
  shutdownSocketServer,
} from "./infrastructure/socket/SocketServer.js";

// Middlewares
import cookieParser from "cookie-parser";
import { loggingMiddleware } from "./presentation/middlewares/LoggingMiddleware.js";
import { sanitizeRequestMiddleware } from "./presentation/middlewares/SanitizeMiddleware.js";
import { errorMiddleware } from "./presentation/middlewares/ErrorMiddleware.js";

// Features
import { authRouter } from "./features/auth/presentation/routes.js";
import { registerAuthAuditSubscribers } from "./features/auth/infrastructure/events/AuthAuditSubscribers.js";
import { communitiesRouter } from "./features/community/presentation/routes.js";
import { roomsRouter } from "./features/room/presentation/routes.js";
import { messagesRouter } from "./features/message/presentation/routes.js";
import { socialRouter } from "./features/social/presentation/routes.js";
import { moderationRouter } from "./features/moderation/presentation/routes.js";
import { discoveryRouter } from "./features/discovery/presentation/routes.js";
import { analyticsRouter } from "./features/analytics/presentation/routes.js";
import path from "path";
import { userRouter } from "./features/user/presentation/routes.js";

// Load dynamic event-driven analytics subscribers
import "./features/analytics/infrastructure/events/AnalyticsEventSubscribers.js";

// Load dynamic Socket.IO listeners
import "./features/message/presentation/socket/RoomJoinHandler.js";
import "./features/message/presentation/socket/TypingHandler.js";
import "./features/message/presentation/socket/ReactionHandler.js";

const app = express();

// Trust reverse proxies (Nginx, Cloudflare) for accurate client IP collection
app.set("trust proxy", 1);

// Standard HTTP Logger and correlation ID tracing
app.use(loggingMiddleware);

// Security Headers
app.use(
  helmet({
    contentSecurityPolicy: false, // Turn off CSP if frontend is served separately
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }),
);

// CORS Configuration
app.use(
  cors({
    origin: config.CORS_ORIGIN,
    credentials: true,
  }),
);

// Body Parsers & Input Sanitizers
app.use(cookieParser());
app.use(express.json());
app.use(sanitizeRequestMiddleware);

// Serve static uploads
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

// API Rate Limiting configuration
const globalRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 60 minutes window
  max: config.NODE_ENV === "development" ? 99999 : 300, // Highly relaxed limit in development
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: "TOO_MANY_REQUESTS",
      message: "Too many requests, please try again later.",
    },
  },
});
app.use("/api", globalRateLimiter);

// Root health check endpoint
app.get("/health", (req, res) => {
  res.json({
    success: true,
    data: {
      status: "OK",
      timestamp: new Date(),
      uptime: process.uptime(),
    },
  });
});

// Mounting place for router features (Phase 2 use-cases)
app.use("/api/auth", authRouter);
app.use("/api/communities", communitiesRouter);
app.use("/api/rooms", roomsRouter);
app.use("/api", messagesRouter);
app.use("/api", socialRouter);
app.use("/api", moderationRouter);
app.use("/api", discoveryRouter);
app.use("/api", analyticsRouter);
app.use("/api/users", userRouter);

// Standard global exception mappings
app.use(errorMiddleware);

// Register Event Subscribers
registerAuthAuditSubscribers();

// Reset all users to offline on server startup to clean up stale states from previous restarts/crashes
prisma.user
  .updateMany({
    where: { status: "online" },
    data: { status: "offline" },
  })
  .then(() => {
    Logger.info(
      "Successfully reset all stale online user statuses to offline.",
    );
  })
  .catch((err) => {
    Logger.error("Failed to reset stale user statuses on server boot:", err);
  });

// Boot server
const server = initializeSocketServer(app);

server.listen(config.PORT, "0.0.0.0", () => {
  Logger.info(
    `🚀 CONNECT Backend Server successfully booted on port ${config.PORT} [Environment: ${config.NODE_ENV}]`,
  );
});

// Graceful termination hooks
async function handleGracefulShutdown(signal) {
  Logger.warn(`Received signal ${signal}. Starting shutdown processes...`);
  // 1. Terminate WebSocket pool
  await shutdownSocketServer();

  // 2. Shut down Express server
  server.close(async () => {
    Logger.info("HTTP server has been closed.");

    // 3. Close prisma adapter pool
    try {
      await prisma.$disconnect();
      Logger.info("Prisma connection pool successfully closed.");
    } catch (e) {
      Logger.error("Failed to close Prisma connections during shutdown:", e);
    }

    Logger.warn("Graceful termination finished. Exiting process.");
    process.exit(0);
  });

  // Force shutdown if processes get stuck
  setTimeout(() => {
    Logger.error("Force shutdown triggered after timeout.");
    process.exit(1);
  }, 10000);
}

process.on("SIGTERM", () => handleGracefulShutdown("SIGTERM"));
process.on("SIGINT", () => handleGracefulShutdown("SIGINT"));

export default app;
