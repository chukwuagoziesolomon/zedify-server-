import { createHmac } from 'crypto'
import Env from '@ioc:Adonis/Core/Env'
import Logger from '@ioc:Adonis/Core/Logger'

/**
 * Thin wrapper around Paystack's charge + webhook verification.
 * Used for fiat (NGN) deposits that get converted to crypto stablecoins
 * and credited to the user's preferred wallet.
 *
 * To switch providers (e.g. Flutterwave), implement the same three
 * method signatures — nothing else in the codebase depends on the internals.
 */
class PaystackChargeService {
  private get secretKey() {
    return Env.get('PAYSTACK_SECRET_KEY')
  }

  private readonly baseUrl = 'https://api.paystack.co'

  /**
   * Initialise a charge and return the Paystack hosted checkout URL.
   * Redirect the user to authorizationUrl to complete payment.
   */
  async initializeCharge(params: {
    email: string
    amountNaira: number
    reference: string
    metadata?: Record<string, unknown>
  }): Promise<{ authorizationUrl: string; accessCode: string }> {
    const res = await fetch(`${this.baseUrl}/transaction/initialize`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: params.email,
        amount: Math.round(params.amountNaira * 100), // Paystack expects kobo
        reference: params.reference,
        metadata: params.metadata ?? {},
      }),
    })

    if (!res.ok) {
      const body = await res.text()
      Logger.error(`[PaystackChargeService] initializeCharge failed: ${res.status} ${body}`)
      throw new Error('Failed to initialize Paystack charge')
    }

    const data: any = await res.json()
    return {
      authorizationUrl: data.data.authorization_url,
      accessCode: data.data.access_code,
    }
  }

  /** Belt-and-braces: verify a reference directly against Paystack (alongside the webhook). */
  async verifyTransaction(reference: string): Promise<{ success: boolean; amountNaira: number }> {
    const res = await fetch(`${this.baseUrl}/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${this.secretKey}` },
    })
    const data: any = await res.json()
    return {
      success: data?.data?.status === 'success',
      amountNaira: (data?.data?.amount ?? 0) / 100,
    }
  }

  /** Verify an inbound Paystack webhook signature (HMAC-SHA512). */
  verifySignature(signature: string, rawBody: string): boolean {
    const expected = createHmac('sha512', this.secretKey).update(rawBody).digest('hex')
    return signature.length === expected.length && signature === expected
  }
}

export default new PaystackChargeService()
