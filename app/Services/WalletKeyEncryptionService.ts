import crypto from 'crypto'
import Env from '@ioc:Adonis/Core/Env'

const ALGORITHM = 'aes-256-gcm'
const KEY_VERSION = 'v1'

class WalletKeyEncryptionService {
  private getKey(): Buffer {
    const appKey = Env.get('APP_KEY', '')
    if (!appKey || appKey.length < 16) {
      throw new Error('APP_KEY must be configured before custodial wallets can be provisioned')
    }
    return crypto.createHash('sha256').update(appKey).digest()
  }

  public encrypt(value: string): { encryptedValue: string; keyVersion: string } {
    const iv = crypto.randomBytes(12)
    const cipher = crypto.createCipheriv(ALGORITHM, this.getKey(), iv)
    const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
    const tag = cipher.getAuthTag()

    return {
      encryptedValue: [iv, tag, encrypted].map((part) => part.toString('base64')).join('.'),
      keyVersion: KEY_VERSION,
    }
  }

  public decrypt(value: string, keyVersion: string): string {
    if (keyVersion !== KEY_VERSION) throw new Error(`Unsupported wallet key version: ${keyVersion}`)
    const [ivEncoded, tagEncoded, encryptedEncoded] = value.split('.')
    if (!ivEncoded || !tagEncoded || !encryptedEncoded) throw new Error('Invalid encrypted wallet key')

    const decipher = crypto.createDecipheriv(ALGORITHM, this.getKey(), Buffer.from(ivEncoded, 'base64'))
    decipher.setAuthTag(Buffer.from(tagEncoded, 'base64'))
    return Buffer.concat([
      decipher.update(Buffer.from(encryptedEncoded, 'base64')),
      decipher.final(),
    ]).toString('utf8')
  }
}

export default new WalletKeyEncryptionService()