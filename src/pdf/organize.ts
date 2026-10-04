/** A page in the organizer: where it came from, how it is turned, a stable key for React. */
export interface Tile {
  key: number
  source: number
  rotation: number
}

export const tilesFor = (count: number): Tile[] =>
  Array.from({ length: count }, (_, index) => ({ key: index, source: index, rotation: 0 }))

/** Moves one tile to a new position, everything else keeps its order. */
export function move(tiles: Tile[], from: number, to: number): Tile[] {
  if (from === to || from < 0 || from >= tiles.length) return tiles
  const next = tiles.slice()
  const [tile] = next.splice(from, 1)
  next.splice(Math.max(0, Math.min(next.length, to)), 0, tile!)
  return next
}

export function rotate(tiles: Tile[], keys: Set<number>, by: 90 | -90): Tile[] {
  return tiles.map((tile) => (keys.has(tile.key) ? { ...tile, rotation: (tile.rotation + by + 360) % 360 } : tile))
}

export function remove(tiles: Tile[], keys: Set<number>): Tile[] {
  return tiles.filter((tile) => !keys.has(tile.key))
}

/** Shift-click selects everything between the last click and this one. */
export function selectRange(tiles: Tile[], anchor: number, target: number): Set<number> {
  const from = tiles.findIndex((tile) => tile.key === anchor)
  const to = tiles.findIndex((tile) => tile.key === target)
  if (from < 0 || to < 0) return new Set([target])
  const [lo, hi] = from < to ? [from, to] : [to, from]
  return new Set(tiles.slice(lo, hi + 1).map((tile) => tile.key))
}

export const changed = (tiles: Tile[], count: number) =>
  tiles.length !== count || tiles.some((tile, index) => tile.source !== index || tile.rotation !== 0)
