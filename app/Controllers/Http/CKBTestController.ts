import { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import CKBService from 'App/Services/CKBService'

export default class CKBTestController {
  /**
   * GET /api/test/ckb/chain-info
   * Get CKB testnet chain info (tip block, node version)
   */
  public async chainInfo({ response }: HttpContextContract) {
    try {
      const info = await CKBService.getChainInfo()
      return response.ok({ success: true, data: info })
    } catch (error) {
      return response.internalServerError({
        success: false,
        message: 'Failed to fetch chain info',
        error: error.message,
      })
    }
  }

  /**
   * GET /api/test/ckb/generate-wallet
   * Generate a new CKB testnet wallet (private key + address)
   */
  public async generateWallet({ response }: HttpContextContract) {
    try {
      const wallet = CKBService.generateWallet()
      return response.ok({ success: true, data: wallet })
    } catch (error) {
      return response.internalServerError({
        success: false,
        message: 'Failed to generate wallet',
        error: error.message,
      })
    }
  }

  /**
   * GET /api/test/ckb/balance/:address
   * Get CKB balance for a testnet address
   */
  public async getBalance({ params, response }: HttpContextContract) {
    try {
      const balance = await CKBService.getBalance(params.address)
      return response.ok({ success: true, data: balance })
    } catch (error) {
      return response.internalServerError({
        success: false,
        message: 'Failed to fetch balance',
        error: error.message,
      })
    }
  }

  /**
   * GET /api/test/ckb/transaction/:txHash
   * Get CKB transaction details by hash
   */
  public async getTransaction({ params, response }: HttpContextContract) {
    try {
      const tx = await CKBService.getTransaction(params.txHash)
      return response.ok({ success: true, data: tx })
    } catch (error) {
      return response.internalServerError({
        success: false,
        message: 'Failed to fetch transaction',
        error: error.message,
      })
    }
  }

  /**
   * GET /api/test/ckb/block/:blockNumber
   * Get CKB block by number
   */
  public async getBlock({ params, response }: HttpContextContract) {
    try {
      const block = await CKBService.getBlock(params.blockNumber)
      return response.ok({ success: true, data: block })
    } catch (error) {
      return response.internalServerError({
        success: false,
        message: 'Failed to fetch block',
        error: error.message,
      })
    }
  }

  /**
   * POST /api/test/ckb/address-from-key
   * Derive a CKB testnet address from a given private key
   */
  public async addressFromKey({ request, response }: HttpContextContract) {
    try {
      const { privateKey } = request.only(['privateKey'])
      if (!privateKey) {
        return response.badRequest({ success: false, message: 'privateKey is required' })
      }
      const address = CKBService.generateAddress(privateKey)
      return response.ok({ success: true, data: { address } })
    } catch (error) {
      return response.internalServerError({
        success: false,
        message: 'Failed to derive address',
        error: error.message,
      })
    }
  }
}
