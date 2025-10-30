// src/interceptors/logging.interceptor.ts
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger, // Use NestJS Logger for interceptor-level logs
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { Request, Response } from 'express';
import { LogService } from '../log/log.service'; // Adjust path if needed
import { Reflector } from '@nestjs/core';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name); // Local logger for interceptor issues

  constructor(
    private readonly logService: LogService, // Inject LogService
    private readonly reflector: Reflector,   // Inject Reflector
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    // --- Optional: Skip logging for specific routes ---
    // const skipLogging = this.reflector.get<boolean>('skipLogging', context.getHandler());
    // if (skipLogging) {
    //   return next.handle();
    // }

    const ctx = context.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();
    const startTime = Date.now();

    const { method, originalUrl, body, headers, ip } = request;
    const userAgent = headers['user-agent'] || '';

    // Get user info if attached by auth middleware/guard
    const user = (request as any).user;

    // --- Prepare base log data ---
    const baseLogData: any = {
      timestamp: new Date().toISOString(),
      method,
      url: originalUrl,
      userAgent,
      ip,
      user: user ? { id: user.id, email: user.email, customerId: user.customerId } : undefined,
      // Avoid logging full body by default - can be huge or contain secrets
      // requestBody: body,
      durationMs: -1, // Placeholder, will be updated later
      statusCode: -1, // Placeholder
      error: null, // Placeholder
    };

    return next.handle().pipe(
      tap({
        next: (data) => { // Removed async, use setImmediate for async tasks
          const duration = Date.now() - startTime;
          const statusCode = response.statusCode;

          const logDataToSave = {
            ...baseLogData,
            durationMs: duration,
            statusCode: statusCode,
            // Avoid logging full response body by default - can be huge or contain secrets
            // responseBody: data,
          };

          this.logger.log(
            `✅ Request Completed: ${method} ${originalUrl} ${statusCode} - ${duration}ms`,
          );

          // --- Save to database asynchronously ---
          // Use setImmediate to avoid blocking the response
          setImmediate(async () => {
            try {
              await this.logService.createLogEntry(logDataToSave);
              // this.logger.debug(`💾 Log entry created for ${method} ${originalUrl}`);
            } catch (dbError) {
              // Log database errors separately to avoid polluting API response logs
              this.logger.error(`❌ Failed to save log entry to DB for ${method} ${originalUrl}`, dbError.stack);
            }
          });
        },
      }),
      catchError((error) => {
        const duration = Date.now() - startTime;
        const statusCode = error.status || 500; // Get status from HttpException or default to 500

        const errorLogDataToSave = {
          ...baseLogData,
          durationMs: duration,
          statusCode: statusCode,
          error: {
            message: error.message,
            stack: error.stack,
            // Add other relevant error properties if needed
            response: error.response // Contains DTO validation errors etc.
          },
        };

        this.logger.error(
          `❌ Request Failed: ${method} ${originalUrl} - ${duration}ms - ${error.message}`,
          error.stack,
        );

        // --- Save error log to database asynchronously ---
        setImmediate(async () => {
          try {
            await this.logService.createLogEntry(errorLogDataToSave);
            // this.logger.debug(`💾 Error log entry created for ${method} ${originalUrl}`);
          } catch (dbError) {
            this.logger.error(`💥 Failed to save ERROR log entry to DB for ${method} ${originalUrl}`, dbError.stack);
          }
        });

        // Re-throw the error so it can be handled by exception filters
        throw error;
      }),
    );
  }
}