import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { ContentModule } from './content/content.module'
import { HealthController } from './health.controller'
import { SaveG2Module } from './save-g2/save-g2.module'

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), SaveG2Module, ContentModule],
  controllers: [HealthController],
})
export class AppModule {}
