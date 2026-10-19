// Game-facing view over a platform release; no old pack paths or import protocol (SE1).
import type { ContentAtlas, ContentAtlasFrame, ContentAtlasKind, CourseTemplate, RaceTemplate, SkillTemplate, SupportCardTemplate, UmaTemplate } from '@racer/domain'

export interface ContentRegistry<T extends { id: string }> { items: readonly T[]; byId: ReadonlyMap<string, T> }
export interface LoadedAtlas { descriptor: ContentAtlas; pageUrls: readonly string[] }
export type ArtKind = 'uma' | 'card' | 'bust' | 'chibi' | 'dress' | 'face'
export interface ArtLoader {
  has(kind: ArtKind, id: string): boolean
  load(kind: ArtKind, id: string): Promise<string | null>
  hold?(kind: ArtKind, id: string): () => void
}
export interface LoadedContent {
  manifest: { version: string }
  origin: 'network' | 'offline-cache'
  umas: ContentRegistry<UmaTemplate>; cards: ContentRegistry<SupportCardTemplate>; skills: ContentRegistry<SkillTemplate>
  races: ContentRegistry<RaceTemplate>; courses: ContentRegistry<CourseTemplate>
  atlases: Record<'uma-icons' | 'card-icons', LoadedAtlas> & Partial<Record<'scenario-icons' | 'skill-icons', LoadedAtlas>>
  art: ArtLoader
}
export interface ContentAsset { url: string; frame: ContentAtlasFrame; pageWidth: number; pageHeight: number }
export type ContentLoadResult = { status: 'ready'; content: LoadedContent } | { status: 'empty' }
export interface ObjectUrlFactory { create(blob: Blob): string; revoke(url: string): void }
export function getContentAsset(content: LoadedContent, kind: ContentAtlasKind, id: string): ContentAsset | null {
  const atlas = content.atlases[kind], frame = atlas?.descriptor.frames[id]
  const page = frame === undefined ? undefined : atlas?.descriptor.pages[frame.page]
  return atlas === undefined || frame === undefined || page === undefined ? null
    : { url: atlas.pageUrls[frame.page]!, frame, pageWidth: page.width, pageHeight: page.height }
}
