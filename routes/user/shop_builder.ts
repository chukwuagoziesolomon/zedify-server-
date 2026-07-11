import Route from '@ioc:Adonis/Core/Route'

/**
 * Shop Builder Routes
 * All routes require authentication via auth:user middleware.
 */
Route.group(() => {
  // ─── Shop CRUD ───────────────────────────────────────────────────────────────

  /** GET /api/user/shop — Get the authenticated user's shop */
  Route.get('/', 'ShopBuilderController.show')

  /** POST /api/user/shop — Create a new shop */
  Route.post('/', 'ShopBuilderController.create')

  /** PUT /api/user/shop — Update shop details */
  Route.put('/', 'ShopBuilderController.update')

  // ─── Shop Media ───────────────────────────────────────────────────────────────

  /** POST /api/user/shop/logo — Upload shop logo (multipart: logo) */
  Route.post('/logo', 'ShopBuilderController.uploadLogo')

  /** POST /api/user/shop/banner — Upload shop banner (multipart: banner) */
  Route.post('/banner', 'ShopBuilderController.uploadBanner')

  // ─── AI Agent ─────────────────────────────────────────────────────────────────

  /** POST /api/user/shop/ai/chat — Chat with the AI shop builder agent */
  Route.post('/ai/chat', 'ShopBuilderController.aiChat')

  /** POST /api/user/shop/ai/chat/stream — SSE streaming chat (text/event-stream) */
  Route.post('/ai/chat/stream', 'ShopBuilderController.aiChatStream')

  /** GET /api/user/shop/ai/history — Get AI conversation history */
  Route.get('/ai/history', 'ShopBuilderController.aiHistory')

  /** DELETE /api/user/shop/ai/memory — Reset all AI memory tiers */
  Route.delete('/ai/memory', 'ShopBuilderController.aiResetMemory')
}).prefix('/api/user/shop').middleware('auth:user')
