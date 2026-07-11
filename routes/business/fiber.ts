import Route from '@ioc:Adonis/Core/Route'

/**
 * Business Fiber Payment Settings Routes
 * Enable/configure Fiber payments for accepting CKB and SUDT
 */
Route.group(() => {
  // ────────────────────────────────────────────────────────────────
  // Setup & Configuration
  // ────────────────────────────────────────────────────────────────

  /**
   * POST /api/business/fiber/setup
   * Enable Fiber payments for business
   */
  Route.post('/setup', 'Http/BusinessFiberSettingsController.setup')

  /**
   * GET /api/business/fiber/setup
   * Get current Fiber setup and settings
   */
  Route.get('/setup', 'Http/BusinessFiberSettingsController.getSetup')

  /**
   * PATCH /api/business/fiber/settlement
   * Update settlement preferences (auto-convert, schedule, etc.)
   */
  Route.patch('/settlement', 'Http/BusinessFiberSettingsController.updateSettlement')

  // ────────────────────────────────────────────────────────────────
  // SUDT Token Management
  // ────────────────────────────────────────────────────────────────

  /**
   * POST /api/business/fiber/accept-sudt
   * Enable a specific SUDT token for business payments
   * Body: { type_script: "0x..." }
   */
  Route.post('/accept-sudt', 'Http/BusinessFiberSettingsController.acceptSudt')

  /**
   * DELETE /api/business/fiber/accept-sudt/:typeScript
   * Disable SUDT token for business
   */
  Route.delete('/accept-sudt/:typeScript', 'Http/BusinessFiberSettingsController.rejectSudt')

  /**
   * GET /api/business/fiber/accepted-sudt
   * List SUDT tokens accepted by this business
   */
  Route.get('/accepted-sudt', 'Http/BusinessFiberSettingsController.getAcceptedSudt')

  /**
   * GET /api/business/fiber/available-sudt
   * List all available SUDT tokens to accept
   */
  Route.get('/available-sudt', 'Http/BusinessFiberSettingsController.getAvailableSudt')

  // ────────────────────────────────────────────────────────────────
  // Payment History & Statistics
  // ────────────────────────────────────────────────────────────────

  /**
   * GET /api/business/fiber/payments
   * Get payment history
   * Query: page, limit
   */
  Route.get('/payments', 'Http/BusinessFiberSettingsController.getPayments')

  /**
   * GET /api/business/fiber/stats
   * Get settlement statistics (total received, converted, etc.)
   */
  Route.get('/stats', 'Http/BusinessFiberSettingsController.getStats')

  // ────────────────────────────────────────────────────────────────
  // Account Management
  // ────────────────────────────────────────────────────────────────

  /**
   * POST /api/business/fiber/disable
   * Disable Fiber payments for business
   */
  Route.post('/disable', 'Http/BusinessFiberSettingsController.disableFiber')
}).prefix('/api/business/fiber').middleware('auth:user')
