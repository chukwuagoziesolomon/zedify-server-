import Route from '@ioc:Adonis/Core/Route'

/**
 * @swagger
 * tags:
 *   name: Wallet
 *   description: User wallet and balance management
 */

Route.group(() => {
  Route.post('/provision', 'WalletController.provision').middleware('auth:user')

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
  Route.get('/:network_id/balance', 'WalletController.balanceByNetwork').middleware('auth:user')
}).prefix('/api/user/wallet')
