import Route from '@ioc:Adonis/Core/Route'

Route.group(() => {
  Route.post('/checkout/sessions', 'ApiCheckoutController.create')
}).prefix('/api/v1').middleware('apiKey')