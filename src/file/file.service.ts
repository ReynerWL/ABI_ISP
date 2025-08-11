import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google } from 'googleapis';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';
import * as url from 'url'
import * as stream from 'stream';
import type * as multer from 'multer';

@Injectable()
export class FileService {
  private drive: any;
  private readonly logger = new Logger(FileService.name);

  constructor(private readonly configService: ConfigService) {
  try {
    // Get the raw private key
    const privateKey = this.configService.get<string>('drive.google_private_key')
      .replace(/\\n/g, '\n')         // Replace \n string with actual newlines
      .replace(/["']/g, '')          // Remove any quotes
      .trim(); 
    
    if (!privateKey) {
      throw new Error('Google Drive private key is not configured');
    }

    // Create credentials object
    const credentials = {
      type: 'service_account',
      project_id: this.configService.get('drive.google_project_id'),
      private_key: privateKey,
      client_email: this.configService.get('drive.google_client_email'),
      client_id: this.configService.get('drive.google_client_id'),
      auth_uri: 'https://accounts.google.com/o/oauth2/auth',
      token_uri: 'https://oauth2.googleapis.com/token',
      auth_provider_x509_cert_url: this.configService.get('drive.auth_provider_x509_cert_url'),
    };

    // Initialize the auth client
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/drive.file'],
    });

    // Initialize drive client
    this.drive = google.drive({
      version: 'v3',
      auth,
    });

    // Verify the credentials work
    auth.getClient()
      .then(() => console.log('Google Drive authentication successful'))
      .catch(err => console.error('Google Drive authentication failed:', err));

  } catch (error) {
    console.error('Failed to initialize Google Drive service:', error);
    throw new Error(`Drive initialization failed: ${error.message}`);
  }
}

  private extractFileIdFromUrl(url: string): string {
    const match = url.match(/[-\w]{25,}/);
    return match ? match[0] : '';
  }
  async uploadImage(file: multer.File): Promise<string> {
  try {
    console.log('Starting upload process...');
    console.log('File type:', file.mimetype);
    console.log('File size:', file.size);

    // Validate file type explicitly
    if (!['image/png', 'image/jpeg', 'image/jpg'].includes(file.mimetype)) {
      throw new BadRequestException('Unsupported file type. Only PNG and JPEG are supported.');
    }

    // Ensure we have a valid buffer
    if (!file.buffer || !Buffer.isBuffer(file.buffer)) {
      throw new BadRequestException('Invalid file buffer');
    }

    const uniqueFileName = `${uuidv4()}${path.extname(file.originalname)}`;

    // Create a PassThrough stream instead of using Readable.from
    const passThrough = new stream.PassThrough();
    passThrough.end(file.buffer);

    const response = await this.drive.files.create({
      requestBody: {
        name: uniqueFileName,
        parents: [this.configService.get('drive.google_image_folder')],
        // Explicitly set the MIME type in the file metadata
        mimeType: file.mimetype,
      },
      media: {
        mimeType: file.mimetype,
        body: passThrough,
      },
      fields: 'id, webViewLink',
    });

    // Make the file publicly accessible
    await this.drive.permissions.create({
      fileId: response.data.id,
      requestBody: {
        role: 'reader',
        type: 'anyone',
      },
    });

    return `https://drive.google.com/thumbnail?id=${response.data.id}`;
  } catch (error) {
    // Enhanced error logging
    console.error('Upload error details:', {
      message: error.message,
      stack: error.stack,
      code: error.code,
      details: error.details,
    });
    
    throw new BadRequestException(`Failed to upload image: ${error.message}`);
  }
}

  async verifyFolderAccess(folderId: string): Promise<void> {
    try {
      await this.drive.files.get({
        fileId: folderId,
        fields: 'id,name',
      });
    } catch (error) {
      this.logger.error(
        `Folder Access Verification Failed for Folder ID: ${folderId}.`,
        error.response?.data || error.message,
      );
      throw new BadRequestException(
        'Cannot access specified Google Drive folder',
      );
    }
  }

  async createPublicPermission(fileId: string): Promise<void> {
    try {
      await this.drive.permissions.create({
        fileId,
        requestBody: {
          role: 'reader',
          type: 'anyone',
        },
      });
    } catch (error) {
      this.logger.error(
        `Failed to create public permission for file ${fileId}`,
        error,
      );
    }
  }

  async generateDirectViewLink(fileId: string): Promise<string> {
    return `https://drive.google.com/uc?id=${fileId}`;
  }

  async getImage(imageUrl: string): Promise<string> {
    try {
      const fileId = this.extractFileIdFromUrl(imageUrl);

      const response = await this.drive.files.get({
        fileId,
        fields: 'webContentLink,id,name,mimeType',
      });

      return response.data.webContentLink;
    } catch (error) {
      console.error('Image retrieval error:', error);
      throw new BadRequestException('Failed to retrieve image');
    }
  }
}