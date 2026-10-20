// @vitest-environment jsdom
// Every Farm site uses the same kit actions through Racer's real port, not a component mock (SC5).
import { BUILDINGS, FARM_BUILDING_IDS } from '@racer/domain/farm'
import { craftedItem, FAMILY_IDS, rawItem } from '@racer/domain/items'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createMemoryGame } from '../../dev/memory'
import { renderG2, stubStorage } from '../../__fixtures__/testing'
import { apply, farmAccount, farmSeed, uma } from './__fixtures__/farm'

beforeEach(stubStorage)
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

it.each(FARM_BUILDING_IDS)('%s: start, queue three, recall, speed/finish, collect/repeat and upgrade', async (building) => {
  const { state, at } = farmAccount(1)
  const def = BUILDINGS[building]
  const item = def.family === null ? building === 'pantry' ? 'chopped-carrot' : 'tonic-1' : rawItem(def.family, 1).id
  const items = Object.fromEntries(FAMILY_IDS.flatMap((family) => [[rawItem(family, 1).id, 100], [craftedItem(family, 1).id, 100]]))
  const rich = apply(state, 'dev-grant', { prizeMoney: 100_000, items: { ...items, 'speed-ticket': 100 } }, at).state
  const game = createMemoryGame(farmSeed(rich, at), () => 0)
  const current = () => game.getSnapshot().state!
  const path = `/farm/${building}`
  const open = (query = '') => { cleanup(); return renderG2(path + query, game) }
  open(`?job=${item}&uma=${uma(1)}&count=1&slot=0`)
  fireEvent.click(await screen.findByRole('button', { name: /^Start · ×1 ·/ }))
  await waitFor(() => expect(current().work[uma(1)]?.slot?.building).toBe(building))
  for (let n = 1; n <= 3; n += 1) {
    fireEvent.click(await screen.findByRole('button', { name: 'More: Amber Sprint' }))
    fireEvent.click(within(await screen.findByRole('dialog', { name: /^Amber Sprint ·/ })).getByRole('link', { name: 'Queue next' }))
    const sheet = await screen.findByRole('dialog', { name: `Queue a job · ${def.name}` })
    fireEvent.click(within(sheet).getByRole('radio', { name: /^×1,/ }))
    fireEvent.click(within(sheet).getByRole('button', { name: /^Queue next · ×1 ·/ }))
    await waitFor(() => expect(current().work[uma(1)]!.queue).toHaveLength(n))
  }
  fireEvent.click(await screen.findByRole('button', { name: 'More: Amber Sprint' }))
  const more = await screen.findByRole('dialog', { name: /^Amber Sprint ·/ })
  within(more).getByText('Three are already queued.')
  fireEvent.click(within(more).getByRole('button', { name: 'Recall' }))
  const recall = await screen.findByRole('dialog', { name: 'Recall Amber Sprint' })
  within(recall).getByText('3 queued jobs dropped')
  fireEvent.click(within(recall).getByRole('button', { name: 'Recall' }))
  await waitFor(() => expect(current().work[uma(1)]).toBeUndefined())

  open(`?job=${item}&uma=${uma(1)}&count=1&slot=0`)
  fireEvent.click(await screen.findByRole('button', { name: /^Start · ×1 ·/ }))
  fireEvent.click(await screen.findByRole('button', { name: /^Speed up / }))
  let speed = await screen.findByRole('dialog', { name: /^Speed up / })
  fireEvent.click(within(speed).getByRole('button', { name: 'Take 30 minutes off with one Speed Ticket' }))
  await waitFor(() => expect(current().items['speed-ticket']).toBe(99))
  speed = await screen.findByRole('dialog', { name: /^Speed up / })
  fireEvent.click(within(speed).getByRole('button', { name: /^Finish now with / }))
  const yes = within(speed).queryByRole('button', { name: 'Yes' })
  if (yes) fireEvent.click(yes)
  const before = current().items[item] ?? 0
  await screen.findByRole('button', { name: /^Collect 1 / })
  fireEvent.click(screen.getByRole('button', { name: /^Collect and repeat / }))
  await waitFor(() => expect(current().items[item]).toBe(before + 1))
  expect(current().work[uma(1)]!.entries[0]!.request.kind).toBe(def.job)
  expect(current().items[item]).toBe(before + 1)

  fireEvent.click(screen.getByRole('button', { name: 'Upgrade to Lv 2' }))
  fireEvent.click(within(await screen.findByRole('dialog', { name: 'Upgrade to Lv 2' })).getByRole('button', { name: 'Yes' }))
  await waitFor(() => expect(current().buildings[building].level).toBe(2))
})
