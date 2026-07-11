import { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import Product from 'App/Models/Product'
import Shop from 'App/Models/Shop'

export default class ProductController {
  /**
   * GET /api/shops/:slug/products?category=food
   * Powers the Yanga template's shop grid + category filter tabs.
   */
  public async index({ params, request, response }: HttpContextContract) {
    const shop = await Shop.query().where('slug', params.slug).firstOrFail()

    const query = Product.query().where('shopId', shop.id).where('status', 'active')
    const category = request.input('category')
    if (category && category !== 'all') {
      query.where('category', category)
    }

    const products = await query
    return response.ok({ products: products.map((p) => this.serialize(p)) })
  }

  /**
   * POST /api/shops/:slug/products
   * body: { category, name, description?, priceNaira, imageUrl?, attributes, stockQuantity? }
   * `attributes` shape depends on category — see Product.ts for the contract
   * each one expects (FoodAttributes, FashionAttributes, etc.)
   */
  public async store({ params, request, response }: HttpContextContract) {
    const shop = await Shop.query().where('slug', params.slug).firstOrFail()
    const payload = request.only([
      'category',
      'name',
      'description',
      'priceNaira',
      'imageUrl',
      'attributes',
      'stockQuantity',
    ])

    if (!payload.category || !payload.name || !payload.priceNaira) {
      return response.badRequest({ error: 'category, name, and priceNaira are required' })
    }

    const validationError = this.validateAttributesForCategory(payload.category, payload.attributes)
    if (validationError) {
      return response.badRequest({ error: validationError })
    }

    const product = new Product()
    product.shopId = shop.id
    product.category = payload.category
    product.name = payload.name
    product.description = payload.description ?? null
    product.priceNaira = payload.priceNaira
    product.imageUrl = payload.imageUrl ?? null
    product.attributes = payload.attributes ?? {}
    product.stockQuantity = payload.stockQuantity ?? null
    product.status = 'active'
    await product.save()

    return response.created({ product: this.serialize(product) })
  }

  public async update({ params, request, response }: HttpContextContract) {
    const product = await Product.query().where('uniqueId', params.id).firstOrFail()
    const payload = request.only(['name', 'description', 'priceNaira', 'imageUrl', 'attributes', 'stockQuantity', 'status'])

    if (payload.attributes) {
      const validationError = this.validateAttributesForCategory(product.category, payload.attributes)
      if (validationError) {
        return response.badRequest({ error: validationError })
      }
    }

    product.merge(payload)
    await product.save()
    return response.ok({ product: this.serialize(product) })
  }

  public async destroy({ params, response }: HttpContextContract) {
    const product = await Product.query().where('uniqueId', params.id).firstOrFail()
    product.status = 'archived'
    await product.save()
    return response.ok({ success: true })
  }

  /** Minimal shape check so a "fashion" product can't be saved without sizes, etc. */
  private validateAttributesForCategory(category: string, attributes: any): string | null {
    if (!attributes) return 'attributes is required'

    switch (category) {
      case 'food':
        if (!attributes.unit) return 'food products require attributes.unit'
        break
      case 'fashion':
        if (!Array.isArray(attributes.sizes) || attributes.sizes.length === 0)
          return 'fashion products require attributes.sizes as a non-empty array'
        break
      case 'gadgets':
        if (!Array.isArray(attributes.specs) || attributes.specs.length === 0)
          return 'gadget products require attributes.specs as a non-empty array'
        break
      case 'vehicles':
        if (!attributes.year || !attributes.mileageKm || !attributes.transmission)
          return 'vehicle products require attributes.year, mileageKm, and transmission'
        break
      default:
        // custom/unlisted categories — no strict shape enforced
        break
    }
    return null
  }

  private serialize(product: Product) {
    return {
      id: product.uniqueId,
      category: product.category,
      name: product.name,
      description: product.description,
      priceNaira: Number(product.priceNaira),
      imageUrl: product.imageUrl,
      attributes: product.attributes,
      stockQuantity: product.stockQuantity,
      status: product.status,
    }
  }
}
