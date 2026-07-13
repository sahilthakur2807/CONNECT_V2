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

    const handleMessageCreatedGlobal = () => {
      // Invalidate rooms list to refresh unread indicators / active counts globally
      queryClient.invalidateQueries({ queryKey: ["rooms"] });
    };

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("presence.online", handlePresenceOnline);
    socket.on("presence.offline", handlePresenceOffline);
    socket.on("friend.request.sent", handleFriendRequestSent);
    socket.on("friend.request.accepted", handleFriendRequestAccepted);
    socket.on("notification.created", handleNotificationCreated);
    socket.on("chat.message.created", handleMessageCreatedGlobal);

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("presence.online", handlePresenceOnline);
      socket.off("presence.offline", handlePresenceOffline);
      socket.off("friend.request.sent", handleFriendRequestSent);
      socket.off("friend.request.accepted", handleFriendRequestAccepted);
      socket.off("notification.created", handleNotificationCreated);
      socket.off("chat.message.created", handleMessageCreatedGlobal);
    };
  }, [queryClient, dispatch]);
}
