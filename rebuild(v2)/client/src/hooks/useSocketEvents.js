import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getSocket } from "@/services/socketService";

export function useSocketEvents(roomId, callbacks) {
  const queryClient = useQueryClient();
  const callbacksRef = useRef(callbacks);

  // Keep callbacks ref updated with latest closures on every render
  useEffect(() => {
    callbacksRef.current = callbacks;
  });

  useEffect(() => {
    if (!roomId) return;

    const socket = getSocket();

    const handleMessageCreated = (response) => {
      if (response.success && response.data) {
        const msg = response.data;
        if (msg.roomId === roomId) {
          // Direct cache update for instant display
          queryClient.setQueriesData({ queryKey: ["messages", roomId] }, (old) => {
            if (!old) return old;
            if (Array.isArray(old)) {
              if (old.some((m) => m.id === msg.id)) return old;
              return [...old, msg];
            }
            return old;
          });
          // Background query invalidation to ensure full sync
          queryClient.invalidateQueries({ queryKey: ["messages", roomId] });
        }
        // Notify UI of new message creation
        if (callbacksRef.current?.onMessageCreated) {
          callbacksRef.current.onMessageCreated();
        }
      }
    };

    const handleMessageUpdated = (response) => {
      if (response.success && response.data) {
        const msg = response.data;
        if (msg.roomId === roomId) {
          queryClient.setQueriesData({ queryKey: ["messages", roomId] }, (old) => {
            if (!old) return old;
            if (Array.isArray(old)) {
              return old.map((m) => (m.id === msg.id ? msg : m));
            }
            return old;
          });
          queryClient.invalidateQueries({ queryKey: ["messages", roomId] });
        }
      }
    };

    const handleMessageDeleted = (response) => {
      if (response.success && response.data) {
        const { id } = response.data;
        queryClient.setQueriesData({ queryKey: ["messages", roomId] }, (old) => {
          if (!old) return old;
          if (Array.isArray(old)) {
            return old.map((m) => (m.id === id ? { ...m, deleted: true } : m));
          }
          return old;
        });
        queryClient.invalidateQueries({ queryKey: ["messages", roomId] });
      }
    };

    const handleMessageRestored = (response) => {
      if (response.success && response.data) {
        const msg = response.data;
        if (msg.roomId === roomId) {
          queryClient.setQueriesData({ queryKey: ["messages", roomId] }, (old) => {
            if (!old) return old;
            if (Array.isArray(old)) {
              return old.map((m) => (m.id === msg.id ? msg : m));
            }
            return old;
          });
          queryClient.invalidateQueries({ queryKey: ["messages", roomId] });
        }
      }
    };

    const handleMessageReacted = (response) => {
      if (response.success && response.data) {
        const { messageId, reactionCounts } = response.data;
        queryClient.setQueriesData({ queryKey: ["messages", roomId] }, (old) => {
          if (!old) return old;
          if (Array.isArray(old)) {
            return old.map((m) =>
              m.id === messageId ? { ...m, reactionCounts } : m
            );
          }
          return old;
        });
      }
    };

    const handleTypingStarted = (data) => {
      if (data.roomId === roomId && callbacksRef.current?.onTypingStarted) {
        callbacksRef.current.onTypingStarted(data);
      }
    };

    const handleTypingStopped = (data) => {
      if (data.roomId === roomId && callbacksRef.current?.onTypingStopped) {
        callbacksRef.current.onTypingStopped(data);
      }
    };

    const handleRoomActiveUsersUpdate = (data) => {
      if (callbacksRef.current?.onRoomActiveUsersUpdate) {
        callbacksRef.current.onRoomActiveUsersUpdate(data);
      }
    };

    // Live features listeners (room-specific)
    socket.on("chat.message.created", handleMessageCreated);
    socket.on("chat.message.updated", handleMessageUpdated);
    socket.on("chat.message.deleted", handleMessageDeleted);
    socket.on("chat.message.restored", handleMessageRestored);
    socket.on("chat.message.reacted", handleMessageReacted);
    socket.on("chat.typing.started", handleTypingStarted);
    socket.on("chat.typing.stopped", handleTypingStopped);
    socket.on("room_active_users_update", handleRoomActiveUsersUpdate);

    return () => {
      socket.off("chat.message.created", handleMessageCreated);
      socket.off("chat.message.updated", handleMessageUpdated);
      socket.off("chat.message.deleted", handleMessageDeleted);
      socket.off("chat.message.restored", handleMessageRestored);
      socket.off("chat.message.reacted", handleMessageReacted);
      socket.off("chat.typing.started", handleTypingStarted);
      socket.off("chat.typing.stopped", handleTypingStopped);
      socket.off("room_active_users_update", handleRoomActiveUsersUpdate);
    };
  }, [roomId, queryClient]);
}
