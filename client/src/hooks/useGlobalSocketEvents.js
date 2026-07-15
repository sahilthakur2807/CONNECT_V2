import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAppDispatch } from "@/store";
import {
  setSocketConnected,
  incrementUnreadNotificationsCount,
} from "@/store/slices/uiSlice";
import { getSocket } from "@/services/socketService";
import { toast } from "sonner";

export function useGlobalSocketEvents() {
  const queryClient = useQueryClient();
  const dispatch = useAppDispatch();

  useEffect(() => {
    const socket = getSocket();

    const handleConnect = () => {
      dispatch(setSocketConnected(true));
      queryClient.invalidateQueries({ queryKey: ["friends"] });
      queryClient.invalidateQueries({ queryKey: ["rooms"] });
    };

    const handleDisconnect = () => {
      dispatch(setSocketConnected(false));
    };

    const handlePresenceOnline = () => {
      queryClient.invalidateQueries({ queryKey: ["friends"] });
      queryClient.invalidateQueries({ queryKey: ["rooms"] });
    };

    const handlePresenceOffline = () => {
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

    const handleNotificationCreated = (notification) => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      dispatch(incrementUnreadNotificationsCount());
      toast(notification.title || "New Notification", {
        description: notification.body || "",
      });
    };

    const updateRoomInCache = (roomId, updateFn) => {
      const activeQueries = queryClient.getQueryCache().findAll({
        queryKey: ["rooms"]
      });

      activeQueries.forEach((query) => {
        queryClient.setQueryData(query.queryKey, (oldData) => {
          if (!oldData) return oldData;
          if (oldData.rooms) {
            return {
              ...oldData,
              rooms: oldData.rooms.map((room) =>
                room.id === roomId ? { ...room, ...updateFn(room) } : room
              ),
            };
          } else if (Array.isArray(oldData)) {
            return oldData.map((room) =>
              room.id === roomId ? { ...room, ...updateFn(room) } : room
            );
          }
          return oldData;
        });
      });
    };

    const handleMessageCreatedGlobal = () => {
      // Invalidate rooms list to refresh unread indicators / active counts globally
      queryClient.invalidateQueries({ queryKey: ["rooms"] });
    };

    const handleRoomMemberCountUpdated = ({ roomId, memberCount }) => {
      updateRoomInCache(roomId, (room) => ({
        _count: {
          ...room._count,
          members: memberCount,
        },
      }));
    };

    const handleRoomMessageCountUpdated = ({ roomId, messageCount }) => {
      updateRoomInCache(roomId, (room) => ({
        _count: {
          ...room._count,
          messages: messageCount,
        },
      }));
    };

    const handleRoomActiveCountUpdated = ({ roomId, activeCount }) => {
      updateRoomInCache(roomId, () => ({
        activeNow: activeCount,
      }));
    };

    const handleRoomDeleted = ({ roomId }) => {
      const queryKeys = [
        ["rooms", "trending"],
        ["rooms", "hot"],
        ["rooms", "new"],
      ];

      queryKeys.forEach((keyPrefix) => {
        queryClient.setQueriesData({ queryKey: keyPrefix }, (oldData) => {
          if (!oldData) return oldData;
          if (oldData.rooms) {
            return {
              ...oldData,
              rooms: oldData.rooms.filter((room) => room.id !== roomId),
              total: Math.max(0, oldData.total - (oldData.rooms.some(r => r.id === roomId) ? 1 : 0)),
            };
          } else if (Array.isArray(oldData)) {
            return oldData.filter((room) => room.id !== roomId);
          }
          return oldData;
        });
      });
    };

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("presence.online", handlePresenceOnline);
    socket.on("presence.offline", handlePresenceOffline);
    socket.on("friend.request.sent", handleFriendRequestSent);
    socket.on("friend.request.accepted", handleFriendRequestAccepted);
    socket.on("notification.created", handleNotificationCreated);
    socket.on("chat.message.created", handleMessageCreatedGlobal);
    socket.on("room.member.count.updated", handleRoomMemberCountUpdated);
    socket.on("room.message.count.updated", handleRoomMessageCountUpdated);
    socket.on("room.active.count.updated", handleRoomActiveCountUpdated);
    socket.on("room.deleted", handleRoomDeleted);

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("presence.online", handlePresenceOnline);
      socket.off("presence.offline", handlePresenceOffline);
      socket.off("friend.request.sent", handleFriendRequestSent);
      socket.off("friend.request.accepted", handleFriendRequestAccepted);
      socket.off("notification.created", handleNotificationCreated);
      socket.off("chat.message.created", handleMessageCreatedGlobal);
      socket.off("room.member.count.updated", handleRoomMemberCountUpdated);
      socket.off("room.message.count.updated", handleRoomMessageCountUpdated);
      socket.off("room.active.count.updated", handleRoomActiveCountUpdated);
      socket.off("room.deleted", handleRoomDeleted);
    };
  }, [queryClient, dispatch]);
}
