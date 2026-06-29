import { prisma } from '@infrastructure/db/PrismaClient.js';

export class GetSettingsQuery {}

export class GetSettingsQueryHandler {
  async execute(query: GetSettingsQuery) {
    const settings = await prisma.systemSetting.findMany();
    // Convert array of key-value objects to a single object map
    return settings.reduce((acc, curr) => {
      acc[curr.key] = curr.value;
      return acc;
    }, {} as Record<string, string>);
  }
}
