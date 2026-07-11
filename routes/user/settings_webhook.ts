import Route from '@ioc:Adonis/Core/Route'

/**
 * @swagger
 * tags:
 *   name: Webhook Settings (Client)
 *   description: Manage webhook endpoints for business events
 */

Route.group(() => {
  /**
   * @swagger
   * /api/user/settings/webhook:
   *   post:
   *     summary: Configure webhook URL for business
   *     tags: [Webhook Settings (Client)]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               url:
   *                 type: string
   *                 example: https://business.westerntreasury.com/process-payments
   *               environment:
   *                 type: string
   *                 enum: [LIVE, TEST]
   *                 example: LIVE
   *     responses:
   *       200:
   *         description: Webhook configured successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 error:
   *                   type: boolean
   *                 data:
   *                   type: object
   *                   properties:
   *                     url:
   *                       type: string
   *                     environment:
   *                       type: string
   *                 message:
   *                   type: string
   */
  Route.post('/', 'SettingsWebhookController.update')

  /**
   * @swagger
   * /api/user/settings/webhook:
   *   get:
   *     summary: Get current webhook URLs for business
   *     tags: [Webhook Settings (Client)]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Webhook URLs retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 error:
   *                   type: boolean
   *                 data:
   *                   type: object
   *                   properties:
   *                     live:
   *                       type: object
   *                       properties:
   *                         url:
   *                           type: string
   *                         environment:
   *                           type: string
   *                     test:
   *                       type: object
   *                       properties:
   *                         url:
   *                           type: string
   *                         environment:
   *                           type: string
   *                 message:
   *                   type: string
   */
  Route.get('/', 'SettingsWebhookController.show')

  /** POST /api/user/settings/webhook/secret/generate — Generate / rotate signing secret */
  Route.post('/secret/generate', 'SettingsWebhookController.generateSecret')

  /** POST /api/user/settings/webhook/verify — Send a test ping to the saved URL */
  Route.post('/verify', 'SettingsWebhookController.verifyUrl')

  /** GET /api/user/settings/webhook/logs — View recent delivery attempts */
  Route.get('/logs', 'SettingsWebhookController.logs')
}).prefix('/api/user/settings/webhook').middleware('auth:user')
