import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import { formatErrorMessage, formatSuccessMessage } from 'App/helpers/utils'
import RolesController from './RolesController'
import Shop from 'App/Models/Shop'
import ShopProduct from 'App/Models/ShopProduct'
import { FileUploadService } from 'App/Services/FileUploadService'
import { genRandomUuid } from 'App/helpers/utils'

export default class ShopProductController extends RolesController {
  /**
   * GET /user/shop/products
   * List all products for the user's shop.
   * Query: page?, limit?, category?, active?
   */
  public async index({ auth, request, response }: HttpContextContract) {
    try {
      const uniqueId = this.allowOnlyLoggedInUsers(auth)
      const shop = await Shop.query().where('userId', uniqueId).firstOrFail()

      const page = Number(request.input('page', 1)) || 1
      const limit = Number(request.input('limit', 20)) || 20
      const category = request.input('category')
      const active = request.input('active')

      const query = ShopProduct.query().where('shopId', shop.uniqueId)
      if (category) query.where('category', String(category))
      if (active !== undefined && active !== null) query.where('isActive', active === 'true')

      const products = await query.orderBy('createdAt', 'desc').paginate(page, limit)

      return response.ok(formatSuccessMessage('Products retrieved', products))
    } catch (error) {
      return response.badRequest(await formatErrorMessage(error))
    }
  }

  /**
   * POST /user/shop/products
   * Create a new product.
   * Body (JSON): { name, price, description?, category?, stock?, track_stock?, variants? }
   */
  public async create({ auth, request, response }: HttpContextContract) {
    try {
      const uniqueId = this.allowOnlyLoggedInUsers(auth)
      const shop = await Shop.query().where('userId', uniqueId).firstOrFail()

      const { name, price, description, category, stock, track_stock, variants } = request.only([
        'name', 'price', 'description', 'category', 'stock', 'track_stock', 'variants',
      ])

      if (!name) throw new Error('name is required.')
      if (price === undefined || price === null) throw new Error('price is required.')
      if (isNaN(parseFloat(price))) throw new Error('price must be a number.')

      const product = await ShopProduct.create({
        uniqueId: genRandomUuid(),
        shopId: shop.uniqueId,
        name: String(name).trim(),
        price: parseFloat(price),
        currency: shop.currency,
        description: description ? String(description).trim() : null,
        category: category ? String(category).trim() : null,
        stock: parseInt(stock) || 0,
        trackStock: track_stock === true || track_stock === 'true',
        variants: variants || null,
        isActive: true,
      })

      return response.ok(formatSuccessMessage('Product created', product))
    } catch (error) {
      return response.badRequest(await formatErrorMessage(error))
    }
  }

  /**
   * PUT /user/shop/products/:productId
   * Update a product.
   */
  public async update({ auth, request, response, params }: HttpContextContract) {
    try {
      const uniqueId = this.allowOnlyLoggedInUsers(auth)
      const shop = await Shop.query().where('userId', uniqueId).firstOrFail()
      const product = await ShopProduct.query()
        .where('uniqueId', params.productId)
        .where('shopId', shop.uniqueId)
        .firstOrFail()

      const { name, price, description, category, stock, track_stock, variants, is_active } =
        request.only(['name', 'price', 'description', 'category', 'stock', 'track_stock', 'variants', 'is_active'])

      if (name) product.name = String(name).trim()
      if (price !== undefined) product.price = parseFloat(price)
      if (description !== undefined) product.description = description ? String(description).trim() : null
      if (category !== undefined) product.category = category ? String(category).trim() : null
      if (stock !== undefined) product.stock = parseInt(stock) || 0
      if (track_stock !== undefined) product.trackStock = track_stock === true || track_stock === 'true'
      if (variants !== undefined) product.variants = variants || null
      if (is_active !== undefined) product.isActive = is_active === true || is_active === 'true'

      await product.save()

      return response.ok(formatSuccessMessage('Product updated', product))
    } catch (error) {
      return response.badRequest(await formatErrorMessage(error))
    }
  }

  /**
   * DELETE /user/shop/products/:productId
   * Soft-delete a product (sets is_active = false).
   */
  public async destroy({ auth, response, params }: HttpContextContract) {
    try {
      const uniqueId = this.allowOnlyLoggedInUsers(auth)
      const shop = await Shop.query().where('userId', uniqueId).firstOrFail()
      const product = await ShopProduct.query()
        .where('uniqueId', params.productId)
        .where('shopId', shop.uniqueId)
        .firstOrFail()

      product.isActive = false
      await product.save()

      return response.ok(formatSuccessMessage('Product removed', null))
    } catch (error) {
      return response.badRequest(await formatErrorMessage(error))
    }
  }

  /**
   * POST /user/shop/products/:productId/images
   * Upload one or more product images (Cloudinary).
   * Body (multipart): { images: File[] } (max 5 images, 5MB each)
   */
  public async uploadImages({ auth, request, response, params }: HttpContextContract) {
    const fileService = new FileUploadService()
    try {
      const uniqueId = this.allowOnlyLoggedInUsers(auth)
      const shop = await Shop.query().where('userId', uniqueId).firstOrFail()
      const product = await ShopProduct.query()
        .where('uniqueId', params.productId)
        .where('shopId', shop.uniqueId)
        .firstOrFail()

      const files = request.files('images', { size: '5mb', extnames: ['jpg', 'jpeg', 'png', 'webp'] })
      if (!files || files.length === 0) throw new Error('At least one image is required.')
      if (files.length > 5) throw new Error('Maximum 5 images per product.')

      const existing: { url: string; publicId: string }[] = product.images ?? []
      const uploaded: { url: string; publicId: string }[] = []

      for (const file of files) {
        if (!file.isValid) throw new Error(file.errors?.[0]?.message ?? 'Invalid file.')
        const result = await fileService.uploadProfileImage(file, `shop-product-${product.uniqueId}`)
        uploaded.push({ url: result.url, publicId: result.path })
      }

      product.images = [...existing, ...uploaded]
      await product.save()

      return response.ok(formatSuccessMessage('Images uploaded', { images: product.images }))
    } catch (error) {
      return response.badRequest(await formatErrorMessage(error))
    }
  }

  /**
   * DELETE /user/shop/products/:productId/images/:publicId
   * Remove a specific product image from Cloudinary and the product record.
   */
  public async deleteImage({ auth, response, params }: HttpContextContract) {
    const fileService = new FileUploadService()
    try {
      const uniqueId = this.allowOnlyLoggedInUsers(auth)
      const shop = await Shop.query().where('userId', uniqueId).firstOrFail()
      const product = await ShopProduct.query()
        .where('uniqueId', params.productId)
        .where('shopId', shop.uniqueId)
        .firstOrFail()

      const publicId = decodeURIComponent(params.publicId)
      await fileService.deleteFile(publicId)

      product.images = (product.images ?? []).filter((img) => img.publicId !== publicId)
      await product.save()

      return response.ok(formatSuccessMessage('Image deleted', { images: product.images }))
    } catch (error) {
      return response.badRequest(await formatErrorMessage(error))
    }
  }
}
