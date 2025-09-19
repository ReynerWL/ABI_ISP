// src/file/file.controller.ts
import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import * as mime from 'mime';
import * as uuid from 'uuid';
import { MinioStorageService } from './minio_storage';

@Controller('file')
export class FileController {
  constructor(private readonly minioService: MinioStorageService) {}

  /**
   * Handle file upload via REST API (e.g., admin dashboard)
   */
  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    // Validate file type
    if (!file.mimetype.startsWith('image/')) {
      throw new BadRequestException('Only image files are allowed');
    }

    // Extract query params (via request) – but we need access to req
    // So we'll move filename logic into service or use custom field
    const extension = mime.extension(file.mimetype);
    const fileType = file.fieldname; // fallback: use field name like 'avatar', 'proof'
    const fileName = `${fileType || 'upload'}/${uuid.v4()}.${extension}`;

    try {
      // Upload buffer to MinIO
      const fileUrl = await this.minioService.uploadBuffer(
        file.buffer,
        fileName,
      );

      return {
        statusCode: HttpStatus.OK,
        message: 'File uploaded successfully',
        data: {
          url: fileUrl,
          size: file.size,
          mimetype: file.mimetype,
          fileName,
        },
      };
    } catch (error) {
      throw new BadRequestException('File upload failed: ' + error.message);
    }
  }
}
