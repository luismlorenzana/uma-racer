// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it } from 'vitest'
import { RpgHubContent } from './RpgScreen'
import { releaseProofFixture, releaseProofNames } from './release-proof-fixture'
afterEach(cleanup)
describe('playable hub projection', () => {
  it.each([['at-checkpoint', 'Resume chapter'], ['in-battle', 'Continue saved battle'], ['pending-result', 'Collect accepted win'], ['cleared', 'Review clear / replay']] as const)('labels the foreground %s without starting or rerolling anything', (status, action) => {
    const f = releaseProofFixture(status)
    render(<MemoryRouter><RpgHubContent {...f} content={null} ownedIds={Object.keys(releaseProofNames)} names={releaseProofNames} retryRelease={() => undefined} /></MemoryRouter>)
    expect(screen.getByRole('link', { name: `${action} · Crossroads party` }).getAttribute('href')).toBe('/rpg/chapters/party-1?chapter=test-chapter')
    expect(screen.queryByRole('link', { name: /Choose chapter · Party 2/ })).toBeNull()
    expect(screen.getAllByRole('link', { name: 'Edit party' })).toHaveLength(5)
    expect(screen.getByLabelText('Crossroads party members').children).toHaveLength(5)
  })
  it('offers retained checkpoint recovery, not new entry, when the current publication is unavailable', () => {
    const f = releaseProofFixture()
    render(<MemoryRouter><RpgHubContent {...f} release={{ status: 'unavailable', reason: 'Offline / missing pack' }} content={null} ownedIds={Object.keys(releaseProofNames)} retryRelease={() => undefined} /></MemoryRouter>)
    expect(screen.getByRole('link', { name: 'Review saved chapter / content recovery' })).toBeTruthy()
    expect(screen.queryByRole('link', { name: /Resume chapter ·/ })).toBeNull()
    expect(screen.getByRole('button', { name: 'Retry campaign check' })).toBeTruthy()
  })
})
