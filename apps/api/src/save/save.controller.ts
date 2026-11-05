// Generation 3's routes (docs/game/architecture.md "The save and sync"; D381; T152): `GET /api/save` and `POST /api/sync`,
// both behind `AuthGuard`. Each runs the guard, then the stamp (anything but protocol 3 and generation 3 is 426, with
// nothing read or written), then the domain's parser (400). Error bodies are developer text; the web turns every status
// into plain words.
import { BadRequestException, Body, Controller, Get, HttpCode, HttpException, Inject, Post, Query, UseGuards } from '@nestjs/common'
import {
  isCurrentStamp, parseSnapshotQuery, parseSyncRequest, SAVE_GENERATION, SAVE_PROTOCOL, type SaveSnapshot, type SyncResponse,
} from '@racer/domain/save'
import { AuthGuard, CurrentUid } from '@luismlorenzana/uma-server/auth'
import { ContentUnavailable, OperationContent } from './operation-content'
import { NO_SAVE, parseCursor } from './resolve'
import { SAVE_REPOSITORY, type SaveRepository } from './save.repository'

/** 426: an old installed app, or anything not on generation 3. */
export const upgradeRequired = (): HttpException =>
  new HttpException({ code: 'upgrade-required', protocol: SAVE_PROTOCOL, generation: SAVE_GENERATION }, 426)

@UseGuards(AuthGuard)
@Controller()
export class SaveController {
  constructor(
    @Inject(SAVE_REPOSITORY) private readonly saves: SaveRepository,
    @Inject(OperationContent) private readonly content: Pick<OperationContent, 'env'>,
  ) {}

  /** A page of the rows saved after `since`; the stamp rides in the query, since a GET has no body. */
  @Get('save')
  snapshot(@CurrentUid() uid: string, @Query() query: Record<string, unknown>): Promise<SaveSnapshot> {
    const parsed = parseSnapshotQuery(query)
    if (parsed === undefined) throw upgradeRequired()
    if (typeof parsed === 'string') throw new BadRequestException(parsed)
    if (parsed.cursor !== null && parseCursor(parsed.cursor) === null) throw new BadRequestException('an invalid cursor')
    return this.saves.snapshot(uid, parsed.since, parsed.cursor)
  }

  /** The outbox, in order: 409 with no save and no create, 503 when an operation's content can't load; otherwise 200. */
  @Post('sync')
  @HttpCode(200)
  async sync(@CurrentUid() uid: string, @Body() body: unknown): Promise<SyncResponse> {
    if (!isCurrentStamp(body)) throw upgradeRequired()
    const request = parseSyncRequest(body)
    if (typeof request === 'string') throw new BadRequestException(request)
    let result: Awaited<ReturnType<SaveRepository['sync']>>
    try {
      result = await this.saves.sync(uid, request, () => this.content.env())
    } catch (error) {
      if (error instanceof ContentUnavailable) throw new HttpException({ code: 'content-unavailable' }, 503)
      throw error
    }
    if (result === NO_SAVE) throw new HttpException({ code: 'no-save' }, 409)
    return result
  }

}
