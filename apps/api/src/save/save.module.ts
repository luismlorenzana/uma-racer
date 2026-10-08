import { resolve } from 'node:path'
import { Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { AuthGuard } from '../auth/auth.guard'
import { FirestoreSaveRepository } from './firestore-save.repository'
import { LocalSaveRepository } from './local-save.repository'
import { SaveController } from './save.controller'
import { SAVE_REPOSITORY, type SaveRepository } from './save.repository'
import { ContentService } from '../content/content.service'
import { verifiedPreservationContent } from './puzzle-preservation-content'

@Module({
  controllers: [SaveController],
  providers: [
    AuthGuard,
    {
      provide: SAVE_REPOSITORY,
      inject: [ConfigService],
      useFactory: (config: ConfigService): SaveRepository => {
        const content = new ContentService(config), verify = (hash?: string) => verifiedPreservationContent(content, hash)
        if ((config.get<string>('PERSISTENCE') ?? 'local') === 'firestore') return new FirestoreSaveRepository(undefined, undefined, verify)
        const file = config.get<string>('LOCAL_SAVE_FILE') ?? '.data/save.json'
        return new LocalSaveRepository(resolve(process.cwd(), file), undefined, verify)
      },
    },
  ],
})
export class SaveModule {}
