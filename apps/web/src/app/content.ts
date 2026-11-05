// The private content the art reads (T137, T143): the `face`, `chibi` and `bust` art and the `uma-icons` atlas, from the
// content provider through the session. Without content (tests), every image falls back to the Uma's initial.
import type { LoadedContent } from '../content/view'
import { createContext, useContext } from 'react'

export const ContentContext = createContext<LoadedContent | null>(null)

export const useLoadedContent = (): LoadedContent | null => useContext(ContentContext)
