import { EventBus } from '../../../../shared/event-bus/EventBus.js';
import { activityFeedRepository } from '../repository/ActivityFeedRepository.js';
import { reputationLogRepository } from '../repository/ReputationLogRepository.js';
import { prisma } from '../../../../infrastructure/db/PrismaClient.js';
import { Logger } from '../../../../shared/logger/Logger.js';

const REPUTATION_RULESETS: Record<string, number> = {
  'auth.user.registered': 10,
  'community.created': 50,
  'membership.created': 10,
  'message.created': 5,
  'friend.request.accepted': 15
};

export function registerAnalyticsSubscribers() {
  // 1. User Registered
  EventBus.subscribe('auth.user.registered', async (event: any) => {
    try {
      await activityFeedRepository.create({
        type: 'user.registered',
        user: { connect: { id: event.userId } },
        metadata: JSON.stringify({ username: event.username })
      });
      await reputationLogRepository.logAward(event.userId, REPUTATION_RULESETS['auth.user.registered'], 'auth.user.registered');
    } catch (err) {
      Logger.error('AnalyticsSubscriber: failed to process auth.user.registered:', err);
    }
  });

  // 2. Community Created
  EventBus.subscribe('community.created', async (event: any) => {
    try {
      await activityFeedRepository.create({
        type: 'community.created',
        user: { connect: { id: event.ownerId } },
        community: { connect: { id: event.communityId } }
      });
      await reputationLogRepository.logAward(event.ownerId, REPUTATION_RULESETS['community.created'], 'community.created');
    } catch (err) {
      Logger.error('AnalyticsSubscriber: failed to process community.created:', err);
    }
  });

  // 3. Community Joined
  EventBus.subscribe('membership.created', async (event: any) => {
    try {
      await activityFeedRepository.create({
        type: 'community.joined',
        user: { connect: { id: event.userId } },
        community: { connect: { id: event.communityId } }
      });
      await reputationLogRepository.logAward(event.userId, REPUTATION_RULESETS['membership.created'], 'membership.joined');
    } catch (err) {
      Logger.error('AnalyticsSubscriber: failed to process membership.created:', err);
    }
  });

  // 4. Room Created
  EventBus.subscribe('room.created', async (event: any) => {
    try {
      const room = await prisma.room.findUnique({
        where: { id: event.roomId },
        select: { communityId: true }
      });
      await activityFeedRepository.create({
        type: 'room.created',
        user: { connect: { id: event.creatorId } },
        room: { connect: { id: event.roomId } },
        ...(room?.communityId ? { community: { connect: { id: room.communityId } } } : {})
      });
    } catch (err) {
      Logger.error('AnalyticsSubscriber: failed to process room.created:', err);
    }
  });

  // 5. Message Posted
  EventBus.subscribe('message.created', async (event: any) => {
    try {
      const message = await prisma.message.findUnique({
        where: { id: event.messageId },
        include: { room: true }
      });
      if (message) {
        await activityFeedRepository.create({
          type: 'message.posted',
          user: { connect: { id: message.userId } },
          room: { connect: { id: message.roomId } },
          ...(message.room.communityId ? { community: { connect: { id: message.room.communityId } } } : {}),
          metadata: JSON.stringify({ messageId: message.id })
        });
        await reputationLogRepository.logAward(message.userId, REPUTATION_RULESETS['message.created'], 'message.posted');
      }
    } catch (err) {
      Logger.error('AnalyticsSubscriber: failed to process message.created:', err);
    }
  });

  // 6. Friend Request Accepted
  EventBus.subscribe('friend.request.accepted', async (event: any) => {
    try {
      await activityFeedRepository.create({
        type: 'friend.accepted',
        user: { connect: { id: event.userId } },
        metadata: JSON.stringify({ friendId: event.friendId })
      });
      await activityFeedRepository.create({
        type: 'friend.accepted',
        user: { connect: { id: event.friendId } },
        metadata: JSON.stringify({ friendId: event.userId })
      });
      await reputationLogRepository.logAward(event.userId, REPUTATION_RULESETS['friend.request.accepted'], 'friend.request.accepted');
      await reputationLogRepository.logAward(event.friendId, REPUTATION_RULESETS['friend.request.accepted'], 'friend.request.accepted');
    } catch (err) {
      Logger.error('AnalyticsSubscriber: failed to process friend.request.accepted:', err);
    }
  });
}

// Auto-trigger registration of hooks upon execution of side-effect imports
registerAnalyticsSubscribers();
