// src/file/minio_storage.ts
import * as Minio from 'minio';

export interface MinioStorageConfig {
  bucket: string;
  endPoint: string;
  port: number;
  useSSL: boolean; // Must be boolean, not string
}

export class MinioStorageService {
  private client: Minio.Client;
  private config: MinioStorageConfig;

  constructor(config: MinioStorageConfig) {
    this.config = config;

    this.client = new Minio.Client({
      endPoint: this.config.endPoint,
      port: this.config.port,
      useSSL: this.config.useSSL, // true for HTTPS
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

  async uploadBuffer(buffer: Buffer, fileName: string): Promise<string> {
    const key = `${Date.now()}_${fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const metaData = {
      'Content-Type': this.getContentType(fileName),
      'x-amz-acl': 'public-read',
    };

    try {
      await this.client.putObject(
        this.config.bucket,
        key,
        buffer,
        buffer.length,
        metaData
      );

      return this.getFileUrl(key);
    } catch (error) {
      console.error('❌ Upload failed:', error.message);
      throw new Error(`Failed to upload file: ${error.message}`);
    }
  }

  getFileUrl(key: string): string {
    const protocol = this.config.useSSL ? 'https://' : 'http://';
    return `${protocol}${this.config.endPoint}:${this.config.port}/${this.config.bucket}/${key}`;
  }

  private getContentType(fileName: string): string {
    const ext = fileName.split('.').pop()?.toLowerCase();
    const types: Record<string, string> = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      webp: 'image/webp'
    };
    return types[ext] || 'application/octet-stream';
  }
}