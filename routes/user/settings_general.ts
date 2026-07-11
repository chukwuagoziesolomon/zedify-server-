import Route from '@ioc:Adonis/Core/Route'

/**
 * @swagger
 * tags:
 *   name: General Settings (Client)
 *   description: Manage general business settings
 */

Route.group(() => {
  /**
   * @swagger
   * /api/user/settings/general:
   *   post:
   *     summary: Update general business settings
   *     tags: [General Settings (Client)]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: false
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               fee_bearer:
   *                 type: string
   *                 enum: [BUSINESS, CUSTOMERS]
   *                 example: BUSINESS
   *               current_environment:
   *                 type: string
   *                 enum: [LIVE, TEST]
   *                 example: LIVE
   *               payout_interval:
   *                 type: string
   *                 enum: [INSTANT, DAILY, WEEKLY]
   *                 example: INSTANT
   *               payout_type:
   *                 type: string
   *                 enum: [CRYPTO, FIAT]
   *                 example: CRYPTO
   *     responses:
   *       200:
   *         description: Settings updated successfully
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
   *                     fee_bearer:
   *                       type: string
   *                     current_environment:
   *                       type: string
   *                     payout_interval:
   *                       type: string
   *                     payout_type:
   *                       type: string
   *                 message:
   *                   type: string
   */
  Route.post('/', 'SettingsGeneralController.update')

  /**
   * @swagger
   * /api/user/settings/general:
   *   get:
   *     summary: Get general business settings
   *     tags: [General Settings (Client)]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Settings retrieved successfully
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
   *                     fee_bearer:
   *                       type: string
   *                     current_environment:
   *                       type: string
   *                     payout_interval:
   *                       type: string
   *                     payout_type:
   *                       type: string
   *                 message:
   *                   type: string
   */
  Route.get('/', 'SettingsGeneralController.show')
}).prefix('/api/user/settings/general').middleware('auth:user')
