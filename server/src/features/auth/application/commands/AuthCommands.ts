import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '@infrastructure/db/PrismaClient.js';
import { broadcastStatsUpdate } from '@infrastructure/socket/SocketServer.js';
import { BadRequestError, UnauthorizedError, NotFoundError } from '@shared/errors/AppError.js';

const JWT_SECRET = process.env.JWT_SECRET || 'newsconnect-secret-key-change-in-production';

// --- Commands ---

export class RegisterCommand {
  constructor(
    public readonly username: string,
    public readonly email: string,
    public readonly password: string
  ) {}
}

export class LoginCommand {
  constructor(
    public readonly email: string,
    public readonly password: string
  ) {}
}

export class UpdateProfileCommand {
  constructor(
    public readonly userId: string,
    public readonly name?: string,
    public readonly avatar?: string,
    public readonly bio?: string
  ) {}
}

export class UpdateAvatarCommand {
  constructor(
    public readonly userId: string,
    public readonly avatarUrl: string
  ) {}
}

export class LogoutCommand {
  constructor(public readonly userId?: string) {}
}

// --- Handlers ---

export class RegisterHandler {
  async execute(command: RegisterCommand) {
    const existingUsername = await prisma.user.findUnique({
      where: { username: command.username }
    });
    if (existingUsername) {
      throw new BadRequestError('Username is already taken. Please choose a different handler.');
    }

    const existingEmail = await prisma.user.findUnique({
      where: { email: command.email }
    });
    if (existingEmail) {
      throw new BadRequestError('Email is already registered.');
    }

    const hashedPassword = await bcrypt.hash(command.password, 10);
    const user = await prisma.user.create({
      data: {
        username: command.username,
        email: command.email,
        password: hashedPassword,
        name: command.username,
        role: 'user',
        status: 'online',
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${command.username}`,
        reputation: 10,
        badges: ['Early Member']
      }
    });

    broadcastStatsUpdate();

    const token = jwt.sign(
      { id: user.id, email: user.email, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    const { password: _, ...userOut } = user;
    return { token, user: userOut };
  }
}

export class LoginHandler {
  async execute(command: LoginCommand) {
    const user = await prisma.user.findUnique({
      where: { email: command.email },
      include: { _count: { select: { messages: true, rooms: true } } }
    });

    if (!user) {
      throw new UnauthorizedError('Invalid credentials');
    }

    const isMatch = await bcrypt.compare(command.password, user.password);
    if (!isMatch) {
      throw new UnauthorizedError('Invalid credentials');
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { status: 'online' }
    });

    const token = jwt.sign(
      { id: user.id, email: user.email, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    const { password: _, ...userOut } = user;
    return { token, user: userOut };
  }
}

export class UpdateProfileHandler {
  async execute(command: UpdateProfileCommand) {
    const data: any = {};
    if (command.name !== undefined) data.name = command.name;
    if (command.avatar !== undefined) data.avatar = command.avatar;
    if (command.bio !== undefined) data.bio = command.bio;

    try {
      const updated = await prisma.user.update({
        where: { id: command.userId },
        data,
        include: { _count: { select: { messages: true, rooms: true } } }
      });
      const { password: _, ...userOut } = updated;
      return userOut;
    } catch {
      throw new NotFoundError('User not found');
    }
  }
}

export class UpdateAvatarHandler {
  async execute(command: UpdateAvatarCommand) {
    try {
      const updated = await prisma.user.update({
        where: { id: command.userId },
        data: { avatar: command.avatarUrl },
        include: { _count: { select: { messages: true, rooms: true } } }
      });
      const { password: _, ...userOut } = updated;
      return userOut;
    } catch {
      throw new NotFoundError('User not found');
    }
  }
}

export class LogoutHandler {
  async execute(command: LogoutCommand): Promise<void> {
    if (command.userId) {
      try {
        await prisma.user.update({
          where: { id: command.userId },
          data: { status: 'offline' }
        });
      } catch { /* ignore */ }
    }
  }
}
