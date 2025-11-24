// src/file/minio_storage.ts

import * as Minio from 'minio';

export interface MinioStorageConfig {
  bucket: string;
  endPoint: string;
  port: number;
  useSSL: boolean;
}

export class MinioStorageService {
  public client: Minio.Client;   // <-- dibuat public agar bisa diakses FileService
  public config: MinioStorageConfig; // <-- juga dibuat public

  constructor(config: MinioStorageConfig) {
    this.config = config;

    this.client = new Minio.Client({
      endPoint: this.config.endPoint,
      port: this.config.port,
      useSSL: this.config.useSSL,
      accessKey: process.env.MINIO_ACCESS_KEY,
      secretKey: process.env.MINIO_SECRET_KEY,
    });
  }

  async ensureBucket() {
    try {
      const exists = await this.client.bucketExists(this.config.bucket);
      if (!exists) {
        await this.client.makeBucket(this.config.bucket, 'us-east-1');
        console.log(`✅ Bucket "${this.config.bucket}" created`);
      } else {
        console.log(`📁 Bucket "${this.config.bucket}" already exists`);
      }
    } catch (error) {
      console.error('❌ Failed to connect to MinIO:', error.message);
      throw error;
    }
  }

  async uploadBuffer(
    buffer: Buffer,
    fileName: string,
    mimetype: string,
  ): Promise<string> {
    const metaData = {
      'Content-Type': mimetype,
      'x-amz-acl': 'public-read',
    };

    try {
      await this.client.putObject(
        this.config.bucket,
        fileName,
        buffer,
        buffer.length,
        metaData,
      );

      return this.getFileUrl(fileName);
    } catch (error) {
      console.error('❌ Upload failed:', error.message);
      throw new Error(`Failed to upload file: ${error.message}`);
    }
  }

  /**
   * List file dari folder tertentu
   */
  listObjects(prefix: string): Promise<string[]> {
    return new Promise((resolve, reject) => {
      const objects: string[] = [];

      const stream = this.client.listObjects(
        this.config.bucket,
        prefix.endsWith('/') ? prefix : `${prefix}/`,
        true, // recursive
      );

      stream.on('data', (obj) => {
        objects.push(obj.name);
      });

      stream.on('end', () => resolve(objects));
      stream.on('error', (err) => reject(err));
    });
  }

  /**
   * Generate URL publik
   */
  getFileUrl(key: string): string {
    const protocol = this.config.useSSL ? 'https://' : 'http://';
    return `${protocol}${this.config.endPoint}:${this.config.port}/${this.config.bucket}/${key}`;
  }
}
