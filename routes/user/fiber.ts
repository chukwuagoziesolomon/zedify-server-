import Route from '@ioc:Adonis/Core/Route'

Route.group(() => {
  Route.get('/node-info', 'Http/FiberController.nodeInfo').middleware('auth:user')
  Route.get('/channels', 'Http/FiberController.listChannels').middleware('auth:user')
  Route.post('/channels/open', 'Http/FiberController.openChannel').middleware('auth:user')
  Route.post('/invoices', 'Http/FiberController.createInvoice').middleware('auth:user')
  Route.post('/send', 'Http/FiberController.sendPayment').middleware('auth:user')
  Route.get('/payments/:paymentHash', 'Http/FiberController.getPayment').middleware('auth:user')
  Route.get('/invoices/:paymentHash', 'Http/FiberController.getInvoice').middleware('auth:user')
  Route.get('/invoices/:invoiceAddress/check', 'Http/FiberController.checkInvoice').middleware('auth:user')
  Route.post('/channels/sync', 'Http/FiberController.syncChannels').middleware('auth:user')
  Route.post('/invoices/sync', 'Http/FiberController.syncInvoices').middleware('auth:user')
}).prefix('/api/user/fiber')
