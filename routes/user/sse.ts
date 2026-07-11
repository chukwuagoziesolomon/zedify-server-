import Route from '@ioc:Adonis/Core/Route'

/**
 * GET /api/user/stream
 * Server-Sent Events stream for real-time updates.
 * Keep this connection open on the frontend using EventSource.
 */
Route.get('/api/user/stream', 'SseController.stream').middleware('auth:user')

/**
 * GET /user/stream
 * Alias without /api prefix — backwards compatibility for older frontend builds.
 */
Route.get('/user/stream', 'SseController.stream').middleware('auth:user')

/**
 * GET /api/payments/stream
 * Alias for /api/user/stream — used by frontend payment widget.
 */
Route.get('/api/payments/stream', 'SseController.stream').middleware('auth:user')
