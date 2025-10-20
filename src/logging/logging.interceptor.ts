// src/interceptors/logging.interceptor.ts
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';
import { appLogger } from '../utils/app-logger'; // Import the logger

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();
    const startTime = Date.now();

    const { method, originalUrl, body, headers, ip } = request;
    const userAgent = headers['user-agent'] || '';

    // Get user info if attached by auth middleware/guard
    const user = (request as any).user;

    return next.handle().pipe(
      tap({
        next: (data) => {
          const duration = Date.now() - startTime;
          const logData = {
            timestamp: new Date().toISOString(),
            method,
            url: originalUrl,
            statusCode: response.statusCode,
            userAgent,
            ip,
            user: user ? { id: user.id, email: user.email } : undefined,
            // Avoid logging sensitive data directly
            // requestBody: body,
            // responseBody: data,
            durationMs: duration,
          };
          appLogger.log(
            `Request Completed: ${method} ${originalUrl} ${response.statusCode} - ${duration}ms`,
            'LoggingInterceptor'
          );
          // Optionally log the full data object to a file/database
          // appLogger.debug(JSON.stringify(logData, null, 2), 'API_Request_Response_Details');
        },
        error: (error) => {
          const duration = Date.now() - startTime;
          appLogger.error(
            `Request Failed: ${method} ${originalUrl} - ${duration}ms - ${error.message}`,
            error.stack,
            'LoggingInterceptor'
          );
        },
      }),
    );
  }
}