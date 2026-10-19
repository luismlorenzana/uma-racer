// What the API answers after the generation-2 switch (T143 "Acceptance"; rearchitecture/06 §6): health, the save, sync,
// the one-release purge and the private content, and no other route. Read from the mounted modules' route metadata.
import 'reflect-metadata'
import { RequestMethod, type Type, type DynamicModule } from '@nestjs/common'
import { METHOD_METADATA, MODULE_METADATA, PATH_METADATA } from '@nestjs/common/constants'
import { describe, expect, it } from 'vitest'
import { AppModule } from './app.module'

function controllersOf(module: Type | DynamicModule): Type[] {
  const target = typeof module === 'function' ? module : module.module
  const own = (Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, target) ?? []) as Type[]
  const imports = [...(Reflect.getMetadata(MODULE_METADATA.IMPORTS, target) ?? []) as unknown[], ...(typeof module === 'function' ? [] : module.imports ?? [])]
  return [...own, ...(typeof module === 'function' ? [] : module.controllers ?? []), ...imports
    .filter((entry): entry is Type | DynamicModule => typeof entry === 'function' || typeof entry === 'object' && entry !== null && 'module' in entry).flatMap(controllersOf)]
}

function routesOf(controller: Type): string[] {
  const base = (Reflect.getMetadata(PATH_METADATA, controller) ?? '') as string
  const proto = controller.prototype as Record<string, object>
  return Object.getOwnPropertyNames(proto).flatMap((name) => {
    const handler = proto[name]!
    const method = Reflect.getMetadata(METHOD_METADATA, handler) as RequestMethod | undefined
    if (method === undefined) return []
    const path = [base, Reflect.getMetadata(PATH_METADATA, handler) as string].filter((part) => part !== '' && part !== '/').join('/')
    return [`${RequestMethod[method]} /api/${path}`]
  })
}

describe('the API', () => {
  it('answers only health, the save, sync, the purge and the content', () => {
    expect(controllersOf(AppModule).flatMap(routesOf).sort()).toEqual([
      'GET /api/content/*path',
      'GET /api/health',
      'GET /api/master/*path',
      'GET /api/save',
      'POST /api/legacy/purge',
      'POST /api/sync',
    ])
  })
})
