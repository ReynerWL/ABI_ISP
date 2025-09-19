// src/file/minio_storage.ts
import * as Minio from 'minio';
import { ExtendedRequest } from '#/core/request';

export interface MinioStorageConfig {
  bucket: string;
  endPoint: string;
  port: number;
  useSSL?: boolean;
  getFileName?: (req: ExtendedRequest, opt: { mimetype: string }) => string;
}

export class MinioStorageService {
  private client: Minio.Client;
  private config: MinioStorageConfig;

  constructor(config: MinioStorageConfig) {
    this.config = {
      useSSL: false, // default
      ...config,
    };

    this.client = new Minio.Client({
      endPoint: this.config.endPoint,
      port: this.config.port,
      useSSL: this.config.useSSL,
      accessKey: process.env.MINIO_ACCESS_KEY,
      secretKey: process.env.MINIO_SECRET_KEY,
    });
  }

  /**
   * Upload a Buffer directly (e.g., from WhatsApp image)
   * @param buffer - Image buffer
   * @param fileName - Suggested file name
   * @param metadata - Optional metadata
   * @returns Public URL of uploaded file
   */
  async uploadBuffer(
    buffer: Buffer,
    fileName: string,
    metadata?: Record<string, any>
  ): Promise<string> {
    const key = await this.generateKey(fileName);
    const contentType = this.getContentType(fileName);

    const metaData = {
      'Content-Type': contentType,
      'x-amz-acl': 'public-read',
      ...metadata,
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
      console.error('MinIO upload failed:', error);
      throw new Error(`Failed to upload file to MinIO: ${error.message}`);
    }
  }

  /**
   * Legacy method for Multer integration
   */
  async _handleFile(
    req: ExtendedRequest,
    file: Express.Multer.File,
    cb: (error?: unknown, info?: Record<string, string | number>) => void,
  ) {
    if (!this.config.getFileName) {
      return cb(new Error('getFileName function is required'));
    }

    try {
      const key = this.config.getFileName(req, { mimetype: file.mimetype });
      const result = await this.client.putObject(
        this.config.bucket,
        key,
        file.stream,
        file.size,
        {
          'Content-Type': file.mimetype,
          'x-amz-acl': 'public-read',
        }
      );

      const url = this.getFileUrl(key);

      cb(null, {
        size: file.size,
        bucket: this.config.bucket,
        key: key,
        url: url,
        ...result,
      });
    } catch (e) {
      cb(e);
    }
  }

  /**
   * Generate full public URL for a file
   */
  getFileUrl(key: string): string {
    const protocol = this.config.useSSL ? 'https://' : 'http://';
    return `${protocol}${this.config.endPoint}/${this.config.bucket}/${key}`;
  }

  /**
   * Generate unique key (filename) if needed
   */
  private async generateKey(fileName: string): Promise<string> {
    // If you want custom naming logic, replace this
    const timestamp = Date.now();
    const sanitized = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    return `uploads/${timestamp}_${sanitized}`;
  }

  /**
   * Guess Content-Type from filename
   */
  private getContentType(fileName: string): string {
    const ext = fileName.split('.').pop()?.toLowerCase();
    const types: Record<string, string> = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      pdf: 'application/pdf',
      webp: 'image/webp'
    };
    return types[ext] || 'application/octet-stream';
  }

  /**
   * Check if bucket exists, create if not
   */
  async ensureBucket() {
    try {
      const exists = await this.client.bucketExists(this.config.bucket);
      if (!exists) {
        await this.client.makeBucket(this.config.bucket, 'us-east-1');
        console.log(`✅ Bucket "${this.config.bucket}" created`);
      }
    } catch (error) {
      console.error('Failed to ensure bucket:', error);
      throw error;
    }
  }
}