import { SocketEventRegistry, type ISocketEventHandler } from '../../../../infrastructure/socket/SocketServer.js';
import { Logger } from '../../../../shared/logger/Logger.js';

export class TypingStartedHandler implements ISocketEventHandler {
  readonly eventName = 'chat.typing.started';

  handle(socket: any, data: any): void {
    const user = socket.user;
    const { roomId } = data || {};

    if (!user || !roomId) return;

    // Broadcast typing event to other sockets in the room channel
    socket.to(roomId).emit('chat.typing.started', {
      roomId,
      userId: user.id,
      username: user.username
    });
    Logger.debug(`User ${user.username} started typing in room: ${roomId}`);
  }
}

export class TypingStoppedHandler implements ISocketEventHandler {
  readonly eventName = 'chat.typing.stopped';

  handle(socket: any, data: any): void {
    const user = socket.user;
    const { roomId } = data || {};

    if (!user || !roomId) return;

    // Broadcast typing stop event to other sockets in the room channel
    socket.to(roomId).emit('chat.typing.stopped', {
      roomId,
      userId: user.id,
      username: user.username
    });
    Logger.debug(`User ${user.username} stopped typing in room: ${roomId}`);
  }
}

// Register dynamic event handlers
SocketEventRegistry.register(new TypingStartedHandler());
SocketEventRegistry.register(new TypingStoppedHandler());
