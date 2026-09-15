import { Module } from '@nestjs/common'
import { AuthGuard } from '../auth/auth.guard'
import { ContentController } from './content.controller'
import { ContentService } from './content.service'

@Module({
  controllers: [ContentController],
  providers: [AuthGuard, ContentService],
})
export class ContentModule {}
