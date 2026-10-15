// Generation 2's save module (docs/tasks/M034-generation-2-cutover.md; T135), built beside today's `SaveModule`, which it
// follows. `AppModule` does not import it: T143 mounts it and deletes today's.
import { resolve } from 'node:path'
import { Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { AuthGuard } from '../auth/auth.guard'
import { ContentService } from '../content/content.service'
import { FirestoreSaveG2Repository } from './firestore-save-g2.repository'
import { LocalSaveG2Repository } from './local-save-g2.repository'
import { OperationContent } from './operation-content'
import { SaveG2Controller } from './save-g2.controller'
import { SAVE_G2_REPOSITORY, type SaveG2Repository } from './save-g2.repository'

/** The dev save's default path; T143 points `LOCAL_SAVE_FILE` here. */
export const LOCAL_SAVE_G2_FILE = '.data/save-g2.json'

@Module({
  controllers: [SaveG2Controller],
  providers: [
    AuthGuard,
    {
      provide: SAVE_G2_REPOSITORY,
      inject: [ConfigService],
      useFactory: (config: ConfigService): SaveG2Repository => {
        if ((config.get<string>('PERSISTENCE') ?? 'local') === 'firestore') return new FirestoreSaveG2Repository()
        return new LocalSaveG2Repository(resolve(process.cwd(), config.get<string>('LOCAL_SAVE_FILE') ?? LOCAL_SAVE_G2_FILE))
      },
    },
    {
      provide: OperationContent,
      inject: [ConfigService],
      useFactory: (config: ConfigService): OperationContent => new OperationContent(new ContentService(config)),
    },
  ],
})
export class SaveG2Module {}
