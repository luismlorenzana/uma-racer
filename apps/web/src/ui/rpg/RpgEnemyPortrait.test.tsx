// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { LoadedContent } from '../../content/runtime'
import { RpgEnemyPortrait } from './RpgEnemyPortrait'

afterEach(cleanup)
describe('exact-pack enemy portrait',()=>{
  it('holds the hash-specific image while mounted and releases it on unmount',async()=>{
    const release=vi.fn(),hold=vi.fn(()=>release),load=vi.fn(async()=> 'blob:invented')
    const content={art:{has:()=>true,hold,load}} as unknown as LoadedContent
    const view=render(<RpgEnemyPortrait content={content} artId="example-abcdef12" name="Invented captain" />)
    await waitFor(()=>expect(screen.getByRole('img',{name:'Invented captain portrait'}).getAttribute('src')).toBe('blob:invented'))
    expect(hold).toHaveBeenCalledWith('priconne','example-abcdef12');expect(load).toHaveBeenCalledWith('priconne','example-abcdef12')
    view.rerender(<RpgEnemyPortrait content={content} name="Other invented captain" />)
    expect(screen.queryByRole('img')).toBeNull();expect(release).toHaveBeenCalledOnce()
    view.unmount();expect(release).toHaveBeenCalledOnce()
  })
  it('labels missing and failed art without substituting another character',async()=>{
    const content={art:{has:()=>true,load:async()=>{throw new Error('Invalid hash')}}} as unknown as LoadedContent
    render(<RpgEnemyPortrait content={content} artId="example-abcdef12" name="Invented captain" />)
    await waitFor(()=>expect(screen.getByLabelText('Invented captain portrait unavailable')).toBeTruthy())
    expect(screen.queryByRole('img')).toBeNull()
  })
})
