import Route from '@ioc:Adonis/Core/Route'

/**
 * Shop Builder Routes
 * All routes require authentication via auth:user middleware.
 */

// ─── Shop CRUD ───────────────────────────────────────────────────────────────

/** GET /user/shop — Get the authenticated user's shop */
Route.get('/user/shop', 'ShopBuilderController.show').middleware('auth:user')

/** POST /user/shop — Create a new shop */
Route.post('/user/shop', 'ShopBuilderController.create').middleware('auth:user')

/** PUT /user/shop — Update shop details */
Route.put('/user/shop', 'ShopBuilderController.update').middleware('auth:user')

// ─── Shop Media ───────────────────────────────────────────────────────────────

/** POST /user/shop/logo — Upload shop logo (multipart: logo) */
Route.post('/user/shop/logo', 'ShopBuilderController.uploadLogo').middleware('auth:user')

/** POST /user/shop/banner — Upload shop banner (multipart: banner) */
Route.post('/user/shop/banner', 'ShopBuilderController.uploadBanner').middleware('auth:user')

// ─── AI Agent ─────────────────────────────────────────────────────────────────

/** POST /user/shop/ai/chat — Chat with the AI shop builder agent */
Route.post('/user/shop/ai/chat', 'ShopBuilderController.aiChat').middleware('auth:user')

/** GET /user/shop/ai/history — Get AI conversation history */
Route.get('/user/shop/ai/history', 'ShopBuilderController.aiHistory').middleware('auth:user')

/** DELETE /user/shop/ai/memory — Reset AI memory (start fresh) */
Route.delete('/user/shop/ai/memory', 'ShopBuilderController.aiResetMemory').middleware('auth:user')
