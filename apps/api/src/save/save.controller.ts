// Generation 2's routes (docs/rearchitecture/01-target-architecture.md §6; docs/rearchitecture/07-data-reset.md §3–§4;
// docs/rework/13-removals-and-plan-changes.md §6, §8; T135): `GET /api/save`, `POST /api/sync` and
// `POST /api/legacy/purge`, all behind `AuthGuard`. Each runs the guard, then the stamp (anything but protocol 2 and
// generation 2 is 426, with nothing read or written), then T134's parser. Error bodies are developer text; the web turns
// every status into plain words (T136).
import { BadRequestException, Body, Controller, Get, HttpCode, HttpException, Inject, Post, Query, UseGuards } from '@nestjs/common'
import {
  isCurrentStamp, parsePurgeRequest, parseSnapshotQuery, parseSyncRequestV2, SAVE_GENERATION, SAVE_PROTOCOL, type PurgeResponse,
  type SaveSnapshotV2, type SyncResponseV2,
} from '@racer/domain/save'
import { AuthGuard, CurrentUid } from '../auth/auth.guard'
import { ContentUnavailable, OperationContent } from './operation-content'
import { NO_SAVE, parseCursor } from './resolve'
import { SAVE_REPOSITORY, type SaveRepository } from './save.repository'

/** 426: an old installed app, or anything not on generation 2 (07 §4). */
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
  snapshot(@CurrentUid() uid: string, @Query() query: Record<string, unknown>): Promise<SaveSnapshotV2> {
    const parsed = parseSnapshotQuery(query)
    if (parsed === undefined) throw upgradeRequired()
    if (typeof parsed === 'string') throw new BadRequestException(parsed)
    if (parsed.cursor !== null && parseCursor(parsed.cursor) === null) throw new BadRequestException('an invalid cursor')
    return this.saves.snapshot(uid, parsed.since, parsed.cursor)
  }

  /** The outbox, in order: 409 with no save and no create, 503 when an operation's content can't load; otherwise 200. */
  @Post('sync')
  @HttpCode(200)
  async sync(@CurrentUid() uid: string, @Body() body: unknown): Promise<SyncResponseV2> {
    if (!isCurrentStamp(body)) throw upgradeRequired()
    const request = parseSyncRequestV2(body)
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

  /** The one-time wipe of the owner's generation-1 save (07 §3); a second call answers `already` at once. */
  @Post('legacy/purge')
  @HttpCode(200)
  purge(@CurrentUid() uid: string, @Body() body: unknown): Promise<PurgeResponse> {
    if (!isCurrentStamp(body)) throw upgradeRequired()
    const request = parsePurgeRequest(body)
    if (typeof request === 'string') throw new BadRequestException(request)
    return this.saves.purge(uid)
  }
}
