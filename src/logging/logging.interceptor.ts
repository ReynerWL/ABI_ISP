// src/interceptors/logging.interceptor.ts
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
  SetMetadata, // Import SetMetadata
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { Request, response, Response } from 'express';
import { LogService } from '../log/log.service';
import { Reflector } from '@nestjs/core';

// Define a custom metadata key
export const SKIP_LOGGING = 'skipLogging';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  constructor(
    private readonly logService: LogService,
    private readonly reflector: Reflector,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    // --- NEW: Check if logging should be skipped ---
    // First check route handler, then controller class
    const skipLogging = this.reflector.getAllAndOverride<boolean>(SKIP_LOGGING, [
      context.getHandler(), // Method-level metadata
      context.getClass(),   // Class-level metadata
    ]);

    if (skipLogging) {
      return next.handle(); // Skip logging entirely
    }

    // --- NEW: Skip logging for /log routes ---
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<Request>();
    if (request.url.startsWith('/log')) {
      return next.handle(); // Skip logging for /log* endpoints
    }
    // --- END NEW ---

    const startTime = Date.now();

    const { method, originalUrl, body, headers, ip } = request;
    const userAgent = headers['user-agent'] || '';
    const user = (request as any).user;

    const baseLogData: any = {
      timestamp: new Date().toISOString(),
      method,
      url: originalUrl,
      userAgent,
      ip,
      user: user ? { id: user.id, name: user.name } : undefined,
      durationMs: -1,
      statusCode: -1,
      error: null,
    };

    return next.handle().pipe(
      tap({
        next: (data) => {
          const duration = Date.now() - startTime;
          const statusCode = response.statusCode;

          const logDataToSave = {
            ...baseLogData,
            durationMs: duration,
            statusCode: statusCode,
          };

          this.logger.log(
            `✅ Request Completed: ${method} ${originalUrl} ${statusCode} - ${duration}ms`,
          );

          setImmediate(async () => {
            try {
              await this.logService.createLogEntry(logDataToSave);
            } catch (dbError) {
              this.logger.error(`❌ Failed to save log entry to DB for ${method} ${originalUrl}`, dbError.stack);
            }
          });
        },
      }),
      catchError((error) => {
        const duration = Date.now() - startTime;
        const statusCode = error.status || 500;

        const errorLogDataToSave = {
          ...baseLogData,
          durationMs: duration,
          statusCode: statusCode,
          error: {
            message: error.message,
            stack: error.stack,
            response: error.response,
          },
        };

        this.logger.error(
          `❌ Request Failed: ${method} ${originalUrl} - ${duration}ms - ${error.message}`,
          error.stack,
        );

        setImmediate(async () => {
          try {
            await this.logService.createLogEntry(errorLogDataToSave);
          } catch (dbError) {
            this.logger.error(`💥 Failed to save ERROR log entry to DB for ${method} ${originalUrl}`, dbError.stack);
          }
        });

        throw error;
      }),
    );
  }
}