import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { AuthModule, authMode } from '@luismlorenzana/uma-server/auth'
import { ContentModule } from './content/content.module'
import { HealthController } from './health.controller'
import { SaveModule } from './save/save.module'

/**
 * The guard on every route, both games' (`@luismlorenzana/uma-server/auth`, SD4): a Firebase ID token whose email is
 * `ALLOWED_EMAIL` (401 without a valid token, 403 for anyone else), or everyone as `local-dev` with
 * `AUTH_MODE=disabled`. Health is `@Public()`. The env vars are the ones the API always read.
 */
export const authModule = () =>
  AuthModule.forRootAsync({
    inject: [ConfigService],
    useFactory: (config: ConfigService) => ({
      mode: authMode(config.get<string>('AUTH_MODE')),
      allowedEmail: config.get<string>('ALLOWED_EMAIL') ?? '',
    }),
  })

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), authModule(), SaveModule, ContentModule],
  controllers: [HealthController],
})
export class AppModule {}
