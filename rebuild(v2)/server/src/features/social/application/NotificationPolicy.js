export class NotificationPolicy {
  /**
   * Checks if a user is permitted to read or mutate a notification.
   * Only the recipient can view or alter the notification status.
   */
  static canMutateNotification(userId, recipientId) {
    return userId === recipientId;
  }
}
