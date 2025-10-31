// src/interceptors/skip-logging.decorator.ts
import { SetMetadata } from '@nestjs/common';
import { SKIP_LOGGING } from './logging.interceptor';

export const SkipLogging = () => SetMetadata(SKIP_LOGGING, true);