import { PrismaClient } from "../src/generated/prisma/index.js";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";

const connectionString = `${process.env.DATABASE_URL}`;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Starting role migration...");

  // 1. Migrate platform user roles
  console.log("Migrating platform user roles...");
  
  const superadminUpdate = await prisma.user.updateMany({
    where: { role: "superadmin" },
    data: { role: "SUPER_ADMIN" },
  });
  console.log(`Updated ${superadminUpdate.count} user roles from "superadmin" to "SUPER_ADMIN"`);

  const adminUpdate = await prisma.user.updateMany({
    where: { role: "admin" },
    data: { role: "PLATFORM_ADMIN" },
  });
  console.log(`Updated ${adminUpdate.count} user roles from "admin" to "PLATFORM_ADMIN"`);

  const moderatorUpdate = await prisma.user.updateMany({
    where: { role: "moderator" },
    data: { role: "PLATFORM_MOD" },
  });
  console.log(`Updated ${moderatorUpdate.count} user roles from "moderator" to "PLATFORM_MOD"`);

  const userUpdate = await prisma.user.updateMany({
    where: { role: "user" },
    data: { role: "MEMBER" },
  });
  console.log(`Updated ${userUpdate.count} user roles from "user" to "MEMBER"`);

  // 2. Migrate community member roles
  console.log("Migrating community member roles...");

  const ownerCmUpdate = await prisma.communityMember.updateMany({
    where: { role: "owner" },
    data: { role: "OWNER" },
  });
  console.log(`Updated ${ownerCmUpdate.count} community member roles from "owner" to "OWNER"`);

  const adminCmUpdate = await prisma.communityMember.updateMany({
    where: { role: "admin" },
    data: { role: "ADMIN" },
  });
  console.log(`Updated ${adminCmUpdate.count} community member roles from "admin" to "ADMIN"`);

  const moderatorCmUpdate = await prisma.communityMember.updateMany({
    where: { role: "moderator" },
    data: { role: "MODERATOR" },
  });
  console.log(`Updated ${moderatorCmUpdate.count} community member roles from "moderator" to "MODERATOR"`);

  const roomModCmUpdate = await prisma.communityMember.updateMany({
    where: { role: "room_mod" },
    data: { role: "ROOM_MOD" },
  });
  console.log(`Updated ${roomModCmUpdate.count} community member roles from "room_mod" to "ROOM_MOD"`);

  const memberCmUpdate = await prisma.communityMember.updateMany({
    where: { role: "member" },
    data: { role: "MEMBER" },
  });
  console.log(`Updated ${memberCmUpdate.count} community member roles from "member" to "MEMBER"`);

  console.log("Role migration completed successfully.");
}

main()
  .catch((e) => {
    console.error("Migration failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
