import { 
  Controller, 
  Post, 
  UseInterceptors, 
  UploadedFile, 
  Get, 
  Param, 
  Query,
  UseFilters,
  HttpStatus
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { FileService } from './file.service';
import { File as MulterFile } from 'multer';

@Controller('file-gdrive')
export class FileController {
  constructor(private readonly fileservice: FileService) {} 

  @Post('upload')
  async uploadImage(@UploadedFile() file: MulterFile) {
    const url = await this.fileservice.uploadImage(file);
   return {
         data: url,
         statusCode: HttpStatus.OK,
         message: 'success upload file',
    };
  }

  @Get('get-image')
  async getImage(@Query('url') imageUrl: string) {
    const retrievedImageUrl = await this.fileservice.getImage(imageUrl);
    return { url: retrievedImageUrl };
  }
}