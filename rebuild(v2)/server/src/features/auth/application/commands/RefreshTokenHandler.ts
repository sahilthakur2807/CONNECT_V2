import { type AuthTokens, type AuthService } from '../AuthService.js';

export class RefreshTokenCommand {
  constructor(
    public readonly refreshToken: string,
    public readonly deviceInfo?: string,
    public readonly ipAddress?: string
  ) {}
}

export class RefreshTokenHandler {
  constructor(private readonly authService: AuthService) {}

  async execute(command: RefreshTokenCommand): Promise<AuthTokens> {
    return this.authService.rotateSession(
      command.refreshToken,
      command.deviceInfo,
      command.ipAddress
    );
  }
}
