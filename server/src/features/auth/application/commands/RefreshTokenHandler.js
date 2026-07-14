export class RefreshTokenCommand {
  constructor(refreshToken, deviceInfo, ipAddress) {
    this.refreshToken = refreshToken;
    this.deviceInfo = deviceInfo;
    this.ipAddress = ipAddress;
  }
}

export class RefreshTokenHandler {
  constructor(authService) {
    this.authService = authService;
  }

  async execute(command) {
    return this.authService.rotateSession(
      command.refreshToken,
      command.deviceInfo,
      command.ipAddress,
    );
  }
}
