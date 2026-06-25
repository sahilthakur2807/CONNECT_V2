import pkg from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';
import 'dotenv/config';

const { PrismaClient } = pkg;
const connectionString = `${process.env.DATABASE_URL}`;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  // Clear existing data
  await prisma.activityLog.deleteMany();
  await prisma.report.deleteMany();
  await prisma.reaction.deleteMany();
  await prisma.message.deleteMany();
  await prisma.roomMember.deleteMany();
  await prisma.room.deleteMany();
  await prisma.communityMember.deleteMany();
  await prisma.community.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.user.deleteMany();
  await prisma.activity.deleteMany();

  console.log('Cleared existing data.');

  const passwordHash = await bcrypt.hash('password123', 10);

  // Create Users
  const user1 = await prisma.user.create({
    data: {
      username: 'sarahchen',
      email: 'sarah@example.com',
      password: passwordHash,
      name: 'Sarah Chen',
      avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=80&h=80&fit=crop&auto=format',
      role: 'user',
      status: 'online',
      verified: true,
      bio: 'Political journalist covering global affairs and democracy movements.',
      badges: ['Top Contributor', 'Early Member', 'Popular Discussion'],
      reputation: 154
    }
  });

  const user2 = await prisma.user.create({
    data: {
      username: 'marcus_k',
      email: 'marcus@example.com',
      password: passwordHash,
      name: 'Marcus Krause',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80&h=80&fit=crop&auto=format',
      role: 'moderator',
      status: 'online',
      verified: true,
      bio: 'Tech ethicist and author. Discussing AI governance, digital privacy, and future societies.',
      badges: ['Moderator', 'Early Member', 'AI Research Lab'],
      reputation: 342
    }
  });

  const user3 = await prisma.user.create({
    data: {
      username: 'elena_d',
      email: 'elena@example.com',
      password: passwordHash,
      name: 'Elena Dimitrova',
      avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=80&h=80&fit=crop&auto=format',
      role: 'user',
      status: 'offline',
      verified: false,
      bio: 'Economics researcher specializing in climate policy and green energy transition models.',
      badges: ['Early Member', 'Green Energy'],
      reputation: 45
    }
  });

  const user4 = await prisma.user.create({
    data: {
      username: 'admin',
      email: 'admin@example.com',
      password: passwordHash,
      name: 'Site Administrator',
      avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=80&h=80&fit=crop&auto=format',
      role: 'admin',
      status: 'online',
      verified: true,
      bio: 'System Administrator for NewsConnect. Contact for technical or community support.',
      badges: ['Admin', 'Founding Member'],
      reputation: 999
    }
  });

  console.log('Seeded Users.');

  // Create Communities
  const worldAffairsCommunity = await prisma.community.create({
    data: {
      name: 'World Affairs & Geopolitics',
      description: 'Debate and analyze international relations, global conflicts, and foreign policy shifts.',
      category: 'Politics',
      imageUrl: 'https://images.unsplash.com/photo-1526470608268-f674ce90ebd4?w=200&h=200&fit=crop',
      banner: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800&h=300&fit=crop',
      createdById: user4.id
    }
  });

  const techSocietyCommunity = await prisma.community.create({
    data: {
      name: 'Technology & Society',
      description: 'Discuss the ethical, cultural, and legal impacts of rapid technological advancements.',
      category: 'Tech',
      imageUrl: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=200&h=200&fit=crop',
      banner: 'https://images.unsplash.com/photo-1488590528505-98d2b5aba04b?w=800&h=300&fit=crop',
      createdById: user2.id
    }
  });

  console.log('Seeded Communities.');

  // Community Memberships
  await prisma.communityMember.createMany({
    data: [
      { userId: user1.id, communityId: worldAffairsCommunity.id, role: 'moderator' },
      { userId: user2.id, communityId: worldAffairsCommunity.id, role: 'member' },
      { userId: user3.id, communityId: worldAffairsCommunity.id, role: 'member' },
      { userId: user4.id, communityId: worldAffairsCommunity.id, role: 'admin' },
      
      { userId: user1.id, communityId: techSocietyCommunity.id, role: 'member' },
      { userId: user2.id, communityId: techSocietyCommunity.id, role: 'admin' },
      { userId: user3.id, communityId: techSocietyCommunity.id, role: 'member' },
      { userId: user4.id, communityId: techSocietyCommunity.id, role: 'member' }
    ]
  });

  console.log('Seeded Community Members.');

  // Create Rooms
  const room1 = await prisma.room.create({
    data: {
      title: 'UN Climate Summit Bindings',
      description: 'Analysis of the new binding emissions reductions agreed upon at the latest UN climate summit.',
      category: 'Climate & Policy',
      tags: ['climate', 'summit', 'un', 'emissions'],
      trending: true,
      isNew: false,
      imageUrl: 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=400&h=200&fit=crop&auto=format',
      communityId: worldAffairsCommunity.id,
      createdById: user1.id
    }
  });

  const room2 = await prisma.room.create({
    data: {
      title: 'EU AI Act Enforcement',
      description: 'The legal framework enters enforcement phase. What does it mean for cross-border model developers?',
      category: 'AI Ethics & Law',
      tags: ['AI', 'regulation', 'EU', 'compliance'],
      trending: true,
      isNew: false,
      imageUrl: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=400&h=200&fit=crop&auto=format',
      communityId: techSocietyCommunity.id,
      createdById: user2.id
    }
  });

  const room3 = await prisma.room.create({
    data: {
      title: 'Ukraine Humanitarian Winter Crisis',
      description: 'Aid organizations report critical infrastructure needs as winter deepens. International response analysis.',
      category: 'World Affairs',
      tags: ['Ukraine', 'humanitarian', 'aid', 'conflict'],
      trending: true,
      isNew: false,
      imageUrl: 'https://images.unsplash.com/photo-1658152534040-8a8c7a01c6dc?w=400&h=200&fit=crop&auto=format',
      communityId: worldAffairsCommunity.id,
      createdById: user3.id
    }
  });

  console.log('Seeded Rooms.');

  // Room Memberships
  await prisma.roomMember.createMany({
    data: [
      { userId: user1.id, roomId: room1.id },
      { userId: user2.id, roomId: room1.id },
      { userId: user3.id, roomId: room1.id },
      { userId: user4.id, roomId: room1.id },

      { userId: user1.id, roomId: room2.id },
      { userId: user2.id, roomId: room2.id },
      { userId: user4.id, roomId: room2.id },

      { userId: user1.id, roomId: room3.id },
      { userId: user3.id, roomId: room3.id },
      { userId: user4.id, roomId: room3.id }
    ]
  });

  console.log('Seeded Room Members.');

  // Create Messages
  const message1 = await prisma.message.create({
    data: {
      content: 'The summit\'s binding commitments are a step forward, but the enforcement mechanisms remain worryingly weak. Without independent verification bodies with real teeth, we risk repeating the Paris Agreement\'s implementation failures.',
      userId: user1.id,
      roomId: room1.id,
    }
  });

  const message2 = await prisma.message.create({
    data: {
      content: 'As a climate scientist, I\'d add that the 1.5°C pathway requires not just emission cuts but active carbon removal at scale. The summit addressed the former but was conspicuously silent on CDR funding. That\'s the technical gap nobody wants to discuss.',
      userId: user2.id,
      roomId: room1.id,
    }
  });

  // Create Reply
  const reply1 = await prisma.message.create({
    data: {
      content: 'Agreed on CDR, but there\'s also a legitimate cost concern. Who funds it, and at what scale? The economic models I\'ve seen vary wildly.',
      userId: user3.id,
      roomId: room1.id,
      parentId: message2.id,
    }
  });

  console.log('Seeded Messages & Replies.');

  // Create Reactions
  await prisma.reaction.createMany({
    data: [
      { emoji: '👍', userId: user2.id, messageId: message1.id },
      { emoji: '💡', userId: user3.id, messageId: message1.id },
      { emoji: '😮', userId: user1.id, messageId: message2.id },
      { emoji: '❤️', userId: user2.id, messageId: reply1.id }
    ]
  });

  console.log('Seeded Reactions.');

  // Create Notifications
  await prisma.notification.createMany({
    data: [
      {
        type: 'reply',
        title: 'New Reply',
        body: 'elena_d replied to your message in "UN Climate Summit Bindings".',
        read: false,
        roomId: room1.id,
        referenceId: reply1.id,
        userId: user2.id,
        triggerId: user3.id
      },
      {
        type: 'reaction',
        title: 'Message Reacted',
        body: 'sarahchen reacted 😮 to your message.',
        read: true,
        roomId: room1.id,
        referenceId: message2.id,
        userId: user2.id,
        triggerId: user1.id
      }
    ]
  });

  console.log('Seeded Notifications.');

  // Create Activities
  await prisma.activity.createMany({
    data: [
      { userId: user1.id, roomId: room1.id, actionType: 'ROOM_CREATED' },
      { userId: user2.id, roomId: room2.id, actionType: 'ROOM_CREATED' },
      { userId: user3.id, roomId: room3.id, actionType: 'ROOM_CREATED' },
      { userId: user2.id, roomId: room1.id, actionType: 'ROOM_JOINED' },
      { userId: user3.id, roomId: room1.id, actionType: 'ROOM_JOINED' }
    ]
  });

  console.log('Seeded Activities.');

  console.log('Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });