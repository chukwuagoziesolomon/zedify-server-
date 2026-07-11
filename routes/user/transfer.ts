import Route from '@ioc:Adonis/Core/Route'

/**
 * User Transfer Routes
 * All routes require user authentication
 */
Route.group(() => {
  // Get exchange rate (public info, can add rate limiting)
  Route.get('/transfer/rate', 'TransferController.getExchangeRate')

  // Get conversion quote before transfer
  Route.post('/transfer/quote', 'TransferController.getConversionQuote')

  // Wallet management
  Route.get('/wallets', 'TransferController.getWallets')
  Route.get('/wallet/balance', 'TransferController.getWalletBalance')
  Route.get('/wallets/:id', 'TransferController.getWallet')

  // Transfer operations
  Route.get('/transfers', 'TransferController.getTransfers')
  Route.get('/transfers/:id', 'TransferController.getTransfer')
  Route.post('/transfer/initiate', 'TransferController.initiateTransfer')
  Route.post('/transfer/:id/cancel', 'TransferController.cancelTransfer')
})
  .prefix('/api/user')
  .middleware('auth')
