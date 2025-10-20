// src/middleware/user-context.middleware.ts
import { ExtendedRequest } from '#/core/request';
import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class UserContextMiddleware implements NestMiddleware {
  use(req: ExtendedRequest, res: Response, next: NextFunction) {
    // Example: Mock user for testing
    // In real app, get from JWT/session
    if (!req.headers.authorization) {
      (req as any).user = null;
    } else {
      // Simulate decoded user
      (req as any).user = {
        id: 'b4d1063d-80b9-4ea7-93c9-5213d5f5f0ac',
        email: 'security-test@example.com',
      };
    }
    next();
  }
}