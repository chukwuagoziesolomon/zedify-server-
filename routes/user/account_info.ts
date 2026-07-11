import Route from '@ioc:Adonis/Core/Route'

/**
 * GET /user/account-info
 * Returns the authenticated user's account info (surname, full name, email, phone, profile image).
 */
Route.get('/api/user/account-info', 'AccountInfoController.show').middleware('auth:user')

/**
 * PUT /api/user/account-info
 * Update personal info.
 * Body (JSON): { surname?, full_name?, phone? }
 */
Route.put('/api/user/account-info', 'AccountInfoController.update').middleware('auth:user')

/**
 * POST /api/user/account-info/profile-image
 * Upload / replace profile image (Cloudinary).
 * Body (multipart/form-data): { profile_image: File (jpg/jpeg/png/webp, max 5MB) }
 */
Route.post('/api/user/account-info/profile-image', 'AccountInfoController.uploadProfileImage').middleware('auth:user')
