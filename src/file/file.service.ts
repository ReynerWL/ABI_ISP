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
  private readonly allowedFolders = ['KTP', 'Bukti_Pembayaran', 'Paket'];

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
  async listFiles(
    prefix: string,
    page = 1,
    limit = 20,
  ): Promise<{
    total: number;
    page: number;
    limit: number;
    data: string[];
  }> {
    return new Promise((resolve, reject) => {
      const objects: string[] = [];

      // Jika folder kosong → root
      if (!prefix || prefix === '.' || prefix === '/') {
        prefix = '';
      } else {
        prefix = prefix.endsWith('/') ? prefix : `${prefix}/`;
      }

      const stream = this.minioService.client.listObjects(
        this.minioService.config.bucket,
        prefix,
        true, // recursive
      );

      stream.on('data', (obj) => {
        if (obj.name) objects.push(obj.name);
      });

      stream.on('end', () => {
        // Pagination logic
        const total = objects.length;
        const start = (page - 1) * limit;
        const end = start + limit;

        const paginated = objects.slice(start, end);

        resolve({
          total,
          page,
          limit,
          data: paginated,
        });
      });

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
