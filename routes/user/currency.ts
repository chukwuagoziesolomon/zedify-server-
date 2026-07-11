import Route from '@ioc:Adonis/Core/Route'

/**
 * @swagger
 * tags:
 *   name: Business Currency (Client)
 *   description: Enable or disable supported currencies for a business
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     BusinessCurrency:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         currencyId:
 *           type: string
 *         userId:
 *           type: string
 *         status:
 *           type: string
 *           enum: [active, inactive]
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 */

Route.group(() => {
  /**
   * @swagger
   * /api/user/currency/enable:
   *   post:
   *     summary: Enable a currency for the business
   *     tags: [Business Currency (Client)]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [currency_id]
   *             properties:
   *               currency_id:
   *                 type: string
   *                 example: "currency-unique-id-xxx"
   *     responses:
   *       200:
   *         description: Currency enabled
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
   *                   $ref: '#/components/schemas/BusinessCurrency'
   */
  Route.post('/enable', 'BusinessCurrencyController.enable')

  /**
   * @swagger
   * /api/user/currency/disable:
   *   post:
   *     summary: Disable a currency for the business
   *     tags: [Business Currency (Client)]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [currency_id]
   *             properties:
   *               currency_id:
   *                 type: string
   *                 example: "currency-unique-id-xxx"
   *     responses:
   *       200:
   *         description: Currency disabled
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
   *                   $ref: '#/components/schemas/BusinessCurrency'
   */
  Route.post('/disable', 'BusinessCurrencyController.disable')

  /**
   * @swagger
   * /api/user/currency/view:
   *   get:
   *     summary: View all supported currencies (business)
   *     tags: [Business Currency (Client)]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: List of supported currencies
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 data:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/Currency'
   */
  Route.get('/view', 'CurrencyController.viewCurrenciesAsUser')

}).prefix('/api/user/currency').middleware('auth:user')
