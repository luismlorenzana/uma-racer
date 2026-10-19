// The published proxies remain authenticated and allowlisted when mounted by Racer (SE1).
import 'reflect-metadata'
import { afterEach, describe, expect, it } from 'vitest'
import { Module, type INestApplication } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { NestFactory } from '@nestjs/core'
import { ReleaseProxyModule, PrivatePackModule } from '@luismlorenzana/uma-server/content'
import { authModule } from '../app.module'
import { OVERLAY_ALLOW } from './master.module'
import { masterFixture } from './master.test-support'

const apps: INestApplication[] = []
const previous = process.env.AUTH_MODE
afterEach(async () => { for (const app of apps.splice(0)) await app.close(); if (previous === undefined) delete process.env.AUTH_MODE; else process.env.AUTH_MODE = previous })
async function start(auth: boolean) {
  if (auth) delete process.env.AUTH_MODE; else process.env.AUTH_MODE = 'disabled'
  const F = await masterFixture()
  @Module({ imports: [ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }), authModule(),
    ReleaseProxyModule.forRoot({ source: { read: async (path) => F.release.objects.get(path) ?? null } }),
    PrivatePackModule.forRoot({ allow: OVERLAY_ALLOW, source: { read: async (path) => F.overlays.get(path) ?? null } })] })
  class TestApp {}
  const app = await NestFactory.create(TestApp, { logger: false }); app.setGlobalPrefix('api'); await app.listen(0, '127.0.0.1'); apps.push(app)
  return { base: `${await app.getUrl()}/api`, F }
}
describe('master and overlay routes', () => {
  it('requires auth on both route trees before revealing anything', async () => {
    const { base } = await start(true)
    for (const path of ['master/channels/v1/latest.json', 'content/overlay.json', 'master/overrides/secret.json']) expect((await fetch(`${base}/${path}`)).status).toBe(401)
  })
  it('serves latest and immutable files with the right cache policy; old packs and arbitrary paths are gone', async () => {
    const { base, F } = await start(false)
    const channel = await fetch(`${base}/master/channels/v1/latest.json`)
    expect(await channel.json()).toEqual(F.release.channel)
    expect(channel.headers.get('cache-control')).toContain('no-cache')
    const file = await fetch(`${base}/master/files/${F.release.manifest.sets.outfits}`)
    expect(file.status).toBe(200); expect(file.headers.get('cache-control')).toContain('immutable')
    expect((await fetch(`${base}/content/overlay.json`)).status).toBe(200)
    for (const path of ['master/overrides/flair.json', 'content/manifest', 'content/files/data/umas.aaaaaaaa.json', 'content/overrides/card-focus.json']) expect((await fetch(`${base}/${path}`)).status).toBe(404)
  })
})
