import { describe, expect, it } from 'vitest'
import { changed, move, remove, rotate, selectRange, tilesFor } from './organize'

const order = (tiles: { source: number }[]) => tiles.map((tile) => tile.source)

describe('organizing pages', () => {
  it('moves a page forward and back', () => {
    expect(order(move(tilesFor(4), 0, 2))).toEqual([1, 2, 0, 3])
    expect(order(move(tilesFor(4), 3, 0))).toEqual([3, 0, 1, 2])
  })

  it('turns only the chosen pages, both ways round', () => {
    const turned = rotate(tilesFor(3), new Set([1]), -90)
    expect(turned.map((tile) => tile.rotation)).toEqual([0, 270, 0])
    expect(rotate(turned, new Set([1]), 90)[1]!.rotation).toBe(0)
  })

  it('removes the chosen pages', () => {
    expect(order(remove(tilesFor(4), new Set([0, 2])))).toEqual([1, 3])
  })

  it('selects a range in the current order, whichever end was clicked first', () => {
    const tiles = move(tilesFor(5), 4, 0) // 4 0 1 2 3
    expect([...selectRange(tiles, 1, 4)].sort()).toEqual([0, 1, 4])
    expect([...selectRange(tiles, 4, 1)].sort()).toEqual([0, 1, 4])
  })

  it('knows when there is nothing to save', () => {
    expect(changed(tilesFor(3), 3)).toBe(false)
    expect(changed(move(tilesFor(3), 0, 1), 3)).toBe(true)
  })
})
