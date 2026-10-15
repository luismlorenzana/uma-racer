// The save module (T135, T143): generation 2's routes on the Firestore repository in production or the local JSON file
// in dev, and the content its operations read. `AppModule` mounts it.
import { resolve } from 'node:path'
import { Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { AuthGuard } from '../auth/auth.guard'
import { ContentService } from '../content/content.service'
import { FirestoreSaveRepository } from './firestore-save.repository'
import { LocalSaveRepository } from './local-save.repository'
import { OperationContent } from './operation-content'
import { SaveController } from './save.controller'
import { SAVE_REPOSITORY, type SaveRepository } from './save.repository'

/** The dev save's default path, as `.env.example`'s `LOCAL_SAVE_FILE` names it (rearchitecture/07 §2). */
export const DEFAULT_LOCAL_SAVE_FILE = '.data/save-g2.json'

@Module({
  controllers: [SaveController],
  providers: [
    AuthGuard,
    {
      provide: SAVE_REPOSITORY,
      inject: [ConfigService],
      useFactory: (config: ConfigService): SaveRepository => {
        if ((config.get<string>('PERSISTENCE') ?? 'local') === 'firestore') return new FirestoreSaveRepository()
        return new LocalSaveRepository(resolve(process.cwd(), config.get<string>('LOCAL_SAVE_FILE') ?? DEFAULT_LOCAL_SAVE_FILE))
      },
    },
    {
      provide: OperationContent,
      inject: [ConfigService],
      useFactory: (config: ConfigService): OperationContent => new OperationContent(new ContentService(config)),
    },
  ],
})
export class SaveModule {}
