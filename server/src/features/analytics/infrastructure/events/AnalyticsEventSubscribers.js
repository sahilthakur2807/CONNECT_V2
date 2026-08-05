import { EventBus } from "../../../../shared/event-bus/EventBus.js";
import { activityFeedRepository } from "../repository/ActivityFeedRepository.js";
import { reputationLogRepository } from "../repository/ReputationLogRepository.js";
import { prisma } from "../../../../infrastructure/db/PrismaClient.js";
import { Logger } from "../../../../shared/logger/Logger.js";
import { io } from "../../../../infrastructure/socket/SocketServer.js";

const REPUTATION_RULESETS = {
  "auth.user.registered": 10,
  "community.created": 50,
  "membership.created": 10,
  "message.created": 0,
  "friend.request.accepted": 15,
};

async function broadcastStats() {
  try {
    if (!prisma || !prisma.user || !prisma.room || !prisma.message || !prisma.community) {
      Logger.debug("AnalyticsSubscriber: prisma or model properties undefined (probably mocked in tests). Skipping stats broadcast.");
      return;
    }
    const [totalUsers, totalRooms, totalMessages, totalCommunities] = await Promise.all([
      prisma.user.count({ where: { role: { not: "banned" } } }),
      prisma.room.count({ where: { deleted: false } }),
      prisma.message.count({ where: { deleted: false } }),
      prisma.community.count({ where: { deleted: false } }),
    ]);
    if (io) {
      io.emit("stats_update", {
        totalUsers,
        totalRooms,
        totalMessages,
        totalCommunities,
      });
      Logger.debug(`AnalyticsEventSubscribers: Broadcasted stats_update: rooms=${totalRooms}, messages=${totalMessages}, communities=${totalCommunities}, users=${totalUsers}`);
    }
  } catch (err) {
    Logger.error("AnalyticsSubscriber: failed to broadcast stats update:", err);
  }
}

export function registerAnalyticsSubscribers() {
  // 1. User Registered
  EventBus.subscribe("auth.user.registered", async (event) => {
    try {
      await activityFeedRepository.create({
        type: "user.registered",
        user: { connect: { id: event.userId } },
        metadata: JSON.stringify({ username: event.username }),
      });
      await reputationLogRepository.logAward(
        event.userId,
        REPUTATION_RULESETS["auth.user.registered"],
        "auth.user.registered",
      );
      if (io) {
        io.to(event.userId).emit("user.reputation.updated", { userId: event.userId });
      }
      await broadcastStats();
    } catch (err) {
      Logger.error(
        "AnalyticsSubscriber: failed to process auth.user.registered:",
        err,
      );
    }
  });

  // 2. Community Created
  EventBus.subscribe("community.created", async (event) => {
    try {
      await activityFeedRepository.create({
        type: "community.created",
        user: { connect: { id: event.ownerId } },
        community: { connect: { id: event.communityId } },
      });
      await reputationLogRepository.logAward(
        event.ownerId,
        REPUTATION_RULESETS["community.created"],
        "community.created",
      );
      if (io) {
        io.to(event.ownerId).emit("user.reputation.updated", { userId: event.ownerId });
      }
      await broadcastStats();
    } catch (err) {
      Logger.error(
        "AnalyticsSubscriber: failed to process community.created:",
        err,
      );
    }
  });

  // 3. Community Joined
  EventBus.subscribe("membership.created", async (event) => {
    try {
      await activityFeedRepository.create({
        type: "community.joined",
        user: { connect: { id: event.userId } },
        community: { connect: { id: event.communityId } },
      });
      await reputationLogRepository.logAward(
        event.userId,
        REPUTATION_RULESETS["membership.created"],
        "membership.joined",
      );
      if (io) {
        io.to(event.userId).emit("user.reputation.updated", { userId: event.userId });
      }
    } catch (err) {
      Logger.error(
        "AnalyticsSubscriber: failed to process membership.created:",
        err,
      );
    }
  });

  // 4. Room Created
  EventBus.subscribe("room.created", async (event) => {
    try {
      const room = await prisma.room.findUnique({
        where: { id: event.roomId },
        select: { communityId: true },
      });
      await activityFeedRepository.create({
        type: "room.created",
        user: { connect: { id: event.creatorId } },
        room: { connect: { id: event.roomId } },
        ...(room?.communityId
          ? { community: { connect: { id: room.communityId } } }
          : {}),
      });
      // Award 50 EXP to the room creator
      await reputationLogRepository.logAward(
        event.creatorId,
        50,
        "room.created",
      );
      if (io) {
        io.to(event.creatorId).emit("user.reputation.updated", { userId: event.creatorId });
      }
      await broadcastStats();
    } catch (err) {
      Logger.error("AnalyticsSubscriber: failed to process room.created:", err);
    }
  });

  // 5. Message Posted
  EventBus.subscribe("message.created", async (event) => {
    try {
      const message = await prisma.message.findUnique({
        where: { id: event.messageId },
        include: { room: true },
      });
      if (message) {
        await activityFeedRepository.create({
          type: "message.posted",
          user: { connect: { id: message.userId } },
          room: { connect: { id: message.roomId } },
          ...(message.room.communityId
            ? { community: { connect: { id: message.room.communityId } } }
            : {}),
          metadata: JSON.stringify({ messageId: message.id }),
        });

        await broadcastStats();
      }
    } catch (err) {
      Logger.error(
        "AnalyticsSubscriber: failed to process message.created:",
        err,
      );
    }
  });

  // 6. Friend Request Accepted
  EventBus.subscribe("friend.request.accepted", async (event) => {
    try {
      await activityFeedRepository.create({
        type: "friend.accepted",
        user: { connect: { id: event.userId } },
        metadata: JSON.stringify({ friendId: event.friendId }),
      });
      await activityFeedRepository.create({
        type: "friend.accepted",
        user: { connect: { id: event.friendId } },
        metadata: JSON.stringify({ friendId: event.userId }),
      });
      await reputationLogRepository.logAward(
        event.userId,
        REPUTATION_RULESETS["friend.request.accepted"],
        "friend.request.accepted",
      );
      await reputationLogRepository.logAward(
        event.friendId,
        REPUTATION_RULESETS["friend.request.accepted"],
        "friend.request.accepted",
      );
      if (io) {
        io.to(event.userId).emit("user.reputation.updated", { userId: event.userId });
        io.to(event.friendId).emit("user.reputation.updated", { userId: event.friendId });
      }
    } catch (err) {
      Logger.error(
        "AnalyticsSubscriber: failed to process friend.request.accepted:",
        err,
      );
    }
  });

  // 7. Room Deleted
  EventBus.subscribe("room.deleted", async (event) => {
    try {
      const room = await prisma.room.findFirst({
        where: { id: event.roomId },
        select: { createdById: true },
      });
      if (room) {
        await reputationLogRepository.logAward(
          room.createdById,
          -50,
          "room.deleted",
        );
        if (io) {
          io.to(room.createdById).emit("user.reputation.updated", { userId: room.createdById });
        }
      }
      await broadcastStats();
    } catch (err) {
      Logger.error("AnalyticsSubscriber: failed to process room.deleted:", err);
    }
  });

  // 8. Message Deleted
  EventBus.subscribe("message.deleted", async (event) => {
    try {
      await broadcastStats();
    } catch (err) {
      Logger.error("AnalyticsSubscriber: failed to process message.deleted:", err);
    }
  });

  // 9. Community Deleted
  EventBus.subscribe("community.deleted", async (event) => {
    try {
      await broadcastStats();
    } catch (err) {
      Logger.error("AnalyticsSubscriber: failed to process community.deleted:", err);
    }
  });
}

// Auto-trigger registration of hooks upon execution of side-effect imports
registerAnalyticsSubscribers();
