import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';
import { FileService } from './file.service';
// import { multerConfig } from '#/config/multer.config';
import { FileControllers } from './file.controller';


@Module({
  imports: [
    ConfigModule,
    MulterModule.register({
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit
      },
      fileFilter: (req, file, callback) => {
        if (!file.originalname.match(/\.(jpg|jpeg|png)$/)) {
          return callback(new Error('Only image files are allowed!'), false);
        }
        callback(null, true);
      },
    }),
  ],
  controllers: [FileControllers],
  providers: [FileService],
})
export class FileModule {}