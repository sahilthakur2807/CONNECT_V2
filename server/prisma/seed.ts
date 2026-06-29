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
  await prisma.friendship.deleteMany();
  await prisma.user.deleteMany();
  await prisma.activity.deleteMany();
  await prisma.systemSetting.deleteMany();

  console.log('Cleared existing data.');

  const passwordHash = await bcrypt.hash('password123', 10);

  // Create Users
  const user4 = await prisma.user.create({
    data: {
      username: 'yps_admin',
      email: '13835.yps@gmail.com',
      password: passwordHash,
      name: 'Site Administrator',
      avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=80&h=80&fit=crop&auto=format',
      role: 'superadmin',
      status: 'online',
      verified: true,
      bio: 'System Administrator for NewsConnect. Contact for technical or community support.',
      badges: ['Super Admin', 'Founding Member'],
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
      createdById: user4.id
    }
  });

  console.log('Seeded Communities.');

  // Community Memberships
  await prisma.communityMember.createMany({
    data: [
      { userId: user4.id, communityId: worldAffairsCommunity.id, role: 'admin' },
      { userId: user4.id, communityId: techSocietyCommunity.id, role: 'member' }
    ]
  });

  console.log('Seeded Community Members.');

  // Seed System Settings
  await prisma.systemSetting.createMany({
    data: [
      { key: 'maintenance_mode', value: 'false' },
      { key: 'allow_registration', value: 'true' },
      { key: 'enable_websockets', value: 'true' },
      { key: 'rate_limit', value: '300' },
      { key: 'default_reputation', value: '10' },
      { key: 'max_friends', value: '100' }
    ]
  });
  console.log('Seeded System Settings.');

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