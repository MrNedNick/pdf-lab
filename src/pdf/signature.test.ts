import { describe, expect, it } from 'vitest'
import { inkBounds, knockOutPaper } from './signature'

function pixels(width: number, height: number, paint: (x: number, y: number) => [number, number, number, number]) {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) data.set(paint(x, y), (y * width + x) * 4)
  return { data, width, height }
}

describe('inkBounds', () => {
  it('finds the box around the strokes', () => {
    const pad = pixels(10, 8, (x, y) => (x >= 2 && x <= 6 && y >= 3 && y <= 4 ? [0, 0, 0, 255] : [0, 0, 0, 0]))
    expect(inkBounds(pad)).toEqual({ x: 2, y: 3, width: 5, height: 2 })
  })

  it('says an empty pad is empty', () => {
    expect(inkBounds(pixels(4, 4, () => [0, 0, 0, 0]))).toBeNull()
  })
})

describe('knockOutPaper', () => {
  it('makes paper clear, keeps ink, and fades the edge in between', () => {
    const photo = pixels(3, 1, (x) => (x === 0 ? [245, 242, 235, 255] : x === 1 ? [30, 40, 90, 255] : [160, 160, 160, 255]))
    knockOutPaper(photo)
    expect([photo.data[3], photo.data[7]]).toEqual([0, 255])
    expect(photo.data[11]).toBeGreaterThan(0)
    expect(photo.data[11]).toBeLessThan(255)
  })
})
