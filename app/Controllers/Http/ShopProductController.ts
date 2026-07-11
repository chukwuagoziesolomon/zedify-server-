import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import { formatErrorMessage, formatSuccessMessage } from 'App/helpers/utils'
import RolesController from './RolesController'
import Shop from 'App/Models/Shop'
import ShopProduct from 'App/Models/ShopProduct'
import { FileUploadService } from 'App/Services/FileUploadService'
import { genRandomUuid } from 'App/helpers/utils'
import { getDefaultFeatures, SHOP_PRODUCT_FEATURES } from 'App/Lib/shopFeatures'

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
   * Body (JSON): { name, price, description?, category?, stock?, track_stock?, variants?, product_type? }
   */
  public async create({ auth, request, response }: HttpContextContract) {
    try {
      const uniqueId = this.allowOnlyLoggedInUsers(auth)
      const shop = await Shop.query().where('userId', uniqueId).firstOrFail()

      const { name, price, description, category, stock, track_stock, variants, product_type } = request.only([
        'name', 'price', 'description', 'category', 'stock', 'track_stock', 'variants', 'product_type',
      ])

      if (!name) throw new Error('name is required.')
      if (price === undefined || price === null) throw new Error('price is required.')
      if (isNaN(parseFloat(price))) throw new Error('price must be a number.')

      const features = shop.features || getDefaultFeatures(shop.template || 'yanga-default')
      const existingCount = await ShopProduct.query().where('shopId', shop.uniqueId).count('id as total')
      const currentCount = Number((existingCount as any)[0]?.total || 0)
      if (currentCount >= features.max_products) {
        throw new Error(`Maximum ${features.max_products} products allowed for this shop template.`)
      }

      if (product_type && !features.allowed_product_types.includes(product_type)) {
        throw new Error(`Product type "${product_type}" is not allowed for this shop. Allowed: ${features.allowed_product_types.join(', ')}`)
      }

      if (features.allow_product_categories && !category) {
        throw new Error('category is required for this shop template.')
      }
      if (!features.allow_product_categories && category) {
        throw new Error('This shop template does not support product categories.')
      }

      if (!features.allow_product_variants && variants) {
        throw new Error('This shop template does not support product variants.')
      }

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

      const rawFiles = request.files('images', { size: '5mb', extnames: ['jpg', 'jpeg', 'png', 'webp'] })
      const files = Array.isArray(rawFiles) ? rawFiles : rawFiles ? [rawFiles] : []
      if (!files || files.length === 0) throw new Error('At least one image is required.')

      const features = shop.features || getDefaultFeatures(shop.template || 'yanga-default')
      const maxImages = features.max_images_per_product || SHOP_PRODUCT_FEATURES.MAX_IMAGES_PER_PRODUCT
      const existingCount = (product.images ?? []).length
      if (existingCount + files.length > maxImages) {
        throw new Error(`Maximum ${maxImages} images allowed per product. You already have ${existingCount}.`)
      }
      if (files.length > 5) throw new Error('Maximum 5 images per upload batch.')

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
