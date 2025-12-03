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
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<Request>();

    // --- Skip by decorator ---
    const skipLogging = this.reflector.getAllAndOverride<boolean>(
      SKIP_LOGGING,
      [context.getHandler(), context.getClass()],
    );

    if (skipLogging) return next.handle();

    // --- Skip /log routes ---
    if (request.url.startsWith('/log')) {
      return next.handle();
    }

    // --- Skip ALL GET requests ---
    if (request.method.toLowerCase() === 'get') {
      return next.handle();
    }

    // --- Skip WA logout ---
    if (request.url === '/wa/logout' || request.url.startsWith('/wa/logout')) {
      return next.handle();
    }

    // ----------------------------------------------------
    // 📝 ONLY NON-SKIPPED REQUESTS BELOW THIS POINT
    // ----------------------------------------------------

    const startTime = Date.now();
    const { method, originalUrl, headers } = request;
    const user = (request as any).user;
    const ip = request.ip;
    const userAgent = headers['user-agent'] || '';

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

    const response = ctx.getResponse<Response>();

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - startTime;

          const logDataToSave = {
            ...baseLogData,
            durationMs: duration,
            statusCode: response.statusCode,
          };

          this.logger.log(
            `✅ Request Completed: ${method} ${originalUrl} ${response.statusCode} - ${duration}ms`,
          );

          setImmediate(async () => {
            try {
              await this.logService.createLogEntry(logDataToSave);
            } catch (err) {
              this.logger.error(
                `❌ Failed to save log entry for ${method} ${originalUrl}`,
                err.stack,
              );
            }
          });
        },
      }),
      catchError((error) => {
        const duration = Date.now() - startTime;

        const errorLogDataToSave = {
          ...baseLogData,
          durationMs: duration,
          statusCode: error.status || 500,
          error: {
            message: error.message,
            stack: error.stack,
            response: error.response,
          },
        };

        this.logger.error(
          `❌ Request Failed: ${method} ${originalUrl} - ${duration}ms - ${error.message}`,
        );

        setImmediate(async () => {
          try {
            await this.logService.createLogEntry(errorLogDataToSave);
          } catch (err) {
            this.logger.error(
              `💥 Failed to save ERROR log entry for ${method} ${originalUrl}`,
              err.stack,
            );
          }
        });

        throw error;
      }),
    );
  }
}
