import Route from '@ioc:Adonis/Core/Route'

Route.group(() => {
  Route.get('/:id', 'PaymentIntentController.showOrderSummary').middleware('auth:user')
}).prefix('/api/user/checkout')
