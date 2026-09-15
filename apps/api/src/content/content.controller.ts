import { Controller, Get, Param, Res, UseGuards } from '@nestjs/common'
import type { Response } from 'express'
import { AuthGuard } from '../auth/auth.guard'
import { ContentService } from './content.service'

@UseGuards(AuthGuard)
@Controller('content')
export class ContentController {
  constructor(private readonly content: ContentService) {}

  @Get('manifest')
  manifest() {
    return this.content.manifest()
  }

  /** Content files are named by hash, so they can be cached forever (privately, on the device). */
  @Get('files/*path')
  async file(@Param('path') path: string | string[], @Res() res: Response) {
    const joined = Array.isArray(path) ? path.join('/') : path
    const { stream, contentType, bytes } = await this.content.open(joined)
    res.setHeader('Content-Type', contentType)
    res.setHeader('Cache-Control', 'private, max-age=31536000, immutable')
    if (bytes !== undefined) res.setHeader('Content-Length', String(bytes))
    stream.on('error', () => res.destroy())
    stream.pipe(res)
  }
}
