import { User } from '#/user/entities/user.entity';
import { Request } from 'express';

export interface ExtendedRequest extends Request {
  user: {
    id: string;
    name: string;
    email: string;
    roles: string[];
    accesses: Record<string, boolean>;
  };
  userObj: User;
}
