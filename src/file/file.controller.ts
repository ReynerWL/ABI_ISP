// src/file/file.controller.ts

import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  HttpStatus,
  BadRequestException,
  Body,
  Get,
  Query,
  Delete,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Public } from '#/auth/public.decorator';
import { FileService } from './file.service';
import { extname } from 'path';

@Controller('file')
export class FileController {
  constructor(private readonly fileService: FileService) {}

  /**
   * Upload file ke MinIO ke folder sesuai param
   */
  @Public()
  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Query('folder') folder: string,
    @Body('type') type: string, // optional
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    // Validasi file image
    if (!file.mimetype.startsWith('image/')) {
      throw new BadRequestException('Only image files are allowed');
    }

    const extension = extname(file.originalname);

    // jika folder tidak dikirim, default ke "misc"
    const uploadFolder = folder?.trim() || 'misc';

    const fileName = `${type || 'image'}_${Date.now()}${extension}`;

    const filePath = `${uploadFolder}/${fileName}`;

    const upload = await this.fileService.uploadFile(file.buffer, filePath, file.mimetype);

    return {
      statusCode: HttpStatus.OK,
      message: 'File uploaded successfully',
      data: upload,
    };
  }

  /**
   * List file dari folder tertentu
   */
  @Public()
  @Get('list')
  async listFiles(@Query('folder') folder: string) {
    if (!folder) {
      throw new BadRequestException('Folder query parameter is required');
    }

    const list = await this.fileService.listFiles(folder);

    return {
      statusCode: HttpStatus.OK,
      data: list,
    };
  }

  @Delete('delete')
  async deleteFile(
    @Query('folder') folder: string,
    @Query('filename') filename: string,
  ) {
    if (!folder || !filename) {
      throw new BadRequestException('folder dan filename wajib diisi');
    }

    const result = await this.fileService.deleteFile(folder, filename);

    return {
      statusCode: HttpStatus.OK,
      message: 'File berhasil dihapus',
      data: result,
    };
  }
}
