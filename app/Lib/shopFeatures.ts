export interface ShopFeatures {
  allow_product_images: boolean
  allow_product_variants: boolean
  allow_product_categories: boolean
  allow_banner: boolean
  allow_logo: boolean
  allow_ai_chat: boolean
  max_products: number
  max_images_per_product: number
  allowed_product_types: ('physical' | 'digital' | 'service')[]
  allow_pay_on_delivery: boolean
  allowed_currency_ids: string[]
}

export interface ShopTemplatePreset {
  template: string
  label: string
  description: string
  features: ShopFeatures
  defaultTheme: Record<string, any>
}

export const SHOP_TEMPLATES: Record<string, ShopTemplatePreset> = {
  'yanga-default': {
    template: 'yanga-default',
    label: 'Default Shop',
    description: 'Basic storefront with essential features for getting started.',
    features: {
      allow_product_images: true,
      allow_product_variants: true,
      allow_product_categories: true,
      allow_banner: true,
      allow_logo: true,
      allow_ai_chat: false,
      max_products: 50,
      max_images_per_product: 5,
      allowed_product_types: ['physical', 'digital'],
      allow_pay_on_delivery: true,
      allowed_currency_ids: [],
    },
    defaultTheme: {
      colorPrimary: '#1C2B4A',
      colorAccent: '#F2A93B',
      colorHighlight: '#F2A93B',
      fontFamily: 'Inter',
      layout: 'standard',
    },
  },
  'fashion-store': {
    template: 'fashion-store',
    label: 'Fashion Store',
    description: 'Optimized for fashion and apparel with lookbooks and size variants.',
    features: {
      allow_product_images: true,
      allow_product_variants: true,
      allow_product_categories: true,
      allow_banner: true,
      allow_logo: true,
      allow_ai_chat: false,
      max_products: 200,
      max_images_per_product: 8,
      allowed_product_types: ['physical'],
      allow_pay_on_delivery: true,
      allowed_currency_ids: [],
    },
    defaultTheme: {
      colorPrimary: '#1a1a1a',
      colorAccent: '#d4af37',
      colorHighlight: '#f5f5f5',
      fontFamily: 'Playfair Display',
      layout: 'masonry',
    },
  },
  'digital-goods': {
    template: 'digital-goods',
    label: 'Digital Goods',
    description: 'For digital products, downloads, and online services.',
    features: {
      allow_product_images: true,
      allow_product_variants: false,
      allow_product_categories: true,
      allow_banner: true,
      allow_logo: true,
      allow_ai_chat: false,
      max_products: 100,
      max_images_per_product: 4,
      allowed_product_types: ['digital', 'service'],
      allow_pay_on_delivery: false,
      allowed_currency_ids: [],
    },
    defaultTheme: {
      colorPrimary: '#2563eb',
      colorAccent: '#7c3aed',
      colorHighlight: '#dbeafe',
      fontFamily: 'Inter',
      layout: 'grid',
    },
  },
  'service-booking': {
    template: 'service-booking',
    label: 'Service Booking',
    description: 'For service-based businesses with appointment scheduling.',
    features: {
      allow_product_images: true,
      allow_product_variants: false,
      allow_product_categories: true,
      allow_banner: true,
      allow_logo: true,
      allow_ai_chat: false,
      max_products: 50,
      max_images_per_product: 3,
      allowed_product_types: ['service'],
      allow_pay_on_delivery: true,
      allowed_currency_ids: [],
    },
    defaultTheme: {
      colorPrimary: '#059669',
      colorAccent: '#10b981',
      colorHighlight: '#d1fae5',
      fontFamily: 'Inter',
      layout: 'list',
    },
  },
  'ai-custom': {
    template: 'ai-custom',
    label: 'AI Custom',
    description: 'Fully AI-generated custom storefront with advanced features.',
    features: {
      allow_product_images: true,
      allow_product_variants: true,
      allow_product_categories: true,
      allow_banner: true,
      allow_logo: true,
      allow_ai_chat: true,
      max_products: 500,
      max_images_per_product: 10,
      allowed_product_types: ['physical', 'digital', 'service'],
      allow_pay_on_delivery: true,
      allowed_currency_ids: [],
    },
    defaultTheme: {
      colorPrimary: '#1C2B4A',
      colorAccent: '#F2A93B',
      colorHighlight: '#F2A93B',
      fontFamily: 'Inter',
      layout: 'standard',
    },
  },
}

export function getTemplatePreset(template: string): ShopTemplatePreset {
  return SHOP_TEMPLATES[template] || SHOP_TEMPLATES['yanga-default']
}

export function getDefaultFeatures(template: string): ShopFeatures {
  return getTemplatePreset(template).features
}

export const SHOP_PRODUCT_FEATURES = {
  ALLOWED_IMAGE_EXTENSIONS: ['jpg', 'jpeg', 'png', 'webp'],
  MAX_IMAGES_PER_PRODUCT: 10,
  MAX_PRODUCTS_PER_SHOP: 500,
} as const
