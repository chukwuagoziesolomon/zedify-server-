import Route from '@ioc:Adonis/Core/Route'

Route.group(() => {
  Route.get('/node-info', 'FiberController.nodeInfo').middleware('auth:user')

  Route.get('/channels', 'FiberController.listChannels').middleware('auth:user')

  Route.post('/channels/open', 'FiberController.openChannel').middleware('auth:user')

  Route.post('/invoices', 'FiberController.createInvoice').middleware('auth:user')

  Route.post('/send', 'FiberController.sendPayment').middleware('auth:user')

  Route.get('/payments/:paymentHash', 'FiberController.getPayment').middleware('auth:user')

  Route.get('/invoices/:paymentHash', 'FiberController.getInvoice').middleware('auth:user')

  Route.get('/invoices/:invoiceAddress/check', 'FiberController.checkInvoice').middleware('auth:user')

  Route.post('/channels/sync', 'FiberController.syncChannels').middleware('auth:user')

  Route.post('/invoices/sync', 'FiberController.syncInvoices').middleware('auth:user')
}).prefix('/api/user/fiber')
