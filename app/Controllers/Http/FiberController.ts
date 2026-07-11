import { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import FiberService from 'App/Services/FiberService'
import FiberInvoiceService from 'App/Services/FiberInvoiceService'

export default class FiberController {
  private formatError(error: any) {
    return { error: true, message: error?.message || 'Unexpected error' }
  }

  public async nodeInfo({ response }: HttpContextContract) {
    try {
      const info = await FiberService.getNodeInfo()
      return response.ok({ success: true, data: info })
    } catch (error) {
      return response.internalServerError(this.formatError(error))
    }
  }

  public async listChannels({ auth, response }: HttpContextContract) {
    try {
      const userId = auth.user?.id
      if (!userId) {
        return response.unauthorized({ error: true, message: 'Unauthorized' })
      }

      const channels = await FiberService.listChannels(String(userId))
      return response.ok({ success: true, data: { channels } })
    } catch (error) {
      return response.internalServerError(this.formatError(error))
    }
  }

  public async openChannel({ auth, request, response }: HttpContextContract) {
    try {
      const userId = auth.user?.id
      if (!userId) {
        return response.unauthorized({ error: true, message: 'Unauthorized' })
      }

      const { peerId, fundingAmount, isPublic, isOneWay } = request.all()
      const channel = await FiberService.openChannel(
        String(userId),
        peerId,
        Number(fundingAmount),
        isPublic !== false,
        isOneWay === true
      )

      return response.ok({ success: true, data: { channel } })
    } catch (error) {
      return response.internalServerError(this.formatError(error))
    }
  }

  public async createInvoice({ auth, request, response }: HttpContextContract) {
    try {
      const userId = auth.user?.id
      if (!userId) {
        return response.unauthorized({ error: true, message: 'Unauthorized' })
      }

      const { amount, description, expirySeconds } = request.all()
      const invoice = await FiberService.createInvoice(
        String(userId),
        Number(amount),
        description || 'Payment for order',
        Number(expirySeconds) || 3600
      )

      return response.ok({ success: true, data: { invoice } })
    } catch (error) {
      return response.internalServerError(this.formatError(error))
    }
  }

  public async sendPayment({ auth, request, response }: HttpContextContract) {
    try {
      const userId = auth.user?.id
      if (!userId) {
        return response.unauthorized({ error: true, message: 'Unauthorized' })
      }

      const { invoice, maxFee } = request.all()
      if (!invoice) {
        return response.badRequest({ error: true, message: 'invoice is required' })
      }

      const payment = await FiberService.sendPayment(invoice, maxFee ? Number(maxFee) : undefined)

      return response.ok({ success: true, data: { payment } })
    } catch (error) {
      return response.internalServerError(this.formatError(error))
    }
  }

  public async getPayment({ params, response }: HttpContextContract) {
    try {
      const payment = await FiberService.getPaymentStatus(params.paymentHash)
      if (!payment) {
        return response.notFound({ error: true, message: 'Payment not found' })
      }
      return response.ok({ success: true, data: { payment } })
    } catch (error) {
      return response.internalServerError(this.formatError(error))
    }
  }

  public async getInvoice({ params, response }: HttpContextContract) {
    try {
      const invoice = await FiberService.getInvoice(params.paymentHash)
      if (!invoice) {
        return response.notFound({ error: true, message: 'Invoice not found' })
      }
      return response.ok({ success: true, data: { invoice } })
    } catch (error) {
      return response.internalServerError(this.formatError(error))
    }
  }

  public async checkInvoice({ params, response }: HttpContextContract) {
    try {
      const { invoice, payment } = await FiberInvoiceService.checkInvoiceStatus(params.invoiceAddress)
      if (!invoice) {
        return response.notFound({ error: true, message: 'Invoice not found' })
      }
      return response.ok({ success: true, data: { invoice, payment } })
    } catch (error) {
      return response.internalServerError(this.formatError(error))
    }
  }

  public async syncChannels({ auth, response }: HttpContextContract) {
    try {
      const userId = auth.user?.id
      if (!userId) {
        return response.unauthorized({ error: true, message: 'Unauthorized' })
      }

      await FiberService.syncChannels(String(userId))
      return response.ok({ success: true, message: 'Channels synced' })
    } catch (error) {
      return response.internalServerError(this.formatError(error))
    }
  }

  public async syncInvoices({ auth, response }: HttpContextContract) {
    try {
      const userId = auth.user?.id
      if (!userId) {
        return response.unauthorized({ error: true, message: 'Unauthorized' })
      }

      const invoices = await FiberInvoiceService.syncInvoices(String(userId))
      return response.ok({ success: true, data: { invoices } })
    } catch (error) {
      return response.internalServerError(this.formatError(error))
    }
  }
}
