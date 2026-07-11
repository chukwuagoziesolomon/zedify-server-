import Route from '@ioc:Adonis/Core/Route'

/**
 * Public payment status routes — no authentication required.
 * Used by payment widgets embedded on merchant sites.
 */
Route.group(() => {
  /**
   * GET /api/payment/status/:reference_id
   *
   * One-shot JSON snapshot of a payment intent status.
   * The widget can poll this every few seconds while waiting for confirmation.
   *
   * Response: { error: false, data: { status, wallet, crypto, fiat_amount, ... } }
   */
  Route.get('/status/:reference_id', 'PaymentStatusController.status')

  /**
   * GET /api/payment/status/:reference_id/stream
   *
   * Server-Sent Events (SSE) stream.
   * The widget subscribes once and receives push events:
   *   - event: status  → full snapshot whenever status changes
   *   - event: heartbeat → keepalive ping every ~4s
   *   - event: complete → terminal event (payment_completed or timeout)
   *   - event: timeout  → session expired
   *   - event: error   → something went wrong
   */
  Route.get('/status/:reference_id/stream', 'PaymentStatusController.stream')
}).prefix('/api/payment')
