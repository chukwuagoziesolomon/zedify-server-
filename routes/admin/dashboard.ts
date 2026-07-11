import Route from '@ioc:Adonis/Core/Route'

/**
 * @swagger
 * /admin/dashboard/stats:
 *   get:
 *     summary: Dashboard stats cards
 *     tags: [Admin]
 *     description: Returns confirmed dashboard totals for wallet balance, payouts, and payments processed.
 */
Route.get('/dashboard/stats', 'DashboardStatsController.stats').middleware('auth:user')
Route.get('/dashboard/payout-chart', 'DashboardStatsController.payoutChart').middleware('auth:user')
Route.get('/dashboard/analytical-transactions', 'DashboardStatsController.analyticalTransactions').middleware('auth:user')
