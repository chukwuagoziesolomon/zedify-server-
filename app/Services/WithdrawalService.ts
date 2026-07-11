import { ethers } from 'ethers'
import Logger from '@ioc:Adonis/Core/Logger'
import Database from '@ioc:Adonis/Lucid/Database'
import { DateTime } from 'luxon'
import { v4 as uuid } from 'uuid'
import User from 'App/Models/User'
import UserWallet from 'App/Models/UserWallet'
import Currency from 'App/Models/Currency'
import CryptoNetwork from 'App/Models/CryptoNetwork'
import { NotificationService } from 'App/Lib/notification/notification'
import SseService from './SseService'
import ConversionService from './ConversionService'
import Env from '@ioc:Adonis/Core/Env'

// Minimal ERC-20 ABI for sending tokens
const ERC20_ABI = [
  'function transfer(address to, uint256 amount) returns (bool)',
  'function decimals() view returns (uint8)',
]

export interface CryptoWithdrawalPayload {
  type: 'crypto'
  userWalletId: string       // UserWallet.uniqueId
  cryptoCurrencyId: string   // Currency.uniqueId
  networkId: string          // CryptoNetwork.uniqueId
  amount: number             // amount in token units (e.g. 20 USDT)
  recipientAddress: string
}

export interface FiatWithdrawalPayload {
  type: 'fiat'
  userWalletId: string
  amount: number             // amount in USDT
  bankName: string
  accountNumber: string
  bankCode: string
  accountName: string
}

export type WithdrawalPayload = CryptoWithdrawalPayload | FiatWithdrawalPayload

export interface WithdrawalFees {
  amount: number
  transactionFee: number
  estimatedNetworkFee: number
  amountToReceive: number      // in USDT (deducted from wallet)
  asset: string
  estimatedArrivalMinutes: number
  // Fiat-only fields — populated when type='fiat'
  exchangeRate?: number         // 1 USDT = X NGN
  nairaAmountToReceive?: number // NGN the bank account will receive
  fiatCurrency?: string
}

const TRANSACTION_FEE_RATE = 0.05   // 5% platform fee
const FIAT_TRANSACTION_FEE_RATE = 0.01

class WithdrawalServiceClass {
  private notifier = new NotificationService()
  private readonly OWNER_PRIVATE_KEY = Env.get('OWNER_EVM_PRIVATE_KEY', '')

  // ─── Fee calculation ────────────────────────────────────────────────────────

  public calculateFees(amount: number, type: 'crypto' | 'fiat'): WithdrawalFees {
    if (type === 'crypto') {
      const transactionFee = parseFloat((amount * TRANSACTION_FEE_RATE).toFixed(6))
      const estimatedNetworkFee = 0 // subsidised by platform; charged separately on-chain
      const amountToReceive = parseFloat((amount - transactionFee - estimatedNetworkFee).toFixed(6))
      return { amount, transactionFee, estimatedNetworkFee, amountToReceive, asset: 'USDT', estimatedArrivalMinutes: 1 }
    } else {
      const transactionFee = parseFloat((amount * FIAT_TRANSACTION_FEE_RATE).toFixed(6))
      const estimatedNetworkFee = 0
      const amountToReceive = parseFloat((amount - transactionFee).toFixed(6))
      // NGN conversion is async — call calculateFiatFees() for the full breakdown
      return { amount, transactionFee, estimatedNetworkFee, amountToReceive, asset: 'USDT', estimatedArrivalMinutes: 1440 }
    }
  }

  /** Async version for fiat — includes live NGN conversion */
  public async calculateFiatFees(amount: number): Promise<WithdrawalFees> {
    const transactionFee = parseFloat((amount * FIAT_TRANSACTION_FEE_RATE).toFixed(6))
    const amountToReceive = parseFloat((amount - transactionFee).toFixed(6))

    const conversion = await ConversionService.convertUsdtToNaira(amountToReceive)

    return {
      amount,
      transactionFee,
      estimatedNetworkFee: 0,
      amountToReceive,
      asset: 'USDT',
      estimatedArrivalMinutes: 1440,
      exchangeRate: parseFloat(conversion.exchangeRate.toFixed(2)),
      nairaAmountToReceive: parseFloat(conversion.toAmount.toFixed(2)),
      fiatCurrency: 'NGN',
    }
  }

  // ─── OTP generation & email ─────────────────────────────────────────────────

  public async sendWithdrawalOtp(
    userId: string,
    payload: WithdrawalPayload
  ): Promise<{ otpId: string }> {
    const user = await User.query().where('uniqueId', userId).firstOrFail()

    // Validate wallet balance first
    const userWallet = await UserWallet.query()
      .where('uniqueId', payload.userWalletId)
      .where('status', 'active')
      .firstOrFail()

    if (Number(userWallet.balance) < payload.amount) {
      throw new Error(`Insufficient balance. Available: ${userWallet.balance}`)
    }

    const fees = this.calculateFees(payload.amount, payload.type)

    // Generate 6-digit OTP
    const otpCode = String(Math.floor(100000 + Math.random() * 900000))
    const otpId = uuid()
    const expiresAt = DateTime.now().plus({ minutes: 10 })

    // Persist OTP
    await Database.table('withdrawal_otps').insert({
      unique_id: otpId,
      user_id: userId,
      otp_code: otpCode,
      withdrawal_type: payload.type,
      withdrawal_payload: JSON.stringify(payload),
      used: false,
      expires_at: expiresAt.toSQL(),
      created_at: DateTime.now().toSQL(),
    })

    // Build email context
    let emailCtx: Record<string, any> = {
      businessName: user.businessName || user.email,
      otpCode,
      withdrawalType: payload.type === 'crypto' ? 'Crypto Withdrawal' : 'Fiat Withdrawal',
      amount: payload.amount,
      asset: 'USDT',
      year: new Date().getFullYear(),
    }

    if (payload.type === 'fiat') {
      const fiatFees = await this.calculateFiatFees(payload.amount)
      emailCtx.fee = fiatFees.transactionFee
      emailCtx.amountToReceive = `${fiatFees.amountToReceive} USDT (≈ ₦${fiatFees.nairaAmountToReceive?.toLocaleString()})`
      const fp = payload as FiatWithdrawalPayload
      emailCtx.bankName = fp.bankName
      emailCtx.accountNumber = fp.accountNumber
    } else {
      const cryptoFees = this.calculateFees(payload.amount, 'crypto')
      emailCtx.fee = cryptoFees.transactionFee
      emailCtx.amountToReceive = cryptoFees.amountToReceive
      const network = await CryptoNetwork.query().where('uniqueId', (payload as CryptoWithdrawalPayload).networkId).first()
      emailCtx.recipientAddress = (payload as CryptoWithdrawalPayload).recipientAddress
      emailCtx.networkName = network?.name || ''
    }

    await this.notifier.sendEmail({
      to: user.email,
      subject: 'Withdrawal OTP – Confirm Your Withdrawal',
      template: 'withdrawal_otp',
      replacements: emailCtx,
    })

    Logger.info(`[Withdrawal] OTP sent to ${user.email} for userId=${userId}`)
    return { otpId }
  }

  // ─── OTP confirmation & processing ─────────────────────────────────────────

  public async confirmWithdrawal(
    userId: string,
    otpId: string,
    otpCode: string
  ): Promise<{ txHash?: string; status: string; message: string }> {
    const row = await Database.from('withdrawal_otps')
      .where('unique_id', otpId)
      .where('user_id', userId)
      .first()

    if (!row) throw new Error('OTP not found.')
    if (row.used) throw new Error('This OTP has already been used.')
    if (DateTime.fromJSDate(new Date(row.expires_at)) < DateTime.now()) {
      throw new Error('OTP has expired. Please request a new withdrawal.')
    }
    if (row.otp_code !== otpCode) throw new Error('Invalid OTP code.')

    // Mark used immediately to prevent replay
    await Database.from('withdrawal_otps').where('unique_id', otpId).update({ used: true })

    const payload: WithdrawalPayload = JSON.parse(row.withdrawal_payload)

    if (payload.type === 'crypto') {
      return this.processCryptoWithdrawal(userId, payload as CryptoWithdrawalPayload)
    } else {
      return this.processFiatWithdrawal(userId, payload as FiatWithdrawalPayload)
    }
  }

  // ─── Crypto send ────────────────────────────────────────────────────────────

  private async processCryptoWithdrawal(
    userId: string,
    payload: CryptoWithdrawalPayload
  ): Promise<{ txHash: string; status: string; message: string }> {
    const userWallet = await UserWallet.query()
      .where('uniqueId', payload.userWalletId)
      .where('status', 'active')
      .firstOrFail()

    const fees = this.calculateFees(payload.amount, 'crypto')

    if (Number(userWallet.balance) < payload.amount) {
      throw new Error('Insufficient balance.')
    }

    const network = await CryptoNetwork.query()
      .where('uniqueId', payload.networkId)
      .firstOrFail()

    const currency = await Currency.query()
      .where('uniqueId', payload.cryptoCurrencyId)
      .firstOrFail()

    const provider = new ethers.JsonRpcProvider(network.rpcUrl)
    const signer = new ethers.Wallet(this.OWNER_PRIVATE_KEY, provider)

    let txHash: string

    if (currency.contractAddress) {
      // ERC-20 send
      const contract = new ethers.Contract(currency.contractAddress, ERC20_ABI, signer)
      const decimals: number = await contract.decimals()
      const amountRaw = ethers.parseUnits(String(fees.amountToReceive), decimals)
      const tx = await contract.transfer(payload.recipientAddress, amountRaw)
      await tx.wait()
      txHash = tx.hash
    } else {
      // Native token send
      const amountRaw = ethers.parseEther(String(fees.amountToReceive))
      const tx = await signer.sendTransaction({
        to: payload.recipientAddress,
        value: amountRaw,
      })
      await tx.wait()
      txHash = tx.hash
    }

    // Deduct from UserWallet balance
    userWallet.balance = parseFloat((Number(userWallet.balance) - payload.amount).toFixed(6))
    userWallet.totalWithdrawn = parseFloat((Number(userWallet.totalWithdrawn) + payload.amount).toFixed(6))
    await userWallet.save()

    // Push SSE — balance updates immediately on client
    SseService.emit(userId, {
      event: 'withdrawal.updated',
      data: {
        type: 'crypto',
        status: 'completed',
        amount: fees.amountToReceive,
        tx_hash: txHash,
        recipient: payload.recipientAddress,
      },
    })

    SseService.emit(userId, {
      event: 'wallet.balance_updated',
      data: {
        wallet_id: userWallet.uniqueId,
        balance: Number(userWallet.balance),
      },
    })

    // Send withdrawal success email
    try {
      const user = await User.query().where('uniqueId', userId).firstOrFail()
      const now = DateTime.now().toFormat('dd MMM yyyy, HH:mm')
      await this.notifier.sendEmail({
        to: user.email,
        subject: 'Withdrawal Successful – Funds Sent',
        template: 'withdrawal_success',
        replacements: {
          businessName: user.businessName || user.email,
          status: 'Completed',
          withdrawalType: 'Crypto Withdrawal',
          amount: payload.amount,
          fee: fees.transactionFee,
          amountToReceive: fees.amountToReceive,
          isCrypto: true,
          isFiat: false,
          networkName: network.name,
          recipientAddress: payload.recipientAddress,
          txHash,
          completedAt: now,
          year: new Date().getFullYear(),
        },
      })
    } catch (emailErr: any) {
      Logger.warn(`[Withdrawal] Success email failed: ${emailErr.message}`)
    }

    Logger.info(`[Withdrawal] Crypto sent: ${fees.amountToReceive} → ${payload.recipientAddress} tx=${txHash}`)
    return { txHash, status: 'completed', message: 'Withdrawal processed successfully.' }
  }

  // ─── Fiat bank transfer ─────────────────────────────────────────────────────

  private async processFiatWithdrawal(
    userId: string,
    payload: FiatWithdrawalPayload
  ): Promise<{ status: string; message: string }> {
    const userWallet = await UserWallet.query()
      .where('uniqueId', payload.userWalletId)
      .where('status', 'active')
      .firstOrFail()

    if (Number(userWallet.balance) < payload.amount) {
      throw new Error('Insufficient balance.')
    }

    // 1. Calculate fees and convert USDT → NGN at current live rate
    const fees = await this.calculateFiatFees(payload.amount)
    const nairaAmount = fees.nairaAmountToReceive!

    Logger.info(
      `[Withdrawal] Fiat: ${payload.amount} USDT → ${nairaAmount} NGN @ rate ${fees.exchangeRate}`
    )

    // 2. Deduct USDT balance immediately (funds held)
    userWallet.balance = parseFloat((Number(userWallet.balance) - payload.amount).toFixed(6))
    userWallet.totalWithdrawn = parseFloat((Number(userWallet.totalWithdrawn) + payload.amount).toFixed(6))
    await userWallet.save()

    // 3. Send NGN to bank via PayoutService (Paystack)
    const PayoutService = (await import('./PayoutService')).default
    await PayoutService.payoutToBank({
      transferId: uuid(),
      nairaAmount,
      recipient: {
        type: 'bank_account',
        bankAccount: {
          accountNumber: payload.accountNumber,
          bankCode: payload.bankCode,
          accountName: payload.accountName,
        },
      },
    })

    // 4. Push SSE updates — balance updates immediately on client
    SseService.emit(userId, {
      event: 'withdrawal.updated',
      data: {
        type: 'fiat',
        status: 'processing',
        usdt_deducted: payload.amount,
        naira_sent: nairaAmount,
        exchange_rate: fees.exchangeRate,
        bank: payload.bankName,
        account: payload.accountNumber,
      },
    })

    SseService.emit(userId, {
      event: 'wallet.balance_updated',
      data: { wallet_id: userWallet.uniqueId, balance: Number(userWallet.balance) },
    })

    // 5. Send withdrawal success email
    try {
      const user = await User.query().where('uniqueId', userId).firstOrFail()
      const now = DateTime.now().toFormat('dd MMM yyyy, HH:mm')
      await this.notifier.sendEmail({
        to: user.email,
        subject: 'Withdrawal Successful – Funds Submitted to Bank',
        template: 'withdrawal_success',
        replacements: {
          businessName: user.businessName || user.email,
          status: 'Processing',
          withdrawalType: 'Fiat Withdrawal',
          amount: payload.amount,
          fee: fees.transactionFee,
          amountToReceive: fees.amountToReceive,
          isCrypto: false,
          isFiat: true,
          nairaAmountToReceive: nairaAmount.toLocaleString(),
          exchangeRate: fees.exchangeRate,
          bankName: payload.bankName,
          accountNumber: payload.accountNumber,
          accountName: payload.accountName,
          completedAt: now,
          year: new Date().getFullYear(),
        },
      })
    } catch (emailErr: any) {
      Logger.warn(`[Withdrawal] Success email failed: ${emailErr.message}`)
    }

    return {
      status: 'processing',
      message: `Fiat withdrawal submitted. ₦${nairaAmount.toLocaleString()} will arrive within 24 hours.`,
    }
  }
}

export default new WithdrawalServiceClass()
