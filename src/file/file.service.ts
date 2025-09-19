import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google } from 'googleapis';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';
import * as url from 'url';
import * as stream from 'stream';
import type * as multer from 'multer';

@Injectable()
export class FileService {}
