import Route from '@ioc:Adonis/Core/Route'

/**
 * @swagger
 * tags:
 *   name: Payout Settings (Client)
 *   description: Manage payout details for business withdrawals
 */

Route.group(() => {
  /**
   * @swagger
   * /api/user/settings/payout:
   *   post:
   *     summary: Update payout details
   *     tags: [Payout Settings (Client)]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             oneOf:
   *               - type: object
   *                 required: [type, network_id, wallet_address]
   *                 properties:
   *                   type:
   *                     type: string
   *                     enum: [CRYPTO]
   *                     example: CRYPTO
   *                   network_id:
   *                     type: string
   *                     example: crypto-network-id-xxx
   *                   wallet_address:
   *                     type: string
   *                     example: 0x506F9908E157Mc55938dA948326144A9971E2015
   *               - type: object
   *                 required: [type, currency_id, bank_account_no, bank_name]
   *                 properties:
   *                   type:
   *                     type: string
   *                     enum: [FIAT]
   *                     example: FIAT
   *                   currency_id:
   *                     type: string
   *                     example: fiat-currency-id-xxx
   *                   bank_account_no:
   *                     type: string
   *                     example: 123456789
   *                   bank_name:
   *                     type: string
   *                     example: zenith bank
   *     responses:
   *       200:
   *         description: Payout details updated successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 error:
   *                   type: boolean
   *                 message:
   *                   type: string
   */
  Route.post('/', 'PayoutController.update')

  /**
   * @swagger
   * /api/user/settings/payout:
   *   get:
   *     summary: Get current payout details
   *     tags: [Payout Settings (Client)]
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
   *                   oneOf:
   *                     - type: object
   *                       properties:
   *                         type:
   *                           type: string
   *                           enum: [CRYPTO]
   *                         network_id:
   *                           type: string
   *                         wallet_address:
   *                           type: string
   *                     - type: object
   *                       properties:
   *                         type:
   *                           type: string
   *                           enum: [FIAT]
   *                         currency_id:
   *                           type: string
   *                         bank_account_no:
   *                           type: string
   *                         bank_name:
   *                           type: string
   *                 message:
   *                   type: string
   */
  Route.get('/', 'PayoutController.show')
}).prefix('/api/user/settings/payout').middleware('auth:user')
