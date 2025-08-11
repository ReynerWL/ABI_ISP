import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import * as Joi from 'joi';
import { LoggerModule } from 'nestjs-pino';
import { HealthModule } from './health/health.module';
import configuration from './config/configuration';
import * as pino from 'pino';
import { CoreModule } from '#/core/core.module';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { RoleModule } from './role/role.module';
import { BankModule } from './bank/bank.module';
import { PaketModule } from './paket/paket.module';
import { SubscriptionModule } from './subscription/subscription.module';
import { ReportModule } from './report/report.module';
import { PaymentModule } from './payment/payment.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
require('dotenv').config();

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        base: undefined,
        genReqId: (req) => {
          return req['x-correlation-id'];
        },
        redact: {
          paths: [
            'req.headers.authorization',
            'req.headers["user-agent"]',
            'req.headers.accept',
            'req.headers["accept-encoding"]',
            'req.headers["accept-language"]',
            'req.headers.host',
            'req.headers.connection',
            'req.headers.cookie',
            'req.headers["sec-ch-ua"]',
            'req.headers["sec-ch-ua-mobile"]',
            'req.headers["sec-ch-ua-platform"]',
            'req.headers["upgrade-insecure-requests"]',
            'req.headers["sec-fetch-site"]',
            'req.headers["sec-fetch-mode"]',
            'req.headers["sec-fetch-user"]',
            'req.headers["sec-fetch-dest"]',
            'req.headers["if-none-match"]',
            'req.headers["cache-control"]',
            'req.query',
            'req.params',
            'req.remoteAddress',
            'req.remotePort',
            'res.headers["access-control-allow-origin"]',
            'res.headers["content-type"]',
            'res.headers["content-length"]',
            'res.headers["etag"]',
          ],
          remove: true,
        },
        timestamp: pino.stdTimeFunctions.isoTime,
        level: process.env.NODE_ENV !== 'production' ? 'debug' : 'info',
        // install 'pino-pretty' package in order to use the following option
        transport:
          process.env.NODE_ENV !== 'production'
            ? { target: 'pino-pretty' }
            : undefined,
      },
    }),
    ConfigModule.forRoot({
      load: [configuration],
      validationSchema: Joi.object({
        NODE_ENV: Joi.string()
          .valid('development', 'production', 'test', 'provision')
          .default('development'),
        PORT: Joi.number().default(3000),
        DATABASE_URL: Joi.string(),
        JWT_SECRET_KEY: Joi.string(),
      }),
      isGlobal: true,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        return {
          type: configService.get<'postgres'>('database.client'),
          host: configService.get<string>('database.host'),
          port: configService.get<number>('database.port'),
          username: configService.get<string>('database.username'),
          password: configService.get<string>('database.password'),
          database: configService.get<string>('database.name'),
          entities: [],
          synchronize: configService.get<boolean>('database.synchronize'),
          logging: configService.get<boolean>('database.logging'),
          autoLoadEntities: true,
          namingStrategy: new SnakeNamingStrategy(),
        };
      },
      inject: [ConfigService],
    }),
    CoreModule,
    HealthModule,
    AuthModule,
    UserModule,
    RoleModule,
    BankModule,
    PaketModule,
    SubscriptionModule,
    ReportModule,
    PaymentModule,
  ],
})
export class AppModule {}
