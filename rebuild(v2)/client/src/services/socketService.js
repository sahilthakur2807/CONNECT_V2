import { io } from "socket.io-client";
import { store } from "@/store";

let socket = null;

export function getSocket() {
  if (!socket) {
    socket = io("/", {
      auth: (cb) => {
        cb({
          token: store.getState().auth.accessToken,
        });
      },
      autoConnect: false,
      transports: ["websocket", "polling"],
    });
  }
  return socket;
}

export function connectSocket() {
  const token = store.getState().auth.accessToken;
  if (!token) {
    return;
  }
  const s = getSocket();
  if (!s.connected) {
    s.connect();
  }
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
