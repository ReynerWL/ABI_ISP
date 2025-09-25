// src/file/file.module.ts
import { Module, Global } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MinioStorageService } from './minio_storage';

@Global()
@Module({
  providers: [
    {
      provide: MinioStorageService,
      useFactory: (configService: ConfigService) => {
        const config = {
          bucket: configService.get<string>('MINIO_BUCKET'),
          endPoint: configService.get<string>('MINIO_ENDPOINT'),
          port: configService.get<number>('MINIO_PORT'),
          useSSL: configService.get<boolean>('MINIO_USE_SSL') ?? true,
        };

        const service = new MinioStorageService(config);
        service.ensureBucket(); // Test connection on startup
        return service;
      },
      inject: [ConfigService],
    },
  ],
  exports: [MinioStorageService],
})
export class FileModule {}
