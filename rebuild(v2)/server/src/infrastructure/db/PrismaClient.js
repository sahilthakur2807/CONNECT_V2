import { PrismaClient } from "../../generated/prisma/index.js";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { config } from "../../config/index.js";

const { Pool } = pg;

const pool = new Pool({ connectionString: config.DATABASE_URL });
const adapter = new PrismaPg(pool);

export const prisma = new PrismaClient({ adapter });
