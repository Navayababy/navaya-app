import { describe, it, expect, beforeEach } from 'vitest'
import { getOutbox, saveOutbox, enqueue, outboxSize } from './outbox.js'

beforeEach(() => localStorage.clear())

describe('outbox', () => {
  it('starts empty and returns [] on corrupt JSON', () => {
    expect(getOutbox()).toEqual([])
    localStorage.setItem('navaya_outbox', '{bad')
    expect(getOutbox()).toEqual([])
  })

  it('enqueues in order with attempt metadata and a queue id', () => {
    const first = enqueue('feed.insert', { id: 'a' })
    enqueue('feed.delete', { id: 'b' })
    const items = getOutbox()
    expect(items.map(i => i.type)).toEqual(['feed.insert', 'feed.delete'])
    expect(items[0]).toMatchObject({ payload: { id: 'a' }, attempts: 0 })
    expect(items[0].queuedAt).toBeTypeOf('number')
    expect(items[0].id).toBe(first.id)
    expect(items[0].id).not.toBe(items[1].id)
    expect(outboxSize()).toBe(2)
  })

  it('saveOutbox replaces the queue', () => {
    enqueue('feed.insert', { id: 'a' })
    saveOutbox([])
    expect(outboxSize()).toBe(0)
  })
})
