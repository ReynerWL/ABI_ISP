import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from './roles.enum';
import { ROLES_KEY } from './roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();

    let userRoles: string[] = [];
    if (typeof user?.role === 'string') {
      userRoles = [user.role.toUpperCase()];
    } else if (Array.isArray(user?.role)) {
      userRoles = user.role.map((r: string) => r.toUpperCase());
    }

    if (userRoles.includes(Role.SUPERADMIN.toUpperCase())) {
      return true;
    }

    return requiredRoles.some((role) => {
      return userRoles.includes(role.toUpperCase());
    });
  }
}

export function checkRole(userRoles: string[], roleToCheck: string) {
  if (!userRoles) {
    return false;
  }

  const normalizedUserRoles = typeof userRoles === 'string' ? [userRoles] : userRoles;
  const upperUserRoles = normalizedUserRoles.map(r => typeof r === 'string' ? r.toUpperCase() : r);

  if (upperUserRoles.includes(Role.SUPERADMIN.toUpperCase())) {
    return true;
  }

  return upperUserRoles.includes(roleToCheck.toUpperCase());
}
