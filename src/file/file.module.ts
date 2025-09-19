// src/file/file.module.ts
import { Module, Global } from '@nestjs/common';
import { MinioStorageService } from './minio_storage';
import { FileController } from './file.controller';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Global()
@Module({
  imports: [ConfigModule],
  controllers: [FileController],
  providers: [
    {
      provide: MinioStorageService,
      useFactory: (configService: ConfigService) => {
        const config = {
          bucket: configService.get<string>('MINIO_BUCKET'),
          endPoint: configService.get<string>('MINIO_ENDPOINT'),
          port: configService.get<number>('MINIO_PORT'),
          useSSL: configService.get<boolean>('MINIO_USE_SSL') ?? false,
        };

        const service = new MinioStorageService(config);
        service.ensureBucket(); // Auto-create bucket if not exists
        return service;
      },
      inject: [ConfigService],
    },
  ],
  exports: [MinioStorageService],
})
export class FileModule {}
