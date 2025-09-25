// src/file/file.module.ts
import { Module, Global } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MinioStorageService } from './minio_storage';

@Global()
@Module({
  providers: [
    {
      provide: MinioStorageService,
      useFactory: (config: ConfigService) => {
        return new MinioStorageService({
          bucket: config.get<string>('MINIO_BUCKET'),
          endPoint: config.get<string>('MINIO_ENDPOINT'),
          port: Number(config.get<string>('MINIO_PORT')) || 443,
          useSSL: true,
        });
      },
      inject: [ConfigService],
    },
  ],
  exports: [MinioStorageService],
})
export class FileModule {}
