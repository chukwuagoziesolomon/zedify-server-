import { ServerResponse } from 'http'
import Logger from '@ioc:Adonis/Core/Logger'

export type SseEvent =
  | 'wallet.balance_updated'
  | 'transaction.created'
  | 'transaction.confirmed'
  | 'withdrawal.created'
  | 'withdrawal.updated'
  | 'payment.completed'
  | 'shop.customization_unlocked'
  | 'wallet.deposit_credited'

export interface SseMessage<T = any> {
  event: SseEvent
  data: T
}

interface SseClient {
  userId: string
  res: ServerResponse
  createdAt: number
}

/**
 * SseService
 *
 * Singleton in-memory registry for all open SSE connections.
 * Supports multiple concurrent connections per user (e.g. two browser tabs).
 *
 * Usage (push to a specific user):
 *   SseService.emit(userId, { event: 'wallet.balance_updated', data: { ... } })
 *
 * Usage (broadcast to all connected users):
 *   SseService.broadcast({ event: 'wallet.balance_updated', data: { ... } })
 */
class SseServiceClass {
  /** Map<userId, Set<SseClient>> — one user can have multiple open tabs */
  private clients = new Map<string, Set<SseClient>>()

  constructor() {
    setInterval(() => this.heartbeat(), 25_000)
  }

  // ─── Registration ──────────────────────────────────────────────────────────

  /**
   * Register an incoming HTTP response as an SSE stream for `userId`.
   * Call this from the SSE controller action.
   * Returns a cleanup function — call it when the connection closes.
   */
  public register(userId: string, res: ServerResponse): () => void {
    // SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // disable nginx buffering
    })
    res.flushHeaders()

    const client: SseClient = { userId, res, createdAt: Date.now() }

    if (!this.clients.has(userId)) {
      this.clients.set(userId, new Set())
    }
    this.clients.get(userId)!.add(client)

    // Send a "connected" event so the frontend knows the stream is live
    this.writeToClient(client, { event: 'wallet.balance_updated', data: { connected: true } })

    Logger.info(`[SSE] Client connected: userId=${userId}. Total users: ${this.clients.size}`)

    // Return cleanup function
    return () => {
      this.clients.get(userId)?.delete(client)
      if (this.clients.get(userId)?.size === 0) {
        this.clients.delete(userId)
      }
      Logger.info(`[SSE] Client disconnected: userId=${userId}`)
    }
  }

  // ─── Emitting ──────────────────────────────────────────────────────────────

  /**
   * Push an event to all open connections for a specific user.
   */
  public emit<T = any>(userId: string, message: SseMessage<T>): void {
    const userClients = this.clients.get(userId)
    if (!userClients || userClients.size === 0) return

    for (const client of userClients) {
      this.writeToClient(client, message)
    }
  }

  /**
   * Broadcast an event to every connected user.
   * Use sparingly — only for system-wide announcements.
   */
  public broadcast<T = any>(message: SseMessage<T>): void {
    for (const [, userClients] of this.clients) {
      for (const client of userClients) {
        this.writeToClient(client, message)
      }
    }
  }

  // ─── Internals ─────────────────────────────────────────────────────────────

  private writeToClient<T>(client: SseClient, message: SseMessage<T>): void {
    try {
      const payload = `event: ${message.event}\ndata: ${JSON.stringify(message.data)}\n\n`
      client.res.write(payload)
    } catch (err) {
      // Client disconnected mid-write — silently remove it
      this.clients.get(client.userId)?.delete(client)
      Logger.warn(`[SSE] Write failed for userId=${client.userId} — client removed`)
    }
  }

  private heartbeat(): void {
    const comment = ': heartbeat\n\n'
    for (const [, userClients] of this.clients) {
      for (const client of userClients) {
        try {
          client.res.write(comment)
        } catch (_) {
          this.clients.get(client.userId)?.delete(client)
        }
      }
    }
  }

  public get connectionCount(): number {
    let total = 0
    for (const [, s] of this.clients) total += s.size
    return total
  }
}

export default new SseServiceClass()
