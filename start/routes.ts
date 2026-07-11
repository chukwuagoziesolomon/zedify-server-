import Route from '@ioc:Adonis/Core/Route'

Route.get('/', async () => {
  return { hello: 'world' }
})


Route.group(() => {
  Route.post('/login', 'AuthUserController.login')

  Route.post('/signup', 'AuthUserController.signup')

  Route.post('/forgot-password', 'AuthUserController.forgotPassword')

  Route.post('/reset-password', 'AuthUserController.resetPassword')

  Route.get('/view', 'AuthUserController.viewLoggedInUser').middleware('auth')

  Route.patch('/update', 'AuthUserController.updateLoggedInUser').middleware('auth')

  Route.post('/logout', 'AuthUserController.logout').middleware('auth')
}).prefix('/user/account')
