import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAppDispatch } from "@/store";
import {
  setSocketConnected,
  incrementUnreadNotificationsCount,
} from "@/store/slices/uiSlice";
import { getSocket } from "@/services/socketService";
import { toast } from "sonner";

export function useSocketEvents(roomId, callbacks) {
  const queryClient = useQueryClient();
  const dispatch = useAppDispatch();

  useEffect(() => {
    const socket = getSocket();

    const handleConnect = () => {
      dispatch(setSocketConnected(true));
    };

    const handleDisconnect = () => {
      dispatch(setSocketConnected(false));
    };

    const handlePresenceOnline = ({ userId: _userId }) => {
      queryClient.invalidateQueries({ queryKey: ["friends"] });
      queryClient.invalidateQueries({ queryKey: ["rooms"] });
    };

    const handlePresenceOffline = ({ userId: _userId }) => {
      queryClient.invalidateQueries({ queryKey: ["friends"] });
      queryClient.invalidateQueries({ queryKey: ["rooms"] });
    };

    const handleFriendRequestSent = () => {
      queryClient.invalidateQueries({ queryKey: ["friends", "pending"] });
      toast.info("New friend request received!");
    };

    const handleFriendRequestAccepted = () => {
      queryClient.invalidateQueries({ queryKey: ["friends"] });
      queryClient.invalidateQueries({ queryKey: ["friends", "pending"] });
      toast.success("Friend request accepted!");
    };

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
        // Invalidate rooms to refresh message counts (Conversation count)
        queryClient.invalidateQueries({ queryKey: ["rooms"] });
        // Notify UI of new message creation
        if (callbacks?.onMessageCreated) {
          callbacks.onMessageCreated();
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

    const handleNotificationCreated = (notification) => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      dispatch(incrementUnreadNotificationsCount());
      toast(notification.title || "New Notification", {
        description: notification.body || "",
      });
    };

    const handleTypingStarted = (data) => {
      if (data.roomId === roomId && callbacks?.onTypingStarted) {
        callbacks.onTypingStarted(data);
      }
    };

    const handleTypingStopped = (data) => {
      if (data.roomId === roomId && callbacks?.onTypingStopped) {
        callbacks.onTypingStopped(data);
      }
    };

    const handleRoomActiveUsersUpdate = (data) => {
      // Invalidate rooms to refresh citizens joined in voice count
      queryClient.invalidateQueries({ queryKey: ["rooms"] });
      if (callbacks?.onRoomActiveUsersUpdate) {
        callbacks.onRoomActiveUsersUpdate(data);
      }
    };

    // Socket state listeners
    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);

    // Live features listeners
    socket.on("presence.online", handlePresenceOnline);
    socket.on("presence.offline", handlePresenceOffline);
    socket.on("friend.request.sent", handleFriendRequestSent);
    socket.on("friend.request.accepted", handleFriendRequestAccepted);
    socket.on("chat.message.created", handleMessageCreated);
    socket.on("chat.message.updated", handleMessageUpdated);
    socket.on("chat.message.deleted", handleMessageDeleted);
    socket.on("chat.message.restored", handleMessageRestored);
    socket.on("chat.message.reacted", handleMessageReacted);
    socket.on("notification.created", handleNotificationCreated);
    socket.on("chat.typing.started", handleTypingStarted);
    socket.on("chat.typing.stopped", handleTypingStopped);
    socket.on("room_active_users_update", handleRoomActiveUsersUpdate);

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("presence.online", handlePresenceOnline);
      socket.off("presence.offline", handlePresenceOffline);
      socket.off("friend.request.sent", handleFriendRequestSent);
      socket.off("friend.request.accepted", handleFriendRequestAccepted);
      socket.off("chat.message.created", handleMessageCreated);
      socket.off("chat.message.updated", handleMessageUpdated);
      socket.off("chat.message.deleted", handleMessageDeleted);
      socket.off("chat.message.restored", handleMessageRestored);
      socket.off("chat.message.reacted", handleMessageReacted);
      socket.off("notification.created", handleNotificationCreated);
      socket.off("chat.typing.started", handleTypingStarted);
      socket.off("chat.typing.stopped", handleTypingStopped);
      socket.off("room_active_users_update", handleRoomActiveUsersUpdate);
    };
  }, [roomId, queryClient, dispatch, callbacks]);
}
