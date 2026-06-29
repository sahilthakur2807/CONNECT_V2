import { prisma } from '@infrastructure/db/PrismaClient.js';

export class UpdateSettingsCommand {
  constructor(public readonly settings: Record<string, any>) {}
}

export class UpdateSettingsHandler {
  async execute(command: UpdateSettingsCommand): Promise<void> {
    const upserts = Object.entries(command.settings).map(([key, val]) => {
      return prisma.systemSetting.upsert({
        where: { key },
        update: { value: String(val) },
        create: { key, value: String(val) }
      });
    });
    await Promise.all(upserts);
  }
}
