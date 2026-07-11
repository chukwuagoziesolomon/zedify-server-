import Route from '@ioc:Adonis/Core/Route'

/**
 * @swagger
 * tags:
 *   name: Currency (Admin)
 *   description: Admin management of currencies
 */

Route.group(() => {
  /**
   * @swagger
   * /admin/currency/create:
   *   post:
   *     summary: Create a new currency
   *     tags: [Currency (Admin)]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               type:
   *                 type: string
   *                 enum: [fiat, crypto]
   *                 example: crypto
   *               name:
   *                 type: string
   *                 example: USDT TETHER
   *               symbol:
   *                 type: string
   *                 example: USDT
   *               logo:
   *                 type: string
   *                 example: https://example.com/logo.png
   *               cryptoNetworkId:
   *                 type: integer
   *                 example: 1
   *               contractAddress:
   *                 type: string
   *                 example: 0x55d398326f99059fF775485246999027B3197955
   *     responses:
   *       200:
   *         description: Currency created
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 data:
   *                   type: string
   *                   example: Currency created.
   *       400:
   *         description: Error
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 error:
   *                   type: string
   *                   example: Currency already exists!
   */
  Route.post('/create', 'CurrencyController.createCurrency')

  /**
   * @swagger
   * /admin/currency/view:
   *   get:
   *     summary: View all currencies (admin)
   *     tags: [Currency (Admin)]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: List of currencies
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 data:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       uniqueId:
   *                         type: string
   *                       name:
   *                         type: string
   *                       symbol:
   *                         type: string
   *                       logo:
   *                         type: string
   *                       cryptoNetworkId:
   *                         type: integer
   *                       type:
   *                         type: string
   *                       ratePerUsd:
   *                         type: number
   *                       contractAddress:
   *                         type: string
   *       400:
   *         description: Error
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 data:
   *                   type: string
   *                   example: Error message
   */
  Route.get('/view', 'CurrencyController.viewCurrenciesAsAdmin')

  /**
   * @swagger
   * /admin/currency/update/{currencyId}:
   *   patch:
   *     summary: Update a currency
   *     tags: [Currency (Admin)]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: currencyId
   *         required: true
   *         schema:
   *           type: string
   *         description: Unique ID of the currency
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               name:
   *                 type: string
   *                 example: USDT TETHER
   *               symbol:
   *                 type: string
   *                 example: USDT
   *               logo:
   *                 type: string
   *                 example: https://example.com/logo.png
   *     responses:
   *       200:
   *         description: Currency updated
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 data:
   *                   type: string
   *                   example: Currency updated!
   *       400:
   *         description: Error
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 error:
   *                   type: string
   *                   example: Action failed!
   */
  Route.patch('/update/:currencyId', 'CurrencyController.update')

  /**
   * @swagger
   * /admin/currency/delete/{currencyId}:
   *   delete:
   *     summary: Delete or restore a currency (soft delete)
   *     tags: [Currency (Admin)]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: currencyId
   *         required: true
   *         schema:
   *           type: string
   *         description: Unique ID of the currency
   *     responses:
   *       200:
   *         description: Currency deleted or restored
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 data:
   *                   type: string
   *                   example: Currency deleted.
   *       400:
   *         description: Error
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 error:
   *                   type: string
   *                   example: Action failed!
   */
  Route.delete('/delete/:currencyId', 'CurrencyController.deleteCurrency')
}).prefix('/admin/currency').middleware('auth:admin')
