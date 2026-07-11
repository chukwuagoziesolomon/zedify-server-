import Route from '@ioc:Adonis/Core/Route'

/**
 * User Transfer Routes
 * All routes require user authentication
 */
Route.group(() => {
  // Get exchange rate (public info, can add rate limiting)
  Route.get('/transfer/rate', 'Http/TransferController.getExchangeRate')

  // Get conversion quote before transfer
  Route.post('/transfer/quote', 'Http/TransferController.getConversionQuote')

  // Wallet management
  Route.get('/wallets', 'Http/TransferController.getWallets')
  Route.get('/wallet/balance', 'Http/TransferController.getWalletBalance')
  Route.get('/wallets/:id', 'Http/TransferController.getWallet')

  // Transfer operations
  Route.get('/transfers', 'Http/TransferController.getTransfers')
  Route.get('/withdrawals/history', 'Http/TransferController.getWithdrawalHistory')
  Route.get('/transfers/:id', 'Http/TransferController.getTransfer')
  Route.post('/transfer/initiate', 'Http/TransferController.initiateTransfer')
  Route.post('/transfer/:id/cancel', 'Http/TransferController.cancelTransfer')
})
  .prefix('/api/user')
  .middleware('auth')
