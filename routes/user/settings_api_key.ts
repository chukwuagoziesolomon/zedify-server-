import Route from '@ioc:Adonis/Core/Route'

Route.group(() => {
  /**
   * @swagger
   * /api/client/settings/api-key:
   *   post:
   *     tags:
   *       - API Keys
   *     summary: Generate new API keys
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: API keys generated successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 message:
   *                   type: string
   *                 data:
   *                   type: object
   *                   properties:
   *                     private_key:
   *                       type: string
   *                     public_key:
   *                       type: string
   *       400:
   *         description: Bad request
   */
  Route.post('/', 'SettingsApiKeyController.generate')

  /**
   * @swagger
   * /api/client/settings/api-key:
   *   get:
   *     tags:
   *       - API Keys
   *     summary: Retrieve current API keys (public only)
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: API keys retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 message:
   *                   type: string
   *                 data:
   *                   type: object
   *                   properties:
   *                     private_key:
   *                       type: string
   *                       nullable: true
   *                     public_key:
   *                       type: string
   *       400:
   *         description: Bad request
   */
  Route.get('/', 'SettingsApiKeyController.show')
}).prefix('/api/client/settings/api-key').middleware('auth:user')
