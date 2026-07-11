import Route from '@ioc:Adonis/Core/Route'

Route.group(() => {
  /**
   * @swagger
   * /api/user/payment-intent:
   *   post:
   *     tags:
   *       - PaymentIntent
   *     summary: Create a new payment intent
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               fiat_amount:
   *                 type: number
   *                 example: 1000
   *               fiat_currency:
   *                 type: string
   *                 example: NGN
   *               reference_id:
   *                 type: string
   *                 example: t_cc2c04180
   *     responses:
   *       200:
   *         description: Payment intent created successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 message:
   *                   type: string
   *                 data:
   *                   type: object
   *                   properties:
   *                     fiat_amount:
   *                       type: number
   *                     fiat_currency:
   *                       type: string
   *                     reference_id:
   *                       type: string
   *                     assets:
   *                       type: array
   *                       items:
   *                         type: object
   *                         properties:
   *                           name:
   *                             type: string
   *                           symbol:
   *                             type: string
   *                           logo:
   *                             type: string
   *                           network:
   *                             type: object
   *                             properties:
   *                               name:
   *                                 type: string
   *                               logo:
   *                                 type: string
   *                           amount:
   *                             type: number
   */
  Route.post('/', 'PaymentIntentController.create').middleware('auth:user')

  Route.get('/history', 'PaymentIntentController.getTransactionHistory').middleware('auth:user')

  /**
   * @swagger
   * /api/user/payment-intent/create-wallet:
   *   post:
   *     tags:
   *       - PaymentIntent
   *     summary: Create or reuse a child wallet for a payment intent
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               crypto_currency_id:
   *                 type: string
   *                 description: The symbol or unique ID of the crypto currency
   *               reference_id:
   *                 type: string
   *                 description: The reference ID for the payment intent
   *     responses:
   *       200:
   *         description: Wallet created or reused successfully
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
   *                     reference_id:
   *                       type: string
   *                     expiration_time:
   *                       type: string
   *                     payment_intent_id:
   *                       type: string
   *                     fee_in_crypto:
   *                       type: number
   *                     wallet:
   *                       type: object
   *                       properties:
   *                         address:
   *                           type: string
   *                         qr_code:
   *                           type: string
   *                     fiat:
   *                       type: object
   *                     crypto:
   *                       type: object
   *                 message:
   *                   type: string
   *       400:
   *         description: Bad request or validation error
   */
  Route.post('/create-wallet', 'PaymentIntentController.createWallet').middleware('auth:user')
}).prefix('/api/user/payment-intent')

/**
 * GET /user/payment-intent/history
 * Alias without /api prefix (used by frontend).
 */
Route.get('/user/payment-intent/history', 'PaymentIntentController.getTransactionHistory').middleware('auth:user')
