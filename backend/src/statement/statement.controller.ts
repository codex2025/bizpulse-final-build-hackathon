import { Controller, Post, UploadedFile, UseInterceptors, Req, UseGuards, HttpException, HttpStatus } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ConfigService } from '@nestjs/config';
import * as http from 'http';
import * as https from 'https';

@Controller('statement')
@UseGuards(JwtAuthGuard)
export class StatementController {
  constructor(private config: ConfigService) {}

  @Post('import')
  @UseInterceptors(FileInterceptor('file'))
  async importStatement(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new HttpException('No file uploaded', HttpStatus.BAD_REQUEST);
    }

    const aiUrl = this.config.get('AI_SERVICE_URL', 'http://localhost:8000');
    const boundary = `----FormBoundary${Math.random().toString(16).slice(2)}`;
    const bodyParts: Buffer[] = [];

    bodyParts.push(Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${file.originalname}"\r\nContent-Type: ${file.mimetype || 'application/octet-stream'}\r\n\r\n`
    ));
    bodyParts.push(file.buffer);
    bodyParts.push(Buffer.from(`\r\n--${boundary}--\r\n`));
    const body = Buffer.concat(bodyParts);

    const url = new URL(`${aiUrl}/import/statement`);
    const lib = url.protocol === 'https:' ? https : http;

    try {
      const data = await new Promise<any>((resolve, reject) => {
        const req = lib.request({
          hostname: url.hostname,
          port: url.port || (url.protocol === 'https:' ? 443 : 80),
          path: url.pathname,
          method: 'POST',
          headers: {
            'Content-Type': `multipart/form-data; boundary=${boundary}`,
            'Content-Length': body.length,
          },
        }, (res) => {
          let raw = '';
          res.on('data', (chunk) => (raw += chunk));
          res.on('end', () => {
            try {
              const parsed = JSON.parse(raw);
              if (res.statusCode && res.statusCode >= 400) {
                reject(new HttpException(parsed.detail || 'AI service error', res.statusCode));
              } else {
                resolve(parsed);
              }
            } catch {
              reject(new HttpException('Invalid response from AI service', HttpStatus.INTERNAL_SERVER_ERROR));
            }
          });
        });
        req.on('error', reject);
        req.write(body);
        req.end();
      });

      return data;
    } catch (err: any) {
      if (err instanceof HttpException) throw err;
      throw new HttpException(
        err?.message || 'Failed to parse statement',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
