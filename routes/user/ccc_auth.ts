import Route from '@ioc:Adonis/Core/Route'

Route.group(() => {
  Route.post('/challenge', 'CccAuthController.challenge')
  Route.post('/verify', 'CccAuthController.verify')
  Route.post('/link', 'CccAuthController.link').middleware('auth:user')
  Route.delete('/link', 'CccAuthController.unlink').middleware('auth:user')
  Route.get('/identity', 'CccAuthController.current').middleware('auth:user')
}).prefix('/api/user/auth/ccc')