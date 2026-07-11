import Route from '@ioc:Adonis/Core/Route'

/**
 * @swagger
 * tags:
 *   name: Wallet
 *   description: User wallet and balance management
 */

Route.group(() => {
  /**
   * @swagger
   * /user/wallet/balance:
   *   get:
   *     summary: Get all wallet balances
   *     tags: [Wallet]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: User wallet balances retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 status:
   *                   type: boolean
   *                 data:
   *                   type: object
   *                   properties:
   *                     user_id:
   *                       type: string
   *                     wallets:
   *                       type: array
   *                       items:
   *                         type: object
   *                         properties:
   *                           wallet_id:
   *                             type: string
   *                           network:
   *                             type: string
   *                           currency:
   *                             type: string
   *                           wallet_address:
   *                             type: string
   *                           balance:
   *                             type: number
   *                           total_deposited:
   *                             type: number
   *                           total_withdrawn:
   *                             type: number
   *                           status:
   *                             type: string
   *       401:
   *         description: Unauthorized
   */
  Route.get('/balance', 'WalletController.balance').middleware(['auth'])

  /**
   * @swagger
   * /user/wallet/{network_id}/balance:
   *   get:
   *     summary: Get wallet balance for specific network
   *     tags: [Wallet]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: network_id
   *         required: true
   *         schema:
   *           type: string
   *         description: Crypto network unique ID
   *     responses:
   *       200:
   *         description: Network wallet balance retrieved successfully
   *       404:
   *         description: No wallet found for this network
   *       401:
   *         description: Unauthorized
   */
  Route.get('/:network_id/balance', 'WalletController.balanceByNetwork').middleware(['auth'])
}).prefix('/wallet')
