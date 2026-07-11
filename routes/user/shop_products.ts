import Route from '@ioc:Adonis/Core/Route'

/**
 * Shop Product Routes
 * All routes require authentication via auth:user middleware.
 */

/** GET /user/shop/products — List products (query: page, limit, category, active) */
Route.get('/user/shop/products', 'ShopProductController.index').middleware('auth:user')

/** POST /user/shop/products — Create a new product */
Route.post('/user/shop/products', 'ShopProductController.create').middleware('auth:user')

/** PUT /user/shop/products/:productId — Update a product */
Route.put('/user/shop/products/:productId', 'ShopProductController.update').middleware('auth:user')

/** DELETE /user/shop/products/:productId — Soft-delete a product */
Route.delete('/user/shop/products/:productId', 'ShopProductController.destroy').middleware('auth:user')

/** POST /user/shop/products/:productId/images — Upload product images (multipart: images[]) */
Route.post('/user/shop/products/:productId/images', 'ShopProductController.uploadImages').middleware('auth:user')

/** DELETE /user/shop/products/:productId/images/:publicId — Remove a product image */
Route.delete('/user/shop/products/:productId/images/:publicId', 'ShopProductController.deleteImage').middleware('auth:user')
