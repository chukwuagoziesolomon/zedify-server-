import Env from '@ioc:Adonis/Core/Env'
import Logger from '@ioc:Adonis/Core/Logger'
import FiberService from 'App/Services/FiberService'
import FiberInvoice, { FiberInvoiceStatus } from 'App/Models/FiberInvoice'
import PaymentIntent from 'App/Models/PaymentIntent'
import { PaymentIntentStatus } from 'App/Lib/types'
import { DateTime } from 'luxon'

class FiberInvoiceServiceClass {
  private get fiberNetwork(): 'mainnet' | 'testnet' | 'devnet' {
    return (Env.get('FIBER_NETWORK', 'testnet') as 'mainnet' | 'testnet' | 'devnet')
  }

  public async createInvoiceForIntent(paymentIntentId: string, businessId: string, amountCkb: number, description = 'Payment for order', expirySeconds = 3600): Promise<FiberInvoice> {
    const paymentIntent = await PaymentIntent.query().where('uniqueId', paymentIntentId).firstOrFail()

    const fiberInvoice = await FiberService.createInvoice(businessId, amountCkb, description, expirySeconds)
    const expiresAt = DateTime.now().plus({ seconds: expirySeconds })

    const invoice = await FiberInvoice.create({
      paymentIntentId: paymentIntent.uniqueId,
      businessId,
      invoiceAddress: fiberInvoice.invoiceAddress,
      amountCkb,
      description,
      currency: this.fiberNetwork === 'mainnet' ? 'Fibb' : 'Fibt',
      status: FiberInvoiceStatus.PENDING,
      rawInvoice: fiberInvoice.invoice,
      expiresAt,
    })

    Logger.info('[FiberInvoice] Created invoice intent=%s address=%s amount=%s CKB', paymentIntent.uniqueId, invoice.invoiceAddress, amountCkb)
    return invoice
  }

  public async getInvoiceByIntent(paymentIntentId: string): Promise<FiberInvoice | null> {
    return await FiberInvoice.query().where('paymentIntentId', paymentIntentId).first()
  }

  public async getByAddress(invoiceAddress: string): Promise<FiberInvoice | null> {
    return await FiberInvoice.query().where('invoiceAddress', invoiceAddress).first()
  }

  public async markPaid(fiberInvoiceUniqueId: string, paymentHash: string): Promise<FiberInvoice | null> {
    const invoice = await FiberInvoice.query().where('uniqueId', fiberInvoiceUniqueId).firstOrFail()
    invoice.status = FiberInvoiceStatus.PAID
    invoice.paymentHash = paymentHash
    invoice.paidAt = DateTime.now()
    await invoice.save()

    await this.confirmPaymentIntent(invoice)
    Logger.info('[FiberInvoice] Marked paid address=%s hash=%s', invoice.invoiceAddress, paymentHash)
    return invoice
  }

  public async markExpired(invoiceUniqueId: string): Promise<FiberInvoice | null> {
    const invoice = await FiberInvoice.query().where('uniqueId', invoiceUniqueId).firstOrFail()
    invoice.status = FiberInvoiceStatus.EXPIRED
    await invoice.save()
    return invoice
  }

  public async markFailed(invoiceUniqueId: string): Promise<FiberInvoice | null> {
    const invoice = await FiberInvoice.query().where('uniqueId', invoiceUniqueId).firstOrFail()
    invoice.status = FiberInvoiceStatus.FAILED
    await invoice.save()
    return invoice
  }

  private async confirmPaymentIntent(fiberInvoice: FiberInvoice): Promise<void> {
    const paymentIntent = await PaymentIntent.query().where('uniqueId', fiberInvoice.paymentIntentId).first()
    if (!paymentIntent) return

    if (paymentIntent.status === PaymentIntentStatus.PAYMENT_COMPLETED) return

    paymentIntent.status = PaymentIntentStatus.AWAITING_CONFIRMATION
    paymentIntent.receivedPaymentAt = DateTime.now()
    await paymentIntent.save()
  }

  public async checkInvoiceStatus(invoiceAddress: string): Promise<{ invoice: FiberInvoice | null; payment: any }> {
    const payment = await FiberService.getPaymentStatus(invoiceAddress)
    const invoice = await this.getByAddress(invoiceAddress)

    if (!invoice) {
      return { invoice: null, payment }
    }

    if (payment && this.isFiberPaymentSuccess(payment.status)) {
      if (invoice.status === FiberInvoiceStatus.PENDING) {
        await this.markPaid(invoice.uniqueId, payment.paymentHash)
      }
    }

    return { invoice, payment }
  }

  private isFiberPaymentSuccess(status: string): boolean {
    const normalized = String(status || '').toLowerCase()
    return ['succeeded', 'completed', 'success', 'paid', 'confirmed'].includes(normalized)
  }

  public async syncInvoices(businessId: string): Promise<FiberInvoice[]> {
    const invoices = await FiberInvoice.query().where('businessId', businessId).where('status', FiberInvoiceStatus.PENDING)
    const now = DateTime.now()

    for (const invoice of invoices) {
      try {
        if (invoice.expiresAt && DateTime.fromISO(invoice.expiresAt as any) < now) {
          await this.markExpired(invoice.uniqueId)
          continue
        }

        const { payment } = await this.checkInvoiceStatus(invoice.invoiceAddress)
        if (payment && this.isFiberPaymentSuccess(payment.status)) {
          await this.markPaid(invoice.uniqueId, payment.paymentHash)
        }
      } catch (error) {
        Logger.warn('[FiberInvoice] Sync failed for invoice=%s: %s', invoice.uniqueId, error.message)
      }
    }

    return invoices
  }
}

export default new FiberInvoiceServiceClass()
