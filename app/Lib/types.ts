export enum FeeBearer {
  BUSINESS = 'BUSINESS',
  CUSTOMERS = 'CUSTOMERS',
}

export enum CurrentEnvironment {
  LIVE = 'LIVE',
  TEST = 'TEST',
}

export enum PayoutInterval {
  INSTANT = 'INSTANT',
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
}

export enum PayoutType {
  CRYPTO = 'CRYPTO',
  FIAT = 'FIAT',
}

export enum CurrencyType {
  CRYPTO = 'CRYPTO',
  FIAT = 'FIAT',
}

export enum PaymentIntentStatus {
  PAYMENT_CREATED = 'payment_created',
  INCOMPLETE_PAYMENT = 'incomplete_payment',
  AWAITING_CONFIRMATION = 'awaiting_confirmation',
  PAYMENT_COMPLETED = 'payment_completed',
}

export enum WalletType {
  MASTER = 'master',
  CHILD = 'child',
}

export enum BusinessCurrencyStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
}
