/*
  Warnings:

  - You are about to drop the `_RoomHashtags` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `hashtags` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "_RoomHashtags" DROP CONSTRAINT "_RoomHashtags_A_fkey";

-- DropForeignKey
ALTER TABLE "_RoomHashtags" DROP CONSTRAINT "_RoomHashtags_B_fkey";

-- AlterTable
ALTER TABLE "room_members" ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'joined';

-- AlterTable
ALTER TABLE "rooms" ADD COLUMN     "isPrivate" BOOLEAN NOT NULL DEFAULT false;

-- DropTable
DROP TABLE "_RoomHashtags";

-- DropTable
DROP TABLE "hashtags";
