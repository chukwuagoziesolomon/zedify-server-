import Route from '@ioc:Adonis/Core/Route'

/**
 * Payment Link routes — authenticated merchant endpoints
 */
Route.group(() => {
  /** POST /api/client/payment-links — create a new payment link */
  Route.post('/', 'PaymentLinkController.create').middleware('auth:user')

  /** GET /api/client/payment-links — list merchant's payment links */
  Route.get('/', 'PaymentLinkController.list').middleware('auth:user')

  /** GET /api/client/payment-links/:id — get a single payment link */
  Route.get('/:id', 'PaymentLinkController.show').middleware('auth:user')

  /** PATCH /api/client/payment-links/:id — update a payment link */
  Route.patch('/:id', 'PaymentLinkController.update').middleware('auth:user')

  /** DELETE /api/client/payment-links/:id — delete a payment link */
  Route.delete('/:id', 'PaymentLinkController.destroy').middleware('auth:user')
}).prefix('/api/client/payment-links')
