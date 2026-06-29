import { Router } from 'express';
import { authenticateJWT, optionalJWT, type AuthenticatedRequest } from '@presentation/middlewares/AuthMiddleware.js';
import { AddFriendCommand, UpdateUserRoleCommand, DeleteUserCommand } from '../application/commands/UserCommands.js';
import type { AddFriendHandler, UpdateUserRoleHandler, DeleteUserHandler } from '../application/commands/UserCommands.js';
import { GetUsersQuery, GetActiveUsersQuery, GetActiveFriendsQuery, SearchUsersByUsernameQuery, GetUserProfileQuery, GetUserMessagesQuery, GetUserRoomsQuery } from '../application/queries/UserQueries.js';
import type { GetUsersHandler, GetActiveUsersHandler, GetActiveFriendsHandler, SearchUsersByUsernameHandler, GetUserProfileHandler, GetUserMessagesHandler, GetUserRoomsHandler } from '../application/queries/UserQueries.js';

export function createUsersRouter(
  addFriendHandler: AddFriendHandler,
  updateUserRoleHandler: UpdateUserRoleHandler,
  deleteUserHandler: DeleteUserHandler,
  getUsersHandler: GetUsersHandler,
  getActiveUsersHandler: GetActiveUsersHandler,
  getActiveFriendsHandler: GetActiveFriendsHandler,
  searchUsersByUsernameHandler: SearchUsersByUsernameHandler,
  getUserProfileHandler: GetUserProfileHandler,
  getUserMessagesHandler: GetUserMessagesHandler,
  getUserRoomsHandler: GetUserRoomsHandler
): Router {
  const router = Router();

  // Get users
  router.get('/', optionalJWT, async (req: AuthenticatedRequest, res, next) => {
    try {
      const query = new GetUsersQuery(req.user?.role);
      const result = await getUsersHandler.execute(query);
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  // Get active users
  router.get('/active', optionalJWT, async (req: AuthenticatedRequest, res, next) => {
    try {
      const query = new GetActiveUsersQuery(req.user?.role);
      const result = await getActiveUsersHandler.execute(query);
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  // Get all friends
  router.get('/active-friends', authenticateJWT, async (req: AuthenticatedRequest, res, next) => {
    try {
      const query = new GetActiveFriendsQuery(req.user!.id);
      const result = await getActiveFriendsHandler.execute(query);
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  // Search users by username
  router.get('/search-by-username', authenticateJWT, async (req: AuthenticatedRequest, res, next) => {
    try {
      const { q } = req.query;
      const query = new SearchUsersByUsernameQuery(req.user!.id, q as string);
      const result = await searchUsersByUsernameHandler.execute(query);
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  // Add friend
  router.post('/add-friend', authenticateJWT, async (req: AuthenticatedRequest, res, next) => {
    try {
      const { friendId } = req.body;
      if (!friendId) {
        return res.status(400).json({ error: 'friendId is required' });
      }
      const command = new AddFriendCommand(req.user!.id, friendId);
      await addFriendHandler.execute(command);
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  });

  // Get user profile by ID
  router.get('/:id', async (req, res, next) => {
    try {
      const query = new GetUserProfileQuery(req.params.id as string);
      const result = await getUserProfileHandler.execute(query);
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  // Get user messages
  router.get('/:id/messages', async (req, res, next) => {
    try {
      const query = new GetUserMessagesQuery(req.params.id as string);
      const result = await getUserMessagesHandler.execute(query);
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  // Get user rooms
  router.get('/:id/rooms', optionalJWT, async (req: AuthenticatedRequest, res, next) => {
    try {
      const query = new GetUserRoomsQuery(req.params.id as string, req.user?.id);
      const result = await getUserRoomsHandler.execute(query);
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  // Update user role
  router.patch('/:id/role', authenticateJWT, async (req: AuthenticatedRequest, res, next) => {
    try {
      const { role } = req.body;
      if (!role) {
        return res.status(400).json({ error: 'Role is required' });
      }
      const command = new UpdateUserRoleCommand(
        req.params.id as string,
        role,
        req.user!.id,
        req.user!.role
      );
      const result = await updateUserRoleHandler.execute(command);
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  // Purge user identity
  router.delete('/:id', authenticateJWT, async (req: AuthenticatedRequest, res, next) => {
    try {
      const command = new DeleteUserCommand(
        req.params.id as string,
        req.user!.id,
        req.user!.role
      );
      await deleteUserHandler.execute(command);
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
