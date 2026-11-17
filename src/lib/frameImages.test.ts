import { beforeEach, describe, expect, it, vi } from 'vitest'

const get = vi.fn()
vi.mock('@/services/appwrite/database', () => ({ databaseService: { get: (...args: unknown[]) => get(...args) } }))

import { getFramePicture, loadWithoutPictures } from '@/lib/frameImages'

const badRequest = Object.assign(new Error('Invalid query'), { code: 400 })

describe('loadWithoutPictures', () => {
  it('asks for the rows without their picture first', async () => {
    const load = vi.fn(async (queries: string[]) => queries)
    const used = await loadWithoutPictures(load)
    expect(load).toHaveBeenCalledTimes(1)
    expect(used).toHaveLength(1)
    const select = JSON.parse(used[0])
    expect(select.method).toBe('select')
    expect(select.values).not.toContain('image')
    expect(select.values).toContain('upstreamSize')
  })

  it('runs again as before when the database refuses the columns (400)', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const load = vi.fn(async (queries: string[]) => {
      if (queries.length > 0) throw badRequest
      return 'everything'
    })
    expect(await loadWithoutPictures(load)).toBe('everything')
    expect(load).toHaveBeenCalledTimes(2)
  })

  it('passes any other failure on', async () => {
    const down = Object.assign(new Error('offline'), { code: 500 })
    await expect(loadWithoutPictures(async () => Promise.reject(down))).rejects.toBe(down)
  })
})

describe('getFramePicture', () => {
  beforeEach(() => get.mockReset())

  it('fetches only the picture, and each picture once however often it is asked for', async () => {
    get.mockResolvedValue({ image: 'data:image/jpeg;base64,AAA' })
    const [first, second] = await Promise.all([getFramePicture('once'), getFramePicture('once')])
    expect(first).toBe('data:image/jpeg;base64,AAA')
    expect(second).toBe(first)
    expect(get).toHaveBeenCalledTimes(1)
    expect(get.mock.calls[0][0]).toBe('learning_content_frames')
    expect(get.mock.calls[0][1]).toBe('once')
    expect(JSON.parse(get.mock.calls[0][2][0]).values).toEqual(['image'])
  })

  it('takes the whole row if the database refuses the column list (400)', async () => {
    get.mockRejectedValueOnce(badRequest).mockResolvedValueOnce({ image: 'whole' })
    expect(await getFramePicture('refused')).toBe('whole')
    expect(get).toHaveBeenCalledTimes(2)
  })

  it('does not keep a failure: asking again tries again', async () => {
    get.mockRejectedValueOnce(new Error('offline'))
    await expect(getFramePicture('flaky')).rejects.toThrow('offline')
    get.mockResolvedValueOnce({ image: 'back' })
    expect(await getFramePicture('flaky')).toBe('back')
  })

  it('has no more than three requests going at once', async () => {
    let running = 0
    let most = 0
    get.mockImplementation(async () => {
      running += 1
      most = Math.max(most, running)
      await new Promise((resolve) => setTimeout(resolve, 5))
      running -= 1
      return { image: 'x' }
    })
    await Promise.all(Array.from({ length: 10 }, (_, index) => getFramePicture(`many-${index}`)))
    expect(most).toBeLessThanOrEqual(3)
    expect(get).toHaveBeenCalledTimes(10)
  })
})
