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
   * Supports multi-chain: EVM (Ethereum, Polygon, etc.), CKB (Fiber), and Fiat.
   * Returns { otp_id, fees }
   * 
   * For CKB SUDT withdrawals, include sudt_type_script parameter.
   */
  Route.post('/initiate', 'WithdrawalController.initiate')

  /**
   * POST /api/user/withdrawal/confirm
   * Verifies OTP and processes the withdrawal.
   * Routes to appropriate handler based on network type:
   *   - 'ckb' → Fiber/CKB RPC withdrawal
   *   - 'evm' → EVM chain withdrawal (ethers.js)
   *   - 'fiat' → Bank transfer
   * Body: { otp_id, otp_code }
   */
  Route.post('/confirm', 'WithdrawalController.confirm')
}).prefix('/api/user/withdrawal').middleware('auth:user')

/**
 * GET /api/user/withdrawals/history
 * Paginated withdrawal history for the authenticated user.
 * Query: page, limit, status
 * Shows all withdrawals across all networks (CKB, EVM, Fiat)
 */
Route.get('/api/user/withdrawals/history', 'WithdrawalController.history').middleware('auth:user')
