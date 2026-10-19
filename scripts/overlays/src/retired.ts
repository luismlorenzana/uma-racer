// SE1's exact retired namespace, not "everything except the new release". Never matches saves, overlays or sources.
export function retiredMasterObject(path: string): boolean {
  return path === 'manifest.json'
    || /^data\/(umas|cards|skills|races|courses)\.[a-f0-9]{8}\.json$/.test(path)
    || /^atlases\/(uma-icons|card-icons|scenario-icons|skill-icons|type-icons)(?:[.-][a-z0-9-]+)*\.(?:json|webp)$/.test(path)
    || /^art\/(uma|card|bust|chibi|dress|face)\/[a-zA-Z0-9_-]+\.[a-f0-9]{8}\.webp$/.test(path)
}
