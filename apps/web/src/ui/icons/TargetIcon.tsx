import { defineG2Icon } from './define'

/** Target (Planner): the crosshair on an Uma the planner works toward (rework/02 §6; the Stable's tiles, T138). */
export const TargetIcon = /* @__PURE__ */ defineG2Icon('target', {
  line: <circle cx="12" cy="12" r="7" />,
  detail: <><path d="M12 2.8v4M12 17.2v4M2.8 12h4M17.2 12h4" /><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" /></>,
  tone: <circle cx="12" cy="12" r="7" />,
})
