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
   *         multipart/form-data:
   *           schema:
   *             type: object
   *             required:
   *               - email
   *               - password
   *               - password_confirmation
   *               - phone
   *               - business_name
   *               - business_type
   *               - bvn
   *             properties:
   *               email:
   *                 type: string
   *                 format: email
   *                 example: business@example.com
   *               password:
   *                 type: string
   *                 format: password
   *                 example: password123
   *               password_confirmation:
   *                 type: string
   *                 format: password
   *                 example: password123
   *               phone:
   *                 type: string
   *                 example: "1234567890"
   *               business_name:
   *                 type: string
   *                 example: My Business
   *               business_type:
   *                 type: string
   *                 enum: [starter, registered]
   *                 example: registered
   *               bvn:
   *                 type: string
   *                 pattern: '^\d{11}$'
   *                 example: "12345678901"
   *               cac_number:
   *                 type: string
   *                 example: "RC1234567"
   *                 description: Required for registered businesses only
   *               cac_documents:
   *                 type: string
   *                 format: binary
   *                 description: CAC document image (JPEG, PNG, WebP). Required for registered businesses only
   *               shareholders_approval_letter:
   *                 type: string
   *                 format: binary
   *                 description: Shareholders approval letter (PDF or Word .docx). Required for registered businesses only
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
