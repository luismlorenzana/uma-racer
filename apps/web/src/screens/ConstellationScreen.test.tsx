// @vitest-environment jsdom

import { FARM_CROPS, type InventoryStackData } from '@racer/domain'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ProduceNodeContents } from './ConstellationScreen'

const crops = FARM_CROPS.filter((crop) => crop.scenarioTier === 1)
const inventory: InventoryStackData[] = crops.map((crop, index) => ({
  itemId: crop.id,
  quantity: index === 0 ? 0 : index === 4 ? 12_345 : index,
  updatedAt: 1,
}))
const noop = () => undefined

const view = (over: Partial<Parameters<typeof ProduceNodeContents>[0]> = {}) => (
  <ProduceNodeContents
    assignment={undefined}
    tier={1}
    statPay={40}
    inventory={inventory}
    persistent
    busy={false}
    confirmCrop={null}
    result={null}
    onChoose={noop}
    onBack={noop}
    onConfirm={noop}
    {...over}
  />
)

afterEach(cleanup)

describe('Produce node picker', () => {
  it('names all five stat crops, disables zero stock and keeps large quantities readable to assistive tech', () => {
    const onChoose = vi.fn()
    render(view({ onChoose }))
    expect(screen.getAllByRole('button')).toHaveLength(5)
    const empty = screen.getByRole('button', { name: /Carrot.*Speed \+40.*×0/i }) as HTMLButtonElement
    expect(empty.disabled).toBe(true)
    expect(screen.getByRole('button', { name: /Blueberry.*Wit \+40.*×12345/i })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Sweet Potato.*Stamina \+40.*×1/i }))
    expect(onChoose).toHaveBeenCalledWith(crops[1])
  })

  it('labels a migrated node as Legacy with its preserved stat and value', () => {
    render(view({ assignment: { kind: 'legacy-produce', stat: 'power' } }))
    expect(screen.getByText('Legacy Power')).toBeTruthy()
    expect(screen.getByText('Current · Power +40')).toBeTruthy()
  })

  it('makes consumption, replacement deltas, inventory and the no-refund rule explicit before confirmation', () => {
    render(view({
      assignment: { kind: 'legacy-produce', stat: 'speed' },
      confirmCrop: crops[1]!,
      onConfirm: noop,
    }))
    expect(screen.getByText('Use Sweet Potato?')).toBeTruthy()
    expect(screen.getByText('Speed −40 · Stamina +40')).toBeTruthy()
    expect(screen.getByText(/Consume 1 crop · inventory 1 → 0/)).toBeTruthy()
    expect(screen.getByText(/does not refund/)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Consume 1 Sweet Potato' })).toBeTruthy()
  })

  it('shows the post-spend stat, quantity and exact Items link', () => {
    render(<MemoryRouter>{view({ result: { crop: crops[2]!, before: 4, after: 3 } })}</MemoryRouter>)
    expect(screen.getByRole('status').textContent).toContain('Inventory 4 → 3')
    expect(screen.getByText('Power +40')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'View Corn in Items' }).getAttribute('href'))
      .toBe('/farm/items?item=produce%3At1%3Apower')
  })
})
