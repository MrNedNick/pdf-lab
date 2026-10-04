import { describe, expect, it } from 'vitest'
import { routeFrom } from './router'

describe('routes', () => {
  it('reads the tool from the address under any base', () => {
    expect(routeFrom('/pdf-lab/merge/', '/pdf-lab/')).toBe('merge')
    expect(routeFrom('/pdf-lab/', '/pdf-lab/')).toBe('')
    expect(routeFrom('/split', '/')).toBe('split')
  })
})
