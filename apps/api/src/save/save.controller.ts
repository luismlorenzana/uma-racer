import { BadRequestException, Body, Controller, Get, Inject, Post, UseGuards } from '@nestjs/common'
import { AuthGuard, CurrentUid } from '../auth/auth.guard'
import { SAVE_REPOSITORY, type SaveRepository } from './save.repository'
import { parseSyncRequest } from './save.types'
import { parseRpgCommandRequest } from './rpg-command'
import { parsePuzzlePrepareRequest, parsePuzzleTakeoverRequest, PUZZLES_RELEASE_ENABLED } from './puzzles'

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

  /** All RPG projections and evidence move as one conditional command. */
  @Post('inspiration/advance')
  async advanceInspiration(@CurrentUid() uid: string, @Body() body: unknown) {
    if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).length) throw new BadRequestException('body must be {}')
    try { return await this.saves.advanceInspiration(uid) }
    catch (error) { throw new BadRequestException(error instanceof Error ? error.message : 'Inspiration advance failed') }
  }

  /** All RPG projections and evidence move as one conditional command. */
  @Post('rpg/command')
  rpgCommand(@CurrentUid() uid: string, @Body() body: unknown) {
    const parsed = parseRpgCommandRequest(body)
    if (typeof parsed === 'string') throw new BadRequestException(parsed)
    return this.saves.rpgCommand(uid, parsed)
  }

  /** Explicit authenticated account boundary. T115 implements preparation; T116 alone enables release. */
  @Post('puzzles/prepare')
  preparePuzzles(@CurrentUid() _uid: string, @Body() body: unknown) {
    if (!parsePuzzlePrepareRequest(body)) throw new BadRequestException('Invalid Puzzle preparation request')
    return { status: PUZZLES_RELEASE_ENABLED ? 'not-ready' : 'disabled' }
  }

  @Post('puzzles/takeover')
  puzzleTakeover(@CurrentUid() uid: string, @Body() body: unknown) {
    const request = parsePuzzleTakeoverRequest(body)
    if (!request) throw new BadRequestException('Invalid Puzzle takeover request')
    return this.saves.puzzleTakeover(uid, request)
  }
}
