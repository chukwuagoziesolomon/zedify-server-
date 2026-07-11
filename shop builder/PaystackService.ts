import { createHmac } from 'crypto'
import Env from '@ioc:Adonis/Core/Env'
import Logger from '@ioc:Adonis/Core/Logger'

/**
 * Thin wrapper around Paystack's charge + webhook verification.
 * Swap for FlutterwaveService with the same method signatures if that's
 * your actual chosen provider — nothing else in this scaffold depends on
 * which one you pick, as long as it exposes initializeCharge/verifySignature.
 */
class PaystackService {
  private secretKey = Env.get('PAYSTACK_SECRET_KEY')
  private baseUrl = 'https://api.paystack.co'

  /**
   * Starts a charge for a naira deposit. Returns the hosted checkout URL
   * the frontend should redirect the user to.
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
      Logger.error(`[PaystackService] initializeCharge failed: ${res.status} ${body}`)
      throw new Error('Failed to initialize Paystack charge')
    }

    const data = await res.json()
    return {
      authorizationUrl: data.data.authorization_url,
      accessCode: data.data.access_code,
    }
  }

  /** Verify a transaction reference directly against Paystack (belt-and-braces alongside the webhook). */
  async verifyTransaction(reference: string): Promise<{ success: boolean; amountNaira: number }> {
    const res = await fetch(`${this.baseUrl}/transaction/verify/${reference}`, {
      headers: { Authorization: `Bearer ${this.secretKey}` },
    })
    const data = await res.json()
    return {
      success: data?.data?.status === 'success',
      amountNaira: (data?.data?.amount ?? 0) / 100,
    }
  }

  /** Paystack signs webhook bodies with HMAC-SHA512 using your secret key. */
  verifySignature(signature: string, rawBody: string): boolean {
    const expected = createHmac('sha512', this.secretKey).update(rawBody).digest('hex')
    return signature.length === expected.length && signature === expected
  }
}

export default new PaystackService()
