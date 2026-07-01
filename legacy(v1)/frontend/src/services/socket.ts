import { io, type Socket } from 'socket.io-client';

let socket: Socket | null = null;

/**
 * Returns the Socket.IO client singleton.
 * Creates one on first call but does NOT auto-connect — call `connectSocket()` explicitly.
 */
export function getSocket(): Socket {
  if (!socket) {
    socket = io('/', {
      auth: {
        token: localStorage.getItem('newsconnect_token'),
      },
      autoConnect: false,
    });
  }
  return socket;
}

/**
 * Ensure the socket is connected.
 * Refreshes the auth token each time in case the user logged in after the
 * socket instance was first created.
 */
export function connectSocket(): void {
  const s = getSocket();
  if (!s.connected) {
    s.auth = { token: localStorage.getItem('newsconnect_token') };
    s.connect();
  }
}

/**
 * Disconnect the socket and destroy the reference so a fresh one is created
 * on the next `getSocket()` call.
 */
export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
