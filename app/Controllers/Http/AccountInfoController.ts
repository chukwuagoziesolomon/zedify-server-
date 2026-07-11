import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import { formatErrorMessage, formatSuccessMessage } from 'App/helpers/utils'
import RolesController from './RolesController'
import User from 'App/Models/User'
import { FileUploadService } from 'App/Services/FileUploadService'

export default class AccountInfoController extends RolesController {
  /**
   * GET /user/account-info
   * Returns the authenticated user's account info.
   */
  public async show({ auth, response }: HttpContextContract) {
    try {
      const uniqueId = this.allowOnlyLoggedInUsers(auth)
      const user = await User.query().where('uniqueId', uniqueId).firstOrFail()

      return response.ok(formatSuccessMessage('Account info retrieved', {
        surname: user.lastName,
        full_name: `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim(),
        email: user.email,
        phone: user.phone,
        business_name: user.businessName,
        business_type: user.businessType,
        profile_image: user.profileImage,
      }))
    } catch (error) {
      return response.badRequest(await formatErrorMessage(error))
    }
  }

  /**
   * PUT /user/account-info
   * Update personal information (surname, full name, phone).
   * Body (JSON): { surname, full_name, phone }
   */
  public async update({ auth, request, response }: HttpContextContract) {
    try {
      const uniqueId = this.allowOnlyLoggedInUsers(auth)
      const user = await User.query().where('uniqueId', uniqueId).firstOrFail()

      const { surname, full_name, phone } = request.only(['surname', 'full_name', 'phone'])

      if (surname !== undefined) {
        user.lastName = String(surname).trim()
      }

      if (full_name !== undefined) {
        const parts = String(full_name).trim().split(/\s+/)
        user.firstName = parts.slice(0, -1).join(' ') || parts[0]
        user.lastName = parts.length > 1 ? parts[parts.length - 1] : user.lastName
      }

      if (phone !== undefined) {
        // Ensure phone is not already taken by another user
        const existing = await User.query()
          .where('phone', String(phone).trim())
          .whereNot('uniqueId', uniqueId)
          .first()
        if (existing) throw new Error('This phone number is already in use.')
        user.phone = String(phone).trim()
      }

      await user.save()

      return response.ok(formatSuccessMessage('Account info updated successfully', {
        surname: user.lastName,
        full_name: `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim(),
        email: user.email,
        phone: user.phone,
        profile_image: user.profileImage,
      }))
    } catch (error) {
      return response.badRequest(await formatErrorMessage(error))
    }
  }

  /**
   * POST /user/account-info/profile-image
   * Upload a new profile image. Replaces the old one on Cloudinary.
   * Body (multipart/form-data): { profile_image: File }
   */
  public async uploadProfileImage({ auth, request, response }: HttpContextContract) {
    const fileService = new FileUploadService()
    try {
      const uniqueId = this.allowOnlyLoggedInUsers(auth)
      const user = await User.query().where('uniqueId', uniqueId).firstOrFail()

      const file = request.file('profile_image', {
        size: '5mb',
        extnames: ['jpg', 'jpeg', 'png', 'webp'],
      })

      if (!file) throw new Error('profile_image file is required.')
      if (!file.isValid) throw new Error(file.errors?.[0]?.message ?? 'Invalid file.')

      // Delete old image from Cloudinary if exists
      if (user.profileImagePublicId) {
        await fileService.deleteFile(user.profileImagePublicId)
      }

      const uploaded = await fileService.uploadProfileImage(file, uniqueId)

      user.profileImage = uploaded.url
      user.profileImagePublicId = uploaded.path
      await user.save()

      return response.ok(formatSuccessMessage('Profile image updated', {
        profile_image: user.profileImage,
      }))
    } catch (error) {
      return response.badRequest(await formatErrorMessage(error))
    }
  }
}
