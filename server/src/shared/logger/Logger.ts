export class Logger {
  static info(message: string, ...optionalParams: any[]) {
    console.log(`[INFO] [${new Date().toISOString()}]: ${message}`, ...optionalParams);
  }

  static warn(message: string, ...optionalParams: any[]) {
    console.warn(`[WARN] [${new Date().toISOString()}]: ${message}`, ...optionalParams);
  }

  static error(message: string, ...optionalParams: any[]) {
    console.error(`[ERROR] [${new Date().toISOString()}]: ${message}`, ...optionalParams);
  }

  static debug(message: string, ...optionalParams: any[]) {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[DEBUG] [${new Date().toISOString()}]: ${message}`, ...optionalParams);
    }
  }
}
