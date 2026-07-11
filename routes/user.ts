import Route from '@ioc:Adonis/Core/Route'

/**
 * @swagger
 * tags:
 *   name: User
 *   description: User account management
 */

Route.group(() => {
  /**
   * @swagger
   * /user/account/login:
   *   post:
   *     summary: User login
   *     tags: [User]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               email:
   *                 type: string
   *                 example: user@example.com
   *               password:
   *                 type: string
   *                 example: password123
   */
  Route.post('/login', 'AuthUserController.login')

  /**
   * @swagger
   * /user/account/signup:
   *   post:
   *     summary: User signup
   *     tags: [User]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               email:
   *                 type: string
   *                 example: test@example.com
   *               password:
   *                 type: string
   *                 example: test
   *               password_confirmation:
   *                 type: string
   *                 example: test
   *               business_name:
   *                 type: string
   *                 example: test
   */
  Route.post('/signup', 'AuthUserController.signup')

  /**
   * @swagger
   * /user/account/forgot-password:
   *   post:
   *     summary: Forgot password
   *     tags: [User]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               email:
   *                 type: string
   *                 example: user@example.com
   */
  Route.post('/forgot-password', 'AuthUserController.forgotPassword')

  /**
   * @swagger
   * /user/account/reset-password:
   *   post:
   *     summary: Reset password
   *     tags: [User]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               email:
   *                 type: string
   *                 example: user@example.com
   *               token:
   *                 type: string
   *                 example: reset-token-123
   *               password:
   *                 type: string
   *                 example: newpassword123
   */
  Route.post('/reset-password', 'AuthUserController.resetPassword')

  /**
   * @swagger
   * /user/account/view:
   *   get:
   *     summary: View logged in user
   *     tags: [User]
   */
  Route.get('/view', 'AuthUserController.viewLoggedInUser').middleware('auth')

  /**
   * @swagger
   * /user/account/update:
   *   patch:
   *     summary: Update logged in user
   *     tags: [User]
   */
  Route.patch('/update', 'AuthUserController.updateLoggedInUser').middleware('auth')

  /**
   * @swagger
   * /user/account/logout:
   *   post:
   *     summary: Logout user
   *     tags: [User]
   */
  Route.post('/logout', 'AuthUserController.logout').middleware('auth')

}).prefix('/user/account')
