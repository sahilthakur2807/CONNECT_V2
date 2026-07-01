import pkg from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { Hash } from "../src/shared/utils/Hash.js";
import "dotenv/config";

const { PrismaClient } = pkg;
const connectionString = `${process.env.DATABASE_URL}`;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const REQUIRED_SETTINGS = [
  { key: "maintenance_mode", type: "boolean", value: "false" },
  { key: "allow_registration", type: "boolean", value: "true" },
  { key: "enable_websockets", type: "boolean", value: "true" },
  { key: "rate_limit", type: "number", value: "300" },
  { key: "default_reputation", type: "number", value: "10" },
  { key: "max_friends", type: "number", value: "100" },
];

function validateSetting(key, value, expectedType) {
  if (expectedType === "boolean") {
    return value === "true" || value === "false";
  }
  if (expectedType === "number") {
    const num = Number(value);
    return !isNaN(num) && num >= 0;
  }
  return true;
}

async function main() {
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

  console.log("Cleared existing database data.");

  const passwordHash = await Hash.hash("password123");

  const user = await prisma.user.create({
    data: {
      username: "yps_admin",
      email: "13835.yps@gmail.com",
      password: passwordHash,
      name: "Site Administrator",
      avatar:
        "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=80&h=80&fit=crop&auto=format",
      role: "superadmin",
      status: "online",
      verified: true,
      bio: "System Administrator for NewsConnect. Contact for technical or community support.",
      badges: ["Super Admin", "Founding Member"],
      reputation: 999,
    },
  });

  console.log("Seeded User: yps_admin (superadmin)");

  const worldAffairs = await prisma.community.create({
    data: {
      name: "World Affairs & Geopolitics",
      description:
        "Debate and analyze international relations, global conflicts, and foreign policy shifts.",
      category: "Politics",
      imageUrl:
        "https://images.unsplash.com/photo-1526470608268-f674ce90ebd4?w=200&h=200&fit=crop",
      banner:
        "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800&h=300&fit=crop",
      createdById: user.id,
    },
  });

  const techSociety = await prisma.community.create({
    data: {
      name: "Technology & Society",
      description:
        "Discuss the ethical, cultural, and legal impacts of rapid technological advancements.",
      category: "Tech",
      imageUrl:
        "https://images.unsplash.com/photo-1518770660439-4636190af475?w=200&h=200&fit=crop",
      banner:
        "https://images.unsplash.com/photo-1488590528505-98d2b5aba04b?w=800&h=300&fit=crop",
      createdById: user.id,
    },
  });

  console.log("Seeded default Communities.");

  await prisma.communityMember.createMany({
    data: [
      { userId: user.id, communityId: worldAffairs.id, role: "admin" },
      { userId: user.id, communityId: techSociety.id, role: "member" },
    ],
  });

  console.log("Seeded Community Memberships.");

  const settingsData = [];
  for (const s of REQUIRED_SETTINGS) {
    if (!validateSetting(s.key, s.value, s.type)) {
      throw new Error(
        `Validation failed for seeded setting: key="${s.key}", value="${s.value}", type="${s.type}"`,
      );
    }
    settingsData.push({ key: s.key, value: s.value });
  }

  await prisma.systemSetting.createMany({
    data: settingsData,
  });

  console.log("Validated and seeded System Settings.");
  console.log("Database seeding successfully completed.");
}

main()
  .catch((e) => {
    console.error("Seeding process failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
