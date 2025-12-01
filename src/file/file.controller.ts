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
    @Body('folder') folder: string,
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

    const upload = await this.fileService.uploadFile(
      file.buffer,
      filePath,
      file.mimetype,
    );

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
  async listFiles(
    @Query('folder') folder?: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
    @Query('search') search?: string,
  ) {
    const result = await this.fileService.listFiles(
      folder,
      Number(page),
      Number(limit),
      search,
    );

    return {
      statusCode: HttpStatus.OK,
      ...result,
    };
  }

  @Delete('delete')
  async deleteFile(@Query('filename') filename: string) {
    if (!filename) {
      throw new BadRequestException('filename wajib diisi');
    }

    const result = await this.fileService.deleteFileByName(filename);

    return {
      statusCode: HttpStatus.OK,
      message: 'File berhasil dihapus',
      data: result,
    };
  }
}
