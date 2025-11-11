// src/logger.ts
import * as winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json(),
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/api.log' }),
    new winston.transports.Console(), // Also log to console
  ],
});

export default logger;