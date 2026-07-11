import Route from '@ioc:Adonis/Core/Route'

/**
 * Shop Product Routes
 * All routes require authentication via auth:user middleware.
 */
Route.group(() => {
  /** GET /api/user/shop/products — List products (query: page, limit, category, active) */
  Route.get('/', 'ShopProductController.index')

  /** POST /api/user/shop/products — Create a new product */
  Route.post('/', 'ShopProductController.create')

  /** PUT /api/user/shop/products/:productId — Update a product */
  Route.put('/:productId', 'ShopProductController.update')

  /** DELETE /api/user/shop/products/:productId — Soft-delete a product */
  Route.delete('/:productId', 'ShopProductController.destroy')

  /** POST /api/user/shop/products/:productId/images — Upload product images (multipart: images[]) */
  Route.post('/:productId/images', 'ShopProductController.uploadImages')

  /** DELETE /api/user/shop/products/:productId/images/:publicId — Remove a product image */
  Route.delete('/:productId/images/:publicId', 'ShopProductController.deleteImage')
}).prefix('/api/user/shop/products').middleware('auth:user')
