import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import SseService from 'App/Services/SseService'
import RolesController from './RolesController'

export default class SseController extends RolesController {
  /**
   * GET /api/user/stream
   *
   * Opens a persistent SSE stream for the authenticated user.
   * The frontend should open this once and keep it alive.
   *
   * Events pushed over this stream:
   *   - wallet.balance_updated   → payload: { total_balance_usd, total_balance_ngn, wallets[] }
   *   - transaction.created      → payload: { transaction_id, reference_id, amount, status, ... }
   *   - transaction.confirmed    → payload: { transaction_id, status, completed_at, ... }
   *   - withdrawal.created       → payload: { transfer_id, amount, recipient_type, status, ... }
   *   - withdrawal.updated       → payload: { transfer_id, status, ... }
   *
   * Frontend usage (plain JS):
   *   const es = new EventSource('/api/user/stream', { headers: { Authorization: `Bearer ${token}` } })
   *   es.addEventListener('wallet.balance_updated', (e) => console.log(JSON.parse(e.data)))
   *   es.addEventListener('transaction.created', (e) => console.log(JSON.parse(e.data)))
   */
  public async stream({ auth, request, response }: HttpContextContract) {
    const userId = this.allowOnlyLoggedInUsers(auth)

    // Access the raw Node.js response to write SSE frames
    const res = response.response

    // Register the connection and get the cleanup function
    const cleanup = SseService.register(userId, res)

    // Clean up when the client disconnects
    request.request.on('close', cleanup)
    request.request.on('aborted', cleanup)
  }
}
