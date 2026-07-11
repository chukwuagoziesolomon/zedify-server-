import Route from '@ioc:Adonis/Core/Route'

/**
 * @swagger
 * tags:
 *   name: Crypto Network (Admin)
 *   description: Admin management of crypto networks
 */

Route.group(() => {
  /**
   * @swagger
   * /api/admin/crypto-network:
   *   get:
   *     summary: Get all supported crypto networks
   *     tags: [Crypto Network (Admin)]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: List of crypto networks
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 error:
   *                   type: boolean
   *                 message:
   *                   type: string
   *                 data:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       name:
   *                         type: string
   *                       logo:
   *                         type: string
   *                       rpcUrl:
   *                         type: string
   *                       isTestnet:
   *                         type: boolean
   */
  Route.get('/', 'CryptoNetworkController.index')

  /**
   * @swagger
   * /api/admin/crypto-network:
   *   post:
   *     summary: Create a new crypto network
   *     tags: [Crypto Network (Admin)]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               name:
   *                 type: string
   *               logo:
   *                 type: string
   *               rpcUrl:
   *                 type: string
   *               isTestnet:
   *                 type: boolean
   *     responses:
   *       200:
   *         description: Crypto network created
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 error:
   *                   type: boolean
   *                 message:
   *                   type: string
   *                 data:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       name:
   *                         type: string
   *                       logo:
   *                         type: string
   *                       rpcUrl:
   *                         type: string
   *                       isTestnet:
   *                         type: boolean
   */
  Route.post('/', 'CryptoNetworkController.store')

  /**
   * @swagger
   * /api/admin/crypto-network/{id}:
   *   put:
   *     summary: Update a crypto network
   *     tags: [Crypto Network (Admin)]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *         description: ID of the crypto network
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               name:
   *                 type: string
   *               logo:
   *                 type: string
   *               rpcUrl:
   *                 type: string
   *               isTestnet:
   *                 type: boolean
   *     responses:
   *       200:
   *         description: Crypto network updated
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
  Route.put('/:id', 'CryptoNetworkController.update')

  /**
   * @swagger
   * /api/admin/crypto-network/{id}:
   *   delete:
   *     summary: Delete a crypto network
   *     tags: [Crypto Network (Admin)]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *         description: ID of the crypto network
   *     responses:
   *       200:
   *         description: Crypto network deleted
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
  Route.delete('/:id', 'CryptoNetworkController.destroy')

}).prefix('/api/admin/crypto-network').middleware('auth:admin')
