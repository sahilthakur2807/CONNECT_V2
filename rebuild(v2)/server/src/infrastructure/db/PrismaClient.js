import { PrismaClient } from "../../generated/prisma/index.js";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { config } from "../../config/index.js";

const { Pool } = pg;

const pool = new Pool({ connectionString: config.DATABASE_URL });
const adapter = new PrismaPg(pool);

const basePrisma = new PrismaClient({ adapter });

export const prisma = basePrisma.$extends({
  result: {
    user: {
      badges: {
        needs: { badges: true, createdAt: true },
        compute(user) {
          if (!user.badges) return user.badges;
          if (!user.createdAt) return user.badges;
          const days = (Date.now() - new Date(user.createdAt).getTime()) / (1000 * 60 * 60 * 24);
          if (days > 30) {
            return user.badges.filter((b) => b !== "Early Member");
          }
          return user.badges;
        },
      },
    },
  },
});
