// src/file/file.service.ts

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MinioStorageService } from './minio_storage';

@Injectable()
export class FileService {
  constructor(private readonly minioService: MinioStorageService) {}
  private readonly allowedFolders = ['ktp', 'payment', 'profile', 'misc'];

  /**
   * Upload file ke MinIO
   */
  async uploadFile(buffer: Buffer, filePath: string, mimetype: string) {
    const url = await this.minioService.uploadBuffer(
      buffer,
      filePath,
      mimetype,
    );

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

  async deleteFile(folder: string, fileName: string) {
    folder = folder.trim().toLowerCase();

    // Validasi folder whitelist
    if (!this.allowedFolders.includes(folder)) {
      throw new BadRequestException(
        `Folder "${folder}" tidak diperbolehkan. Gunakan: ${this.allowedFolders.join(', ')}`,
      );
    }

    const path = `${folder}/${fileName}`;

    // Cek apakah file ada
    const files = await this.minioService.listObjects(folder);

    if (!files.includes(path)) {
      throw new NotFoundException(
        `File "${fileName}" tidak ditemukan di folder "${folder}".`,
      );
    }

    // Hapus file
    await this.minioService.deleteFile(path);

    return {
      deleted: true,
      folder,
      fileName,
      path,
    };
  }
}
