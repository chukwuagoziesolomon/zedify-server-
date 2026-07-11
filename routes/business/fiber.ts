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
  Route.post('/setup', 'BusinessFiberSettingsController.setup')

  Route.get('/setup', 'BusinessFiberSettingsController.getSetup')

  Route.patch('/settlement', 'BusinessFiberSettingsController.updateSettlement')

  Route.post('/accept-sudt', 'BusinessFiberSettingsController.acceptSudt')

  Route.delete('/accept-sudt/:typeScript', 'BusinessFiberSettingsController.rejectSudt')

  Route.get('/accepted-sudt', 'BusinessFiberSettingsController.getAcceptedSudt')

  Route.get('/available-sudt', 'BusinessFiberSettingsController.getAvailableSudt')

  Route.get('/payments', 'BusinessFiberSettingsController.getPayments')

  Route.get('/stats', 'BusinessFiberSettingsController.getStats')

  Route.post('/disable', 'BusinessFiberSettingsController.disableFiber')
}).prefix('/api/business/fiber').middleware('auth:user')
