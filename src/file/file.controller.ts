// src/file/file.controller.ts
import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  HttpStatus,
  BadRequestException,
  Body,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import * as uuid from 'uuid';
import { MinioStorageService } from './minio_storage';
import { Public } from '#/auth/public.decorator';
import { extname } from 'path';

@Controller('file')
export class FileController {
  constructor(private readonly minioService: MinioStorageService) {}

  /**
   * Handle file upload via REST API (e.g., admin dashboard)
   */
  @Public()
  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Body('type') type: string,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    // Validate file type
    if (!file.mimetype.startsWith('image/')) {
      throw new BadRequestException('Only image files are allowed');
    }

    // Extract query params (via request) – but we need access to req
    // So we'll move filename logic into service or use custom field
    const extension = extname(file.originalname);
    const fileType = type || 'image';
    const fileName = `${fileType}/${uuid.v4()}${extension}`;

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
