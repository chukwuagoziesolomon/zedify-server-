import { test } from '@japa/runner'
import ShopBuilderController from 'App/Controllers/Http/ShopBuilderController'
import Shop from 'App/Models/Shop'
import PaymentLink from 'App/Models/PaymentLink'
import User from 'App/Models/User'
import { genRandomUuid } from 'App/helpers/utils'

test.group('Shop builder payment gateway', () => {
  test('should normalize legacy and AI customization shop payloads', async ({ assert }) => {
    const controller = new ShopBuilderController() as any

    const legacyPayload = controller.resolveShopCreationPayload({
      name: 'Legacy Store',
      primaryCategory: 'fashion',
      allowPayOnDelivery: true,
      acceptedCurrencyIds: ['usdt'],
    })

    assert.equal(legacyPayload.businessName, 'Legacy Store')
    assert.equal(legacyPayload.shopType, 'default')
    assert.equal(legacyPayload.template, 'yanga-default')
    assert.equal(legacyPayload.primaryCategory, 'fashion')
    assert.isTrue(legacyPayload.allowPayOnDelivery)
    assert.deepEqual(legacyPayload.acceptedCurrencyIds, ['usdt'])

    const aiPayload = controller.resolveShopCreationPayload({
      business_name: 'AI Store',
      subdomain: 'ai-store',
      shop_type: 'ai_custom',
      template: 'ai-custom',
    })

    assert.equal(aiPayload.businessName, 'AI Store')
    assert.equal(aiPayload.shopType, 'ai_custom')
    assert.equal(aiPayload.template, 'ai-custom')
    assert.equal(aiPayload.primaryCategory, null)
  })

  test('should auto-create a payment link for a shop', async ({ assert }) => {
    const controller = new ShopBuilderController()

    const user = await User.create({
      uniqueId: genRandomUuid(),
      firstName: 'Gateway',
      lastName: 'Test',
      businessName: 'Gateway Test Business',
      country: 'NG',
      email: `gateway-${Date.now()}@example.com`,
      password: 'Password123!',
      isBlocked: false,
      isDeleted: false,
      isVerified: true,
      phone: '08000000000',
      bvn: '12345678901',
      cacNumber: '1234567890',
    })

    const shop = await Shop.create({
      uniqueId: genRandomUuid(),
      userId: user.uniqueId,
      businessName: 'Auto Gateway Shop',
      subdomain: `auto-gateway-${Date.now()}`,
      description: 'Test shop for gateway integration',
      currency: 'NGN',
      status: 'draft',
    })

    try {
      const gateway = await (controller as any).ensureShopPaymentGateway(shop)

      assert.isTrue(gateway.enabled)
      assert.include(gateway.checkout_url, '/api/pay/')

      const paymentLink = await PaymentLink.query().where('businessId', shop.userId).first()
      assert.exists(paymentLink)
      assert.equal(paymentLink?.businessId, shop.userId)
    } finally {
      await PaymentLink.query().where('businessId', shop.userId).delete()
      await shop.delete()
      await user.delete()
    }
  })
})
