import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    super({
      secretOrKey: configService.get<string>('jwt.public'),
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
    });
  }

  async validate(payload: {
    id: string;
    name: string;
    email: string;
    role: string;
    accesses?: Record<string, boolean>;
  }) {
    return {
      id: payload.id,
      name: payload.name,
      email: payload.email,
      role: payload.role,
      accesses: payload.accesses || {},
    };
  }
}
