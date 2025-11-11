// src/utils/app-logger.ts
import { LoggerService } from '@nestjs/common';
import * as winston from 'winston';
import * as path from 'path';

// Configure the Winston logger
const logger = winston.createLogger({
  level: 'info', // Adjust default level as needed
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }), // Include stack traces for errors
    winston.format.printf(({ timestamp, level, message, stack }) => {
      let logMessage = `${timestamp} [${level.toUpperCase()}] ${message}`;
      if (stack) {
        logMessage += `\n${stack}`; // Append stack trace if present
      }
      return logMessage;
    })
  ),
  transports: [
    new winston.transports.File({
      filename: path.join(process.cwd(), 'logs', 'combined.log'), // Log to file
      level: 'info',
    }),
    new winston.transports.File({
      filename: path.join(process.cwd(), 'logs', 'error.log'),
      level: 'error', // Separate file for errors
    }),
    new winston.transports.Console({ // Also log to console
      format: winston.format.combine(
        winston.format.colorize(), // Add colors to console output
        winston.format.simple()
      )
    }),
  ],
});

// Ensure the logs directory exists
(async () => {
  const fs = await import('fs').then(m => m.promises);
  const logsDir = path.join(process.cwd(), 'logs');
  try {
    await fs.access(logsDir);
  } catch {
    await fs.mkdir(logsDir, { recursive: true });
  }
})();

export class AppLogger implements LoggerService {
  log(message: any, context?: string) {
    logger.info(`[${context}] ${message}`);
  }

  error(message: any, trace?: string, context?: string) {
    logger.error(`[${context}] ${message}`, { stack: trace });
  }

  warn(message: any, context?: string) {
    logger.warn(`[${context}] ${message}`);
  }

  debug?(message: any, context?: string) {
    logger.debug(`[${context}] ${message}`);
  }

  verbose?(message: any, context?: string) {
    logger.verbose(`[${context}] ${message}`);
  }
}

// Export a singleton instance
export const appLogger = new AppLogger();