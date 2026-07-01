import { SocketEventRegistry, type ISocketEventHandler, io, broadcastRoomActiveUsers } from '../../../../infrastructure/socket/SocketServer.js';
import { RoomRepository } from '../../../room/infrastructure/repository/RoomRepository.js';
import { CommunityMembershipRepository } from '../../../community/infrastructure/repository/CommunityMembershipRepository.js';
import { Logger } from '../../../../shared/logger/Logger.js';

export class RoomJoinHandler implements ISocketEventHandler {
  readonly eventName = 'chat.room.joined';

  constructor(
    private readonly roomRepo = new RoomRepository(),
    private readonly membershipRepo = new CommunityMembershipRepository()
  ) {}

  async handle(socket: any, data: any): Promise<void> {
    const user = socket.user;
    const { roomId } = data || {};

    if (!user || !roomId) {
      socket.emit('chat.room.joined.response', {
        success: false,
        error: { code: 'BAD_REQUEST', message: 'Missing roomId or user authorization' }
      });
      return;
    }

    try {
      const room = await this.roomRepo.findById(roomId);
      if (!room || room.deleted) {
        socket.emit('chat.room.joined.response', {
          success: false,
          error: { code: 'NOT_FOUND', message: 'Room not found' }
        });
        return;
      }

      // If room belongs to community, verify active non-banned membership
      if (room.communityId) {
        const membership = await this.membershipRepo.findMember(user.id, room.communityId);
        if (!membership || membership.banned) {
          socket.emit('chat.room.joined.response', {
            success: false,
            error: { code: 'FORBIDDEN', message: 'You are not a member of this community' }
          });
          return;
        }
      }

      socket.join(roomId);
      Logger.debug(`Socket ${socket.id} (User: ${user.id}) joined room channel: ${roomId}`);

      socket.emit('chat.room.joined.response', {
        success: true,
        data: { roomId }
      });

      // Broadcast active user list/count change
      await broadcastRoomActiveUsers(roomId);
    } catch (err: any) {
      Logger.error(`Error in chat.room.joined socket handler:`, err);
      socket.emit('chat.room.joined.response', {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Error joining room channel' }
      });
    }
  }
}

export class RoomLeaveHandler implements ISocketEventHandler {
  readonly eventName = 'chat.room.left';

  async handle(socket: any, data: any): Promise<void> {
    const { roomId } = data || {};
    if (roomId) {
      socket.leave(roomId);
      Logger.debug(`Socket ${socket.id} left room channel: ${roomId}`);
      socket.emit('chat.room.left.response', { success: true, data: { roomId } });

      // Broadcast active user list/count change
      await broadcastRoomActiveUsers(roomId);
    }
  }
}

// Register dynamic event handlers
SocketEventRegistry.register(new RoomJoinHandler());
SocketEventRegistry.register(new RoomLeaveHandler());
