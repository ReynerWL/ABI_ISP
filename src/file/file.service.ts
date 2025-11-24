// src/file/file.service.ts

import { Injectable } from '@nestjs/common';
import { MinioStorageService } from './minio_storage';

@Injectable()
export class FileService {
  constructor(private readonly minioService: MinioStorageService) {}

  /**
   * Upload file ke MinIO
   */
  async uploadFile(buffer: Buffer, filePath: string, mimetype: string) {
    const url = await this.minioService.uploadBuffer(buffer, filePath, mimetype);

    return {
      filePath,
      url,
    };
  }

  /**
   * List file di folder tertentu
   */
  async listFiles(prefix: string): Promise<string[]> {
    return new Promise((resolve, reject) => {
      const objects: string[] = [];

      const stream = this.minioService.client.listObjects(
        this.minioService.config.bucket,
        `${prefix}/`,
        true, // recursive
      );

      stream.on('data', (obj) => {
        objects.push(obj.name);
      });

      stream.on('end', () => resolve(objects));
      stream.on('error', (err) => reject(err));
    });
  }
}
