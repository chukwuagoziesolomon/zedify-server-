import Route from '@ioc:Adonis/Core/Route'

Route.group(() => {
  /**
   * GET /api/user/withdrawal/quote
   * Returns fee breakdown before committing.
   * Query: amount (number), type ('crypto' | 'fiat')
   */
  Route.get('/quote', 'WithdrawalController.quote')

  /**
   * POST /api/user/withdrawal/initiate
   * Validates payload + balance, sends OTP to email.
   * Returns { otp_id, fees }
   */
  Route.post('/initiate', 'WithdrawalController.initiate')

  /**
   * POST /api/user/withdrawal/confirm
   * Verifies OTP and processes the withdrawal (crypto send or bank transfer).
   * Body: { otp_id, otp_code }
   */
  Route.post('/confirm', 'WithdrawalController.confirm')
}).prefix('/api/user/withdrawal').middleware('auth:user')

/**
 * GET /user/withdrawals/history
 * Paginated withdrawal history for the authenticated user.
 * Query: page, limit, status
 */
Route.get('/user/withdrawals/history', 'WithdrawalController.history').middleware('auth:user')
