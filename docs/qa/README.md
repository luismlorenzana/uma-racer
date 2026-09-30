# Synthetic mobile QA captures

T086 captures use the production `ProduceNodeContents` and `BottomSheet` components with invented stats and quantities, at
the named viewport sizes. They contain no original-game content. The temporary preview harness was removed after capture.

- `t086-empty-390x844.png` — five crop choices and zero-stock state.
- `t086-legacy-375x667.png` — migrated legacy node and scroll-safe picker.
- `t086-confirm-390x844.png` — replacement delta, no-refund notice, and confirmation.
- `t086-result-390x844.png` — changed stats, inventory and Items link.

These document layout and accessible copy, not a committed save transaction; the transactional tests cover that behavior.
