import Route from '@ioc:Adonis/Core/Route'

/**
 * @swagger
 * tags:
 *   name: Admin
 *   description: Admin account management
 */

/**
 * @swagger
 * /admin/admin-account/login:
 *   post:
 *     summary: Admin login
 *     tags: [Admin]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 example: admin@example.com
 *               password:
 *                 type: string
 *                 example: password123
 */
Route.post('/admin/admin-account/login', 'AuthAdminController.login')

Route.group(() => {
  /**
   * @swagger
   * /admin/admin-account/create:
   *   post:
   *     summary: Create admin
   *     tags: [Admin]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               email:
   *                 type: string
   *                 example: admin@example.com
   *               password:
   *                 type: string
   *                 example: password123
   *               type:
   *                 type: string
   *                 example: ADMIN
   */
  Route.post('/create', 'AuthAdminController.create')

  /**
   * @swagger
   * /admin/admin-account/view:
   *   get:
   *     summary: View all admins
   *     tags: [Admin]
   */
  Route.get('/view', 'AuthAdminController.viewAllAdmins')

  /**
   * @swagger
   * /admin/admin-account/view-loggedin:
   *   get:
   *     summary: View logged in admin
   *     tags: [Admin]
   */
  Route.get('/view-loggedin', 'AuthAdminController.viewLoggedInAdmin')

  /**
   * @swagger
   * /admin/admin-account/block/{adminId}:
   *   patch:
   *     summary: Block admin
   *     tags: [Admin]
   *     parameters:
   *       - in: path
   *         name: adminId
   *         required: true
   *         schema:
   *           type: integer
   *         description: ID of the admin to block
   */
  Route.patch('/block/:adminId', 'AuthAdminController.blockAdmin')

  /**
   * @swagger
   * /admin/admin-account/unblock/{adminId}:
   *   patch:
   *     summary: Unblock admin
   *     tags: [Admin]
   *     parameters:
   *       - in: path
   *         name: adminId
   *         required: true
   *         schema:
   *           type: integer
   *         description: ID of the admin to unblock
   */
  Route.patch('/unblock/:adminId', 'AuthAdminController.unblockAdmin')

  /**
   * @swagger
   * /admin/admin-account/update:
   *   patch:
   *     summary: Update logged in admin
   *     tags: [Admin]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               email:
   *                 type: string
   *                 example: admin@example.com
   *               password:
   *                 type: string
   *                 example: newpassword123
   */
  Route.patch('/update', 'AuthAdminController.updateLoggedInAdmin')

  // User management by admin
  Route.get('/users', 'AuthAdminController.listUsers')
  Route.patch('/users/:userId/verify', 'AuthAdminController.verifyUser')
  Route.patch('/users/:userId/unverify', 'AuthAdminController.unverifyUser')

}).prefix('/admin/admin-account').middleware('auth:admin')
