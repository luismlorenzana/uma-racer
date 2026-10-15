import { defineIcon } from './defineIcon'

/** Prize Money (Currency): a two-tone coin with a horseshoe struck on its face, until uma-art draws `currency/*`. */
export const CoinIcon = /* @__PURE__ */ defineIcon('coin', {
  line: <><circle cx="12" cy="12" r="8.25" /><circle cx="12" cy="12" r="5.6" /></>,
  detail: <path d="M9.6 14.6v-2.4a2.4 2.4 0 0 1 4.8 0v2.4" />,
  tone: <circle cx="12" cy="12" r="8.25" />,
})
