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

  async validate(payload) {
    console.log(payload);

    return {
      id: payload.id,
      name: payload.name,
      email: payload.email,
      roles: payload.roles || [], // Hindari undefined, jadikan array kosong jika tidak ada
      accesses: payload.accesses || {},
    };
  }
}
