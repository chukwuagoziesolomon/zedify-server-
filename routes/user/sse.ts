import Route from '@ioc:Adonis/Core/Route'

/**
 * GET /api/user/stream
 * Server-Sent Events stream for real-time updates.
 * Keep this connection open on the frontend using EventSource.
 */
Route.get('/api/user/stream', 'SseController.stream').middleware('auth:user')
