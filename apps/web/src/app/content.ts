// The private content the art reads (T137, T143): the `face`, `chibi` and `bust` art and the `uma-icons` atlas, from the
// content provider through the session. The seeds' mount has no content, so every image falls back to the Uma's initial.
import type { LoadedContent } from '../content/view'
import { createContext, useContext } from 'react'

export const G2ContentContext = createContext<LoadedContent | null>(null)

export const useG2Content = (): LoadedContent | null => useContext(G2ContentContext)
