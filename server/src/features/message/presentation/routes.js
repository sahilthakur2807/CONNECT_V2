import { Router } from "express";
import { z } from "zod";
import { authenticateJWT } from "../../../presentation/middlewares/AuthMiddleware.js";

// Repositories
import { MessageRepository } from "../infrastructure/repository/MessageRepository.js";
import { RoomRepository } from "../../room/infrastructure/repository/RoomRepository.js";
import { CommunityRepository } from "../../community/infrastructure/repository/CommunityRepository.js";
import { CommunityMembershipRepository } from "../../community/infrastructure/repository/CommunityMembershipRepository.js";

// Handlers
import {
  SendMessageCommand,
  SendMessageHandler,
  EditMessageCommand,
  EditMessageHandler,
  DeleteMessageCommand,
  DeleteMessageHandler,
  RestoreMessageCommand,
  RestoreMessageHandler,
} from "../application/commands/MessageCommands.js";
import {
  GetRoomMessagesQuery,
  GetRoomMessagesHandler,
  GetMessageRepliesQuery,
  GetMessageRepliesHandler,
} from "../application/queries/MessageQueries.js";

const messageRepo = new MessageRepository();
const roomRepo = new RoomRepository();
const communityRepo = new CommunityRepository();
const membershipRepo = new CommunityMembershipRepository();

const sendMessageHandler = new SendMessageHandler(
  messageRepo,
  roomRepo,
  communityRepo,
  membershipRepo,
);
const editMessageHandler = new EditMessageHandler(messageRepo);
const deleteMessageHandler = new DeleteMessageHandler(messageRepo);
const restoreMessageHandler = new RestoreMessageHandler(messageRepo);

const getRoomMessagesHandler = new GetRoomMessagesHandler(messageRepo);
const getMessageRepliesHandler = new GetMessageRepliesHandler(messageRepo);

export function createMessagesRouter() {
  const router = Router();

  // 1. Send message to room
  router.post(
    "/rooms/:roomId/messages",
    authenticateJWT,
    async (req, res, next) => {
      const schema = z.object({
        content: z.string().min(1).max(5000),
        clientMessageId: z.string().uuid().optional(),
        parentId: z.string().optional(),
      });

      try {
        const parsed = schema.parse(req.body);
        const command = new SendMessageCommand(
          req.user.id,
          req.params.roomId,
          parsed.content,
          parsed.clientMessageId,
          parsed.parentId,
          req.user.role,
        );

        const result = await sendMessageHandler.execute(command);
        res.status(201).json({ success: true, data: result });
      } catch (err) {
        next(err);
      }
    },
  );

  // 2. Get room messages (History with cursor-based pagination)
  router.get("/rooms/:roomId/messages", async (req, res, next) => {
    const schema = z.object({
      limit: z.preprocess(
        (val) => parseInt(val) || 50,
        z.number().min(1).max(100),
      ),
      cursor: z.string().optional(),
      direction: z.enum(["before", "after"]).default("before"),
    });

    try {
      const parsed = schema.parse(req.query);
      const query = new GetRoomMessagesQuery(
        req.params.roomId,
        parsed.limit,
        parsed.cursor,
        parsed.direction,
      );

      const result = await getRoomMessagesHandler.execute(query);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  });

  // 3. Edit message
  router.patch("/messages/:id", authenticateJWT, async (req, res, next) => {
    const schema = z.object({
      content: z.string().min(1).max(5000),
    });

    try {
      const parsed = schema.parse(req.body);
      const command = new EditMessageCommand(
        req.user.id,
        req.params.id,
        parsed.content,
      );

      const result = await editMessageHandler.execute(command);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  });

  // 4. Delete message (soft delete)
  router.delete("/messages/:id", authenticateJWT, async (req, res, next) => {
    try {
      const command = new DeleteMessageCommand(
        req.user.id,
        req.params.id,
        req.user.role,
      );

      await deleteMessageHandler.execute(command);
      res.json({ success: true, data: null });
    } catch (err) {
      next(err);
    }
  });

  // 5. Restore soft-deleted message
  router.post(
    "/messages/:id/restore",
    authenticateJWT,
    async (req, res, next) => {
      try {
        const command = new RestoreMessageCommand(req.user.id, req.params.id, req.user.role);

        const result = await restoreMessageHandler.execute(command);
        res.json({ success: true, data: result });
      } catch (err) {
        next(err);
      }
    },
  );

  // 6. Get message replies
  router.get("/messages/:id/replies", async (req, res, next) => {
    try {
      const query = new GetMessageRepliesQuery(req.params.id);
      const result = await getMessageRepliesHandler.execute(query);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
export const messagesRouter = createMessagesRouter();
