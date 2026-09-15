import axios from 'axios'
import Env from '@ioc:Adonis/Core/Env'
import Logger from '@ioc:Adonis/Core/Logger'

class WhatsAppNotificationService {
  public async sendOrderConfirmation(phone: string | null, data: {
    referenceId: string
    shopName: string
    amount: number
    currency: string
  }): Promise<void> {
    const token = Env.get('WHATSAPP_ACCESS_TOKEN', '')
    const phoneNumberId = Env.get('WHATSAPP_PHONE_NUMBER_ID', '')
    if (!phone || !token || !phoneNumberId) return

    const recipient = phone.replace(/[^\d]/g, '')
    if (!recipient) return

    try {
      const version = Env.get('WHATSAPP_API_VERSION', 'v20.0')
      const template = Env.get('WHATSAPP_ORDER_TEMPLATE', '')
      const body = template
        ? {
            messaging_product: 'whatsapp',
            to: recipient,
            type: 'template',
            template: {
              name: template,
              language: { code: Env.get('WHATSAPP_TEMPLATE_LANGUAGE', 'en_US') },
              components: [{
                type: 'body',
                parameters: [
                  { type: 'text', text: data.referenceId },
                  { type: 'text', text: data.shopName },
                  { type: 'text', text: `${data.amount.toFixed(2)} ${data.currency}` },
                ],
              }],
            },
          }
        : {
            messaging_product: 'whatsapp',
            to: recipient,
            type: 'text',
            text: { body: `Payment confirmed for order ${data.referenceId} at ${data.shopName}. Total: ${data.amount.toFixed(2)} ${data.currency}.` },
          }

      await axios.post(`https://graph.facebook.com/${version}/${phoneNumberId}/messages`, body, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      })
      Logger.info(`[WhatsAppNotification] Order confirmation sent for ${data.referenceId}`)
    } catch (error: any) {
      Logger.warn(`[WhatsAppNotification] Failed for ${data.referenceId}: ${error?.response?.data?.error?.message || error.message}`)
    }
  }
}

export default new WhatsAppNotificationService()
