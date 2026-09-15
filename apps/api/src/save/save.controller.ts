import { BadRequestException, Body, Controller, Get, Inject, Post, UseGuards } from '@nestjs/common'
import { AuthGuard, CurrentUid } from '../auth/auth.guard'
import { SAVE_REPOSITORY, type SaveRepository } from './save.repository'
import { parseSyncRequest } from './save.types'

@UseGuards(AuthGuard)
@Controller()
export class SaveController {
  constructor(@Inject(SAVE_REPOSITORY) private readonly saves: SaveRepository) {}

  /** Full pull, used on a new device or an empty local save. */
  @Get('save')
  load(@CurrentUid() uid: string) {
    return this.saves.load(uid)
  }

  /** Batched outbox flush from the client. */
  @Post('sync')
  sync(@CurrentUid() uid: string, @Body() body: unknown) {
    const parsed = parseSyncRequest(body)
    if (typeof parsed === 'string') throw new BadRequestException(parsed)
    return this.saves.sync(uid, parsed)
  }
}
