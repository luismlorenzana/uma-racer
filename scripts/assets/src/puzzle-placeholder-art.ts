// Repo-original SVG stand-ins, not PAD portraits (docs/technical/puzzle-content.md; D289).
import type { PuzzleElement } from '@racer/domain'

export type PlaceholderRank = 'scout' | 'guardian' | 'champion'
const colours: Record<PuzzleElement, string> = { fire: '#ef7945', water: '#56a9ef', wood: '#75bd75', light: '#eadbb3', dark: '#b096e4' }
const glyphs: Record<PuzzleElement, string> = {
  fire: '<path d="M80 49q-17 18-10 27 10 13 20-1 7-10-3-18v12q-5-5-7-20Z"/>',
  water: '<path d="M80 49q-20 22-9 30 9 7 18-1 10-9-9-29Z"/>',
  wood: '<path d="M65 77q-2-25 30-25 1 30-25 29l18-21"/>',
  light: '<path d="m80 47 5 13 14 1-11 9 3 14-11-8-12 8 4-14-11-9 14-1Z"/>',
  dark: '<path d="M91 48a19 19 0 1 0 9 28A19 19 0 0 1 91 48Z"/>',
}
export function puzzlePlaceholderSvg(element: PuzzleElement, rank: PlaceholderRank): string {
  const armour = rank === 'scout' ? '' : '<path d="m39 96 20 7v24l-12-4Zm82 0-20 7v24l12-4Z" fill="#243043" stroke="#fff" stroke-opacity=".6" stroke-width="2"/>'
  const crown = rank === 'champion' ? '<path d="m53 42-6-23 18 10 15-18 15 18 18-10-6 23Z" fill="#eadbb3" stroke="#fff" stroke-width="2"/>' : ''
  return `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 160 160">
    <ellipse cx="80" cy="138" rx="47" ry="7" fill="#000" opacity=".16"/>
    <path d="M40 65 29 35 63 49Q80 41 98 49L131 35 120 65Q142 122 108 133L52 133Q18 122 40 65Z" fill="${colours[element]}" stroke="#fff" stroke-opacity=".7" stroke-width="3"/>
    ${armour}${crown}<g fill="#fff" stroke="#fff" stroke-width="1.5">${glyphs[element]}</g>
    <ellipse cx="63" cy="94" rx="8" ry="11" fill="#243043"/><ellipse cx="99" cy="94" rx="8" ry="11" fill="#243043"/>
    <circle cx="65" cy="91" r="3" fill="#fff"/><circle cx="101" cy="91" r="3" fill="#fff"/>
    <path d="M70 115q10 10 20 0" fill="none" stroke="#243043" stroke-width="4" stroke-linecap="round"/>
  </svg>`
}
