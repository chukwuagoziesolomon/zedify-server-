import { schema, CustomMessages } from '@ioc:Adonis/Core/Validator'

export class PaymentWebhookSchema {
  /**
   * Validate webhook payload
   * Supports flexible format from various webhook providers
   */
  public static async validate(data: any) {
    const payloadSchema = schema.create({
      // Transaction details
      transactionHash: schema.string.optional({}, []),
      hash: schema.string.optional({}, []),
      txHash: schema.string.optional({}, []),

      // Wallet address
      walletAddress: schema.string.optional({}, []),
      to: schema.string.optional({}, []),

      // Amount
      cryptoAmount: schema.number.optional(),
      value: schema.string.optional(),

      // Block details
      blockNumber: schema.number.optional(),
      block_number: schema.string.optional(),
      blockNum: schema.string.optional(),

      // Chain
      chainId: schema.number.optional(),

      // From address
      from: schema.string.optional(),

      // Timestamp
      timestamp: schema.number.optional(),

      // Webhook metadata
      webhookId: schema.string.optional(),
      source: schema.string.optional(),
      signature: schema.string.optional(),

      // Alchemy format
      event: schema.object.optional().members({
        activity: schema.array.optional().members(
          schema.object().members({
            hash: schema.string(),
            from: schema.string(),
            to: schema.string(),
            value: schema.string.optional(),
            blockNum: schema.string(),
          })
        ),
        chainId: schema.number.optional(),
      }),

      // Tenderly format
      result: schema.object.optional().members({
        hash: schema.string(),
        from: schema.string(),
        to: schema.string(),
        value: schema.string.optional(),
        block_number: schema.string(),
        chainId: schema.number.optional(),
      }),
    })

    const messages: CustomMessages = {
      'transactionHash.string': 'Transaction hash must be a string',
      'walletAddress.string': 'Wallet address must be a string',
      'cryptoAmount.number': 'Crypto amount must be a number',
      'blockNumber.number': 'Block number must be a number',
      'chainId.number': 'Chain ID must be a number',
    }

    return await payloadSchema.validate(data, messages)
  }
}
