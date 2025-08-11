import * as Minio from 'minio';

// eslint-disable-next-line @typescript-eslint/no-var-requires
require('dotenv').config();
import {
  Controller,
  HttpException,
  Post,
  UploadedFile,
  UseInterceptors,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { MinioStorage } from 'src/file/minio_storage';
import * as mime from 'mime';
import * as uuid from 'uuid';
import { ConfigService } from '@nestjs/config';

const minioStorage = new MinioStorage();

@Controller('file')
export class FileControllers {
  constructor(private _configService: ConfigService) {
    const minio = new Minio.Client({
      endPoint: _configService.get('minio.endpoint'),
      port: +_configService.get('minio.port'),
      useSSL: +_configService.get('minio.port') === 443,
      accessKey: _configService.get('minio.access_key'),
      secretKey: _configService.get('minio.secret_key'),
    });

    minioStorage.setMinioClient(minio);
    minioStorage.setConfig({
      port: +_configService.get('minio.port'),
      bucket: _configService.get('minio.bucket'),
      endPoint: _configService.get('minio.endpoint'),
      getFileName(req: any, opt: { mimetype: string }): string {
        const extension = (mime as any).getExtension(opt.mimetype);

        if (!opt.mimetype.startsWith('image/')) {
          throw new HttpException(
            {
              statusCode: HttpStatus.BAD_REQUEST,
              error: 'unsupported file type',
            },
            HttpStatus.BAD_REQUEST,
          );
        }

        if (!req.query.type) {
          throw new HttpException(
            {
              statusCode: HttpStatus.BAD_REQUEST,
              error: 'type not supplied',
            },
            HttpStatus.BAD_REQUEST,
          );
        }

        return `${req.query.type}/${uuid.v4()}.${extension}`;
      },
    });
  }

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: minioStorage,
    }),
  )
  async postFile(@UploadedFile() file: any) {
    if (!file) {
      return {
        data: {},
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'file not detected',
        error: 'file not detected',
      };
    }
    const files: any = file.url;
    return {
      data: files,
      statusCode: HttpStatus.OK,
      message: 'success upload file',
    };
  }
}
