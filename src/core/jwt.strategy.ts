import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    super({
      secretOrKey: configService.get<string>('JWT_PUBLIC_KEY'),
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
    });
  }

  async validate(payload: {
    id: string;
    name: string;
    email: string;
    roles?: string[];
    accesses?: Record<string, boolean>;
  }) {
    return {
      id: payload.id,
      name: payload.name,
      email: payload.email,
      roles: payload.roles || [],
      accesses: payload.accesses || {},
    };
  }
}
