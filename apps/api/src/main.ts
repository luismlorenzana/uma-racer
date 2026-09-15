import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import { ConfigService } from '@nestjs/config'
import type { NestExpressApplication } from '@nestjs/platform-express'
import { AppModule } from './app.module'

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule)
  const config = app.get(ConfigService)

  const origin = config.get<string>('ALLOWED_ORIGIN') ?? 'http://localhost:5173'
  app.enableCors({ origin: origin.split(',').map((o) => o.trim()), credentials: false })
  // Sync batches carry whole entities; keep headroom above Express's 100 kB default.
  app.useBodyParser('json', { limit: '5mb' })

  // API routes live under /api; /healthz stays at the root for Cloud Run probes.
  app.setGlobalPrefix('api', { exclude: ['healthz'] })

  const port = Number(config.get('PORT') ?? 8080)
  await app.listen(port, '0.0.0.0')
  // eslint-disable-next-line no-console
  console.log(
    `[api] listening on :${port} (persistence=${config.get('PERSISTENCE') ?? 'local'}, content=${config.get('CONTENT_SOURCE') ?? 'local'}, auth=${config.get('AUTH_MODE') ?? 'on'})`,
  )
}

void bootstrap()
