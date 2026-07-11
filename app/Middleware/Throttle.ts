import { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'

type RateEntry = { count: number; resetAt: number }

const rateMap = new Map<string, RateEntry>()

export default class Throttle {
  public async handle(ctx: HttpContextContract, next: () => Promise<void>, params?: string) {
    const ip = ctx.request.ip() || 'global'
    const url = ctx.request.url()
    const key = `${ip}:${url}`

    let limit = 60
    let minutes = 1
    if (params) {
      const parts = params.split(',').map((p) => p.trim())
      if (parts[0]) limit = parseInt(parts[0], 10) || limit
      if (parts[1]) minutes = parseInt(parts[1], 10) || minutes
    }

    const now = Date.now()
    const entry = rateMap.get(key)

    if (!entry || entry.resetAt <= now) {
      rateMap.set(key, { count: 1, resetAt: now + minutes * 60 * 1000 })
    } else {
      entry.count += 1
      rateMap.set(key, entry)
      if (entry.count > limit) {
        ctx.response.status(429).send({ error: 'Too many requests' })
        return
      }
    }

    await next()
  }
}
