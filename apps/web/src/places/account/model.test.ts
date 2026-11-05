// Account's view model (T138, T152; D157): the sync row's words are plain, and the dev grants are inputs `dev-grant`
// takes, ticket by ticket.
import { devGrant } from '@racer/domain/account'
import { describe, expect, it } from 'vitest'
import { hasBannedWord } from '../../save/words'
import { DEV_GRANTS, SYNC_WORDS } from './model'

describe('Account', () => {
  it('says every sync state in plain words', () => {
    expect(Object.keys(SYNC_WORDS).sort()).toEqual(['failing', 'offline', 'paused', 'synced', 'waiting'])
    for (const words of Object.values(SYNC_WORDS)) expect(hasBannedWord(words), words).toBe(false)
  })

  it('grants Uma Tickets and Card Tickets, each one a valid `dev-grant` input', () => {
    expect(DEV_GRANTS.map((grant) => grant.label)).toEqual(['+5 Uma Tickets', '+5 Card Tickets'])
    for (const grant of DEV_GRANTS) expect(devGrant.parse(grant.input)).toEqual(grant.input)
  })
})
