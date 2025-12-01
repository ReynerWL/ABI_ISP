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
  search?: string,
): Promise<{
  total: number;
  page: number;
  limit: number;
  data: string[];
}> {
  return new Promise((resolve, reject) => {
    const objects: string[] = [];

    // Normalize folder → root
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
      let results = [...objects];

      // ============================================
      // 🔎 (Optional) SEARCH filter
      // ============================================
      if (search && search.trim() !== '') {
        const q = search.toLowerCase();
        results = results.filter((file) => file.toLowerCase().includes(q));
      }

      // ============================================
      // 📌 SORT by filename timestamp → newest first
      // ============================================
      results.sort((a, b) => {
        const numA = parseInt(a.split('_')[0]);
        const numB = parseInt(b.split('_')[0]);

        if (isNaN(numA) || isNaN(numB)) return 0;
        return numB - numA; // DESCENDING
      });

      // ============================================
      // 📄 PAGINATION
      // ============================================
      const total = results.length;
      const start = (page - 1) * limit;
      const end = start + limit;

      const paginated = results.slice(start, end);

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
