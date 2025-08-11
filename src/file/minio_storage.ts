import * as Minio from 'minio';

export interface MinioStorageConfig {
  bucket: string;
  endPoint: string;
  getFileName: (req: Express.Request, opt: { mimetype: string }) => string;
  port: number;
}

export class MinioStorage {
  minio: Minio.Client;

  _config: MinioStorageConfig;

  setMinioClient(_minio: Minio.Client) {
    this.minio = _minio;
  }

  setConfig(_config: MinioStorageConfig) {
    this._config = _config;
  }

  async _handleFile(req, file, cb) {
    try {
      const key = this._config.getFileName(req, file);
      const result: { [key: string]: string } = (await this.minio.putObject(
        this._config.bucket,
        key,
        file.stream,
        file.size,
      )) as unknown as { [key: string]: string };

      cb(null, {
        size: file.size,
        bucket: this._config.bucket,
        key: key,
        url: `${this._config.port === 443 ? 'https://' : 'http://'}${
          this._config.endPoint
        }/${this._config.bucket}/${key}`,
        ...result,
      });
    } catch (e) {
      cb(e);
      console.log(e);
    }
  }

  _removeFile(req, file, cb) {
    this.minio.removeObject(file.bucket, file.key, cb);
  }
}
