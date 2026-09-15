import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { ContentModule } from './content/content.module'
import { HealthController } from './health.controller'
import { SaveModule } from './save/save.module'

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), SaveModule, ContentModule],
  controllers: [HealthController],
})
export class AppModule {}
