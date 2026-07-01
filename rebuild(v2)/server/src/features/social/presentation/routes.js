import { Router } from "express";
import { z } from "zod";
import { authenticateJWT } from "../../../presentation/middlewares/AuthMiddleware.js";

// Repositories
import { FriendshipRepository } from "../infrastructure/repository/FriendshipRepository.js";
import { BlockRepository } from "../infrastructure/repository/BlockRepository.js";
import { NotificationRepository } from "../infrastructure/repository/NotificationRepository.js";

// Handlers
import {
  SendFriendRequestHandler,
  AcceptFriendRequestHandler,
  RejectFriendRequestHandler,
  CancelFriendRequestCommand_Handler,
  RemoveFriendHandler,
  BlockUserHandler,
  UnblockUserHandler,
  MarkNotificationReadHandler,
  MarkAllNotificationsReadHandler,
  SendFriendRequestCommand,
  AcceptFriendRequestCommand,
  RejectFriendRequestCommand,
  CancelFriendRequestCommand,
  RemoveFriendCommand,
  BlockUserCommand,
  UnblockUserCommand,
  MarkNotificationReadCommand,
  MarkAllNotificationsReadCommand,
} from "../application/commands/SocialCommands.js";
import {
  GetFriendsQuery,
  GetFriendsHandler,
  GetPendingRequestsQuery,
  GetPendingRequestsHandler,
  GetNotificationsQuery,
  GetNotificationsHandler,
} from "../application/queries/SocialQueries.js";

const friendshipRepo = new FriendshipRepository();
const blockRepo = new BlockRepository();
const notificationRepo = new NotificationRepository();

const sendFriendRequestHandler = new SendFriendRequestHandler(
  friendshipRepo,
  blockRepo,
  notificationRepo,
);
const acceptFriendRequestHandler = new AcceptFriendRequestHandler(
  friendshipRepo,
  notificationRepo,
);
const rejectFriendRequestHandler = new RejectFriendRequestHandler(
  friendshipRepo,
);
const cancelFriendRequestHandler = new CancelFriendRequestCommand_Handler(
  friendshipRepo,
);
const removeFriendHandler = new RemoveFriendHandler(friendshipRepo);
const blockUserHandler = new BlockUserHandler(blockRepo, friendshipRepo);
const unblockUserHandler = new UnblockUserHandler(blockRepo);
const markNotificationReadHandler = new MarkNotificationReadHandler(
  notificationRepo,
);
const markAllNotificationsReadHandler = new MarkAllNotificationsReadHandler(
  notificationRepo,
);

const getFriendsHandler = new GetFriendsHandler(friendshipRepo);
const getPendingRequestsHandler = new GetPendingRequestsHandler(friendshipRepo);
const getNotificationsHandler = new GetNotificationsHandler(notificationRepo);

export function createSocialRouter() {
  const router = Router();

  // 1. Send Friend Request
  router.post("/friends/requests", authenticateJWT, async (req, res, next) => {
    const schema = z.object({ targetUserId: z.string().min(1) });
    try {
      const parsed = schema.parse(req.body);
      const command = new SendFriendRequestCommand(
        req.user.id,
        parsed.targetUserId,
      );
      const result = await sendFriendRequestHandler.execute(command);
      res.status(201).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  });

  // 2. Accept Friend Request
  router.post(
    "/friends/requests/:id/accept",
    authenticateJWT,
    async (req, res, next) => {
      try {
        const command = new AcceptFriendRequestCommand(
          req.user.id,
          req.params.id,
        );
        const result = await acceptFriendRequestHandler.execute(command);
        res.json({ success: true, data: result });
      } catch (err) {
        next(err);
      }
    },
  );

  // 3. Reject Friend Request
  router.post(
    "/friends/requests/:id/reject",
    authenticateJWT,
    async (req, res, next) => {
      try {
        const command = new RejectFriendRequestCommand(
          req.user.id,
          req.params.id,
        );
        await rejectFriendRequestHandler.execute(command);
        res.json({ success: true, data: null });
      } catch (err) {
        next(err);
      }
    },
  );

  // 4. Cancel Friend Request
  router.delete(
    "/friends/requests/:id",
    authenticateJWT,
    async (req, res, next) => {
      try {
        const command = new CancelFriendRequestCommand(
          req.user.id,
          req.params.id,
        );
        await cancelFriendRequestHandler.execute(command);
        res.json({ success: true, data: null });
      } catch (err) {
        next(err);
      }
    },
  );

  // 5. Remove Friend
  router.delete(
    "/friends/:friendId",
    authenticateJWT,
    async (req, res, next) => {
      try {
        const command = new RemoveFriendCommand(
          req.user.id,
          req.params.friendId,
        );
        await removeFriendHandler.execute(command);
        res.json({ success: true, data: null });
      } catch (err) {
        next(err);
      }
    },
  );

  // 6. Block User
  router.post("/blocks/:userId", authenticateJWT, async (req, res, next) => {
    try {
      const command = new BlockUserCommand(req.user.id, req.params.userId);
      const result = await blockUserHandler.execute(command);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  });

  // 7. Unblock User
  router.delete("/blocks/:userId", authenticateJWT, async (req, res, next) => {
    try {
      const command = new UnblockUserCommand(req.user.id, req.params.userId);
      await unblockUserHandler.execute(command);
      res.json({ success: true, data: null });
    } catch (err) {
      next(err);
    }
  });

  // 8. Get Friends List
  router.get("/friends", authenticateJWT, async (req, res, next) => {
    try {
      const query = new GetFriendsQuery(req.user.id);
      const result = await getFriendsHandler.execute(query);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  });

  // 9. Get Pending Incoming Requests
  router.get("/friends/pending", authenticateJWT, async (req, res, next) => {
    try {
      const query = new GetPendingRequestsQuery(req.user.id);
      const result = await getPendingRequestsHandler.execute(query);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  });

  // 10. Get Notifications
  router.get("/notifications", authenticateJWT, async (req, res, next) => {
    const schema = z.object({
      limit: z.preprocess(
        (val) => parseInt(val) || 20,
        z.number().min(1).max(100),
      ),
      cursor: z.string().optional(),
    });

    try {
      const parsed = schema.parse(req.query);
      const query = new GetNotificationsQuery(
        req.user.id,
        parsed.limit,
        parsed.cursor,
      );
      const result = await getNotificationsHandler.execute(query);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  });

  // 11. Mark Notification Read
  router.patch(
    "/notifications/:id/read",
    authenticateJWT,
    async (req, res, next) => {
      try {
        const command = new MarkNotificationReadCommand(
          req.user.id,
          req.params.id,
        );
        const result = await markNotificationReadHandler.execute(command);
        res.json({ success: true, data: result });
      } catch (err) {
        next(err);
      }
    },
  );

  // 12. Mark All Notifications Read
  router.post(
    "/notifications/read-all",
    authenticateJWT,
    async (req, res, next) => {
      try {
        const command = new MarkAllNotificationsReadCommand(req.user.id);
        await markAllNotificationsReadHandler.execute(command);
        res.json({ success: true, data: null });
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}
export const socialRouter = createSocialRouter();
