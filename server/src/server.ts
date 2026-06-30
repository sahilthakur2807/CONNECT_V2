import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config();
import morgan from 'morgan';

// Infrastructure
import { prisma } from '@infrastructure/db/PrismaClient.js';
import { createSocketServer } from '@infrastructure/socket/SocketServer.js';

// Middlewares
import { optionalJWT } from '@presentation/middlewares/AuthMiddleware.js';
import { sanitizeResponseMiddleware } from '@presentation/middlewares/SanitizeMiddleware.js';
import { errorMiddleware } from '@presentation/middlewares/ErrorMiddleware.js';

// Features - Auth
import {
  RegisterHandler,
  LoginHandler,
  UpdateProfileHandler,
  UpdateAvatarHandler,
  LogoutHandler
} from '@features/auth/application/commands/AuthCommands.js';
import { createAuthRouter } from '@features/auth/presentation/routes.js';

// Features - Community
import {
  CreateCommunityHandler,
  JoinCommunityHandler,
  LeaveCommunityHandler,
  DeleteCommunityHandler
} from '@features/community/application/commands/CommunityCommands.js';
import {
  GetCommunitiesHandler,
  GetCommunityByIdHandler,
  GetCommunityMembersHandler
} from '@features/community/application/queries/CommunityQueries.js';
import { createCommunitiesRouter } from '@features/community/presentation/routes.js';

// Features - Room
import {
  CreateRoomHandler,
  JoinRoomHandler,
  LeaveRoomHandler,
  CreateRoomMessageHandler,
  DeleteRoomHandler
} from '@features/room/application/commands/RoomCommands.js';
import {
  GetRoomsHandler,
  GetTrendingRoomsHandler,
  GetHotRoomsHandler,
  GetNewRoomsHandler,
  GetRoomByIdHandler,
  GetRoomMessagesHandler
} from '@features/room/application/queries/RoomQueries.js';
import { createRoomsRouter } from '@features/room/presentation/routes.js';

// Features - Message
import {
  EditMessageHandler,
  DeleteMessageHandler,
  CreateReplyHandler,
  ToggleReactionHandler
} from '@features/message/application/commands/MessageCommands.js';
import { GetTrendingMessagesHandler } from '@features/message/application/queries/MessageQueries.js';
import { createMessagesRouter } from '@features/message/presentation/routes.js';

// Features - Notification
import {
  MarkAllNotificationsReadHandler,
  MarkNotificationReadHandler
} from '@features/notification/application/commands/NotificationCommands.js';
import { GetNotificationsHandler } from '@features/notification/application/queries/NotificationQueries.js';
import { createNotificationsRouter } from '@features/notification/presentation/routes.js';

// Features - Report
import {
  CreateReportHandler,
  UpdateReportHandler
} from '@features/report/application/commands/ReportCommands.js';
import { GetReportsHandler } from '@features/report/application/queries/ReportQueries.js';
import { createReportsRouter } from '@features/report/presentation/routes.js';

// Features - Search
import { SearchQueryHandler } from '@features/search/application/queries/SearchQuery.js';
import { createSearchRouter } from '@features/search/presentation/routes.js';

// Features - Stats
import { GetStatsQueryHandler } from '@features/stats/application/queries/GetStatsQuery.js';
import { createStatsRouter } from '@features/stats/presentation/routes.js';

// Features - Activity
import { GetRecentActivityHandler } from '@features/activity/application/queries/GetRecentActivityQuery.js';
import { createActivityRouter } from '@features/activity/presentation/routes.js';

// Features - Admin
import { UpdateSettingsHandler } from '@features/admin/application/commands/UpdateSettingsCommand.js';
import { GetSettingsQueryHandler } from '@features/admin/application/queries/GetSettingsQuery.js';
import { createAdminRouter } from '@features/admin/presentation/routes.js';

// Features - User
import {
  AddFriendHandler,
  AcceptFriendHandler,
  RejectFriendHandler,
  RemoveFriendHandler,
  UpdateUserRoleHandler,
  DeleteUserHandler
} from '@features/user/application/commands/UserCommands.js';
import {
  GetUsersHandler,
  GetActiveUsersHandler,
  GetActiveFriendsHandler,
  SearchUsersByUsernameHandler,
  GetUserProfileHandler,
  GetUserMessagesHandler,
  GetUserRoomsHandler,
  GetPendingFriendRequestsHandler
} from '@features/user/application/queries/UserQueries.js';
import { createUsersRouter } from '@features/user/presentation/routes.js';

// Features - Extension
import {
  LookupRoomHandler,
  CreateExtensionRoomHandler,
  JoinExtensionRoomHandler
} from '@features/extension/application/commands/ExtensionCommands.js';
import { createExtensionRouter } from '@features/extension/presentation/routes.js';

const app = express();
app.set('trust proxy', 1);
const PORT = Number(process.env.PORT || 3000);

// Basic HTTP logging
app.use(morgan('dev'));

// Security Headers & Rate Limiting
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: false,
}));
app.use(cors());
app.use(express.json());

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // Limit each IP to 300 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' }
});

app.use('/api', apiLimiter);
app.use('/api', optionalJWT, sanitizeResponseMiddleware);

// Serve static files from the Vite build directory and uploads
app.use(express.static(path.resolve(process.cwd(), '../frontend/dist')));
app.use('/uploads', express.static(path.resolve(process.cwd(), 'uploads')));

// --- Composition Root (DI Instantiations) ---

// Auth
const registerHandler = new RegisterHandler();
const loginHandler = new LoginHandler();
const updateProfileHandler = new UpdateProfileHandler();
const updateAvatarHandler = new UpdateAvatarHandler();
const logoutHandler = new LogoutHandler();

// Community
const createCommunityHandler = new CreateCommunityHandler();
const joinCommunityHandler = new JoinCommunityHandler();
const leaveCommunityHandler = new LeaveCommunityHandler();
const deleteCommunityHandler = new DeleteCommunityHandler();
const getCommunitiesHandler = new GetCommunitiesHandler();
const getCommunityByIdHandler = new GetCommunityByIdHandler();
const getCommunityMembersHandler = new GetCommunityMembersHandler();

// Room
const createRoomHandler = new CreateRoomHandler();
const joinRoomHandler = new JoinRoomHandler();
const leaveRoomHandler = new LeaveRoomHandler();
const createRoomMessageHandler = new CreateRoomMessageHandler();
const deleteRoomHandler = new DeleteRoomHandler();
const getRoomsHandler = new GetRoomsHandler();
const getTrendingRoomsHandler = new GetTrendingRoomsHandler();
const getHotRoomsHandler = new GetHotRoomsHandler();
const getNewRoomsHandler = new GetNewRoomsHandler();
const getRoomByIdHandler = new GetRoomByIdHandler();
const getRoomMessagesHandler = new GetRoomMessagesHandler();

// Message
const editMessageHandler = new EditMessageHandler();
const deleteMessageHandler = new DeleteMessageHandler();
const createReplyHandler = new CreateReplyHandler();
const toggleReactionHandler = new ToggleReactionHandler();
const getTrendingMessagesHandler = new GetTrendingMessagesHandler();

// Notification
const markAllReadHandler = new MarkAllNotificationsReadHandler();
const markSingleReadHandler = new MarkNotificationReadHandler();
const getNotificationsHandler = new GetNotificationsHandler();

// Report
const createReportHandler = new CreateReportHandler();
const updateReportHandler = new UpdateReportHandler();
const getReportsHandler = new GetReportsHandler();

// Search
const searchQueryHandler = new SearchQueryHandler();

// Stats
const getStatsQueryHandler = new GetStatsQueryHandler();

// Activity
const getRecentActivityHandler = new GetRecentActivityHandler();

// Admin
const getSettingsQueryHandler = new GetSettingsQueryHandler();
const updateSettingsHandler = new UpdateSettingsHandler();

// User
const addFriendHandler = new AddFriendHandler();
const acceptFriendHandler = new AcceptFriendHandler();
const rejectFriendHandler = new RejectFriendHandler();
const removeFriendHandler = new RemoveFriendHandler();
const updateUserRoleHandler = new UpdateUserRoleHandler();
const deleteUserHandler = new DeleteUserHandler();
const getUsersHandler = new GetUsersHandler();
const getActiveUsersHandler = new GetActiveUsersHandler();
const getActiveFriendsHandler = new GetActiveFriendsHandler();
const searchUsersByUsernameHandler = new SearchUsersByUsernameHandler();
const getUserProfileHandler = new GetUserProfileHandler();
const getUserMessagesHandler = new GetUserMessagesHandler();
const getUserRoomsHandler = new GetUserRoomsHandler();
const getPendingFriendRequestsHandler = new GetPendingFriendRequestsHandler();

// Extension
const lookupRoomHandler = new LookupRoomHandler();
const createExtensionRoomHandler = new CreateExtensionRoomHandler();
const joinExtensionRoomHandler = new JoinExtensionRoomHandler();

// --- Mount API Routers ---
app.use('/api/auth', createAuthRouter(registerHandler, loginHandler, updateProfileHandler, updateAvatarHandler, logoutHandler));
app.use('/api/communities', createCommunitiesRouter(createCommunityHandler, joinCommunityHandler, leaveCommunityHandler, deleteCommunityHandler, getCommunitiesHandler, getCommunityByIdHandler, getCommunityMembersHandler));
app.use('/api/rooms', createRoomsRouter(createRoomHandler, joinRoomHandler, leaveRoomHandler, createRoomMessageHandler, deleteRoomHandler, getRoomsHandler, getTrendingRoomsHandler, getHotRoomsHandler, getNewRoomsHandler, getRoomByIdHandler, getRoomMessagesHandler));
app.use('/api/messages', createMessagesRouter(editMessageHandler, deleteMessageHandler, createReplyHandler, toggleReactionHandler, getTrendingMessagesHandler));
app.use('/api/users', createUsersRouter(addFriendHandler, acceptFriendHandler, rejectFriendHandler, removeFriendHandler, updateUserRoleHandler, deleteUserHandler, getUsersHandler, getActiveUsersHandler, getActiveFriendsHandler, searchUsersByUsernameHandler, getUserProfileHandler, getUserMessagesHandler, getUserRoomsHandler, getPendingFriendRequestsHandler));
app.use('/api/notifications', createNotificationsRouter(markAllReadHandler, markSingleReadHandler, getNotificationsHandler));
app.use('/api/reports', createReportsRouter(createReportHandler, updateReportHandler, getReportsHandler));
app.use('/api/search', createSearchRouter(searchQueryHandler));
app.use('/api/stats', createStatsRouter(getStatsQueryHandler));
app.use('/api/activity', createActivityRouter(getRecentActivityHandler));
app.use('/api/admin', createAdminRouter(getSettingsQueryHandler, updateSettingsHandler));
app.use('/api/extension', createExtensionRouter(lookupRoomHandler, createExtensionRoomHandler, joinExtensionRoomHandler));

// Global Error Handling Middleware
app.use(errorMiddleware);

// Initialize HTTP & Socket Server
const httpServer = createSocketServer(app);

// Ensure 13835.yps@gmail.com is set to superadmin in the database on start
try {
  await prisma.user.updateMany({
    where: { email: '13835.yps@gmail.com' },
    data: { role: 'superadmin' }
  });
} catch (e) {
  console.error('Failed to update superadmin role on start:', e);
}

// Start Server
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`);
});

// Handle client-side routing - MUST be after all other routes
app.use((req, res) => {
  res.sendFile(path.resolve(process.cwd(), '../frontend/dist', 'index.html'));
});
