import { Module } from '@nestjs/common';
import { LoginService } from './login.service';
import { LoginController } from './login.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '#/user/entities/user.entity';
import { Role } from '#/role/entities/role.entity';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from '#/core/jwt.strategy';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtAuthGuard } from '#/core/jwt-auth.guard';
import { RolesGuard } from '#/core/roles.guard';
import { JwtModule } from '@nestjs/jwt';
import { UserService } from '#/user/user.service';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        return {
          secret: configService.get<string>('jwt.private'),
          publicKey: configService.get<string>('jwt.public'),
          signOptions: {
            algorithm: 'RS256', // Ensure this matches your algorithm
            expiresIn: '1d',
          },
        };
      },
      inject: [ConfigService],
    }),
    TypeOrmModule.forFeature([User, Role]),
  ],
  controllers: [LoginController],
  providers: [
    JwtStrategy,
    ConfigService,
    LoginService,
    UserService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
  exports: [JwtStrategy],
})
export class LoginModule {}
