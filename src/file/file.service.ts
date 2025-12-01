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

async deleteFileByName(fileName: string) {
  if (!fileName || fileName.trim() === '') {
    throw new BadRequestException('fileName tidak boleh kosong');
  }

  fileName = fileName.trim();

  // Ambil semua file dari root (recursive = true)
  const files: string[] = await new Promise((resolve, reject) => {
    const list: string[] = [];

    const stream = this.minioService.client.listObjects(
      this.minioService.config.bucket,
      '',
      true, // recursive - cari di semua folder
    );

    stream.on('data', (obj) => {
      if (obj.name) list.push(obj.name);
    });

    stream.on('end', () => resolve(list));
    stream.on('error', (err) => reject(err));
  });

  // Cari file dengan nama yang cocok pada akhir path
  const matched = files.find((f) => f.endsWith(fileName));

  if (!matched) {
    throw new NotFoundException(`File "${fileName}" tidak ditemukan di bucket.`);
  }

  // Hapus file
  await this.minioService.deleteFile(matched);

  return {
    deleted: true,
    fileName,
    path: matched,
  };
}

}
