import Route from '@ioc:Adonis/Core/Route'

/**
 * Cart Routes
 * All routes require authentication via auth:user middleware.
 */
Route.group(() => {
  /** GET /api/user/cart — Get user's cart with items */
  Route.get('/', 'CartController.show')

  /** POST /api/user/cart/items — Add item to cart */
  Route.post('/items', 'CartController.addItem')

  /** PUT /api/user/cart/items/:itemId — Update cart item quantity */
  Route.put('/items/:itemId', 'CartController.updateItem')

  /** DELETE /api/user/cart/items/:itemId — Remove item from cart */
  Route.delete('/items/:itemId', 'CartController.removeItem')

  /** DELETE /api/user/cart — Clear entire cart */
  Route.delete('/', 'CartController.clear')

  /** POST /api/user/cart/checkout — Create payment intent from cart */
  Route.post('/checkout', 'CartController.checkout')
}).prefix('/api/user/cart').middleware('auth:user')
