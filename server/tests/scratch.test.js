import { describe, it } from "vitest";
import { prisma } from "../src/infrastructure/db/PrismaClient.js";

describe.skip("Scratch DB inspector", () => {
  it("inspects contributions for yps_Admin", async () => {
    let user;
    try {
      user = await prisma.user.findFirst({
        where: {
          username: {
            equals: "yps_Admin",
            mode: "insensitive"
          }
        }
      });
    } catch (err) {
      console.error("--- PRISMA ERROR DETECTED ---");
      console.error(err);
      throw err;
    }

    if (!user) {
      console.log("User yps_Admin not found");
      return;
    }

    console.log(`FOUND USER: ${user.name} (@${user.username}) - ID: ${user.id}`);

    const rooms = await prisma.room.findMany({
      where: { createdById: user.id },
      select: { id: true, title: true, category: true, deleted: true }
    });

    console.log("ROOMS CREATED:", rooms);

    const messages = await prisma.message.findMany({
      where: { userId: user.id },
      select: {
        id: true,
        content: true,
        deleted: true,
        room: {
          select: { id: true, title: true, category: true, deleted: true }
        }
      }
    });

    console.log(`MESSAGES POSTED (${messages.length}):`);
    messages.forEach(m => {
      console.log(`- "${m.content}" | Category: ${m.room?.category} | RoomDeleted: ${m.room?.deleted} | MsgDeleted: ${m.deleted}`);
    });
  });
});
