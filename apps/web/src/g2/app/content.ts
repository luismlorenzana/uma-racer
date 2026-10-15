// The private content the new game's art reads (T137): today's `face`, `chibi` and `bust` art and the `uma-icons` atlas.
// The dev mount mounts no content, so every image falls back to the Uma's initial; T143 feeds today's ContentProvider in.
import type { LoadedContent } from '../../content/runtime'
import { createContext, useContext } from 'react'

export const G2ContentContext = createContext<LoadedContent | null>(null)

export const useG2Content = (): LoadedContent | null => useContext(G2ContentContext)
