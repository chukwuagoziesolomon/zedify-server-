/*
|--------------------------------------------------------------------------
| Validating Environment Variables
|--------------------------------------------------------------------------
|
| In this file we define the rules for validating environment variables.
| By performing validation we ensure that your application is running in
| a stable environment with correct configuration values.
|
| This file is read automatically by the framework during the boot lifecycle
| and hence do not rename or move this file to a different location.
|
*/

import Env from '@ioc:Adonis/Core/Env'

export default Env.rules({
	HOST: Env.schema.string({ format: 'host' }),
	PORT: Env.schema.number(),
	APP_KEY: Env.schema.string(),
	APP_NAME: Env.schema.string(),
	DRIVE_DISK: Env.schema.enum(['local'] as const),
	NODE_ENV: Env.schema.enum(['development', 'production', 'test'] as const),

	// ## Variables for the PostgreSQL driver

	PG_HOST: Env.schema.string({ format: 'host' }),
	PG_PORT: Env.schema.number(),
	PG_USER: Env.schema.string(),
	PG_PASSWORD: Env.schema.string.optional(),
	PG_DB_NAME: Env.schema.string(),

	EMAIL_HOST: Env.schema.string(),
	EMAIL_PORT: Env.schema.string(),
	EMAIL_USER: Env.schema.string(),
	EMAIL_PASS: Env.schema.string(),

	JWT_KEY: Env.schema.string(),

	// -------------------------------------------------------------------------
	// EVM wallet deployment
	// -------------------------------------------------------------------------
	/** Private key of the deployer/owner account used by contract-wallet-sdk */
	OWNER_EVM_PRIVATE_KEY: Env.schema.string(),
	/** Master wallet address that receives flushed funds from child wallets */
	MASTER_EVM_ADDRESS: Env.schema.string(),

	// -------------------------------------------------------------------------
	// Webhook security
	// -------------------------------------------------------------------------
	/** HMAC-SHA256 secret for signing / verifying webhook payloads */
	WEBHOOK_SECRET: Env.schema.string(),

	// -------------------------------------------------------------------------
	// Application environment (controls live vs test webhook URLs)
	// -------------------------------------------------------------------------
	APP_ENV: Env.schema.enum(['development', 'staging', 'production'] as const),

	// -------------------------------------------------------------------------
	// EVM RPC endpoints (all optional — seeders fall back to public nodes)
	// -------------------------------------------------------------------------
	BSC_RPC: Env.schema.string.optional(),
	BASE_RPC: Env.schema.string.optional(),
	POLYGON_RPC: Env.schema.string.optional(),
	OPTIMISM_RPC: Env.schema.string.optional(),
	ARBITRUM_RPC: Env.schema.string.optional(),
	ETHEREUM_RPC: Env.schema.string.optional(),
	SEPOLIA_RPC: Env.schema.string.optional(),
	BASE_SEPOLIA_RPC: Env.schema.string.optional(),
	POLYGON_MUMBAI_RPC: Env.schema.string.optional(),
	ASSETCHAIN_TESTNET_RPC: Env.schema.string.optional(),
	CKB_TESTNET_RPC: Env.schema.string.optional(),

	// -------------------------------------------------------------------------
	// Fiber Network (CKB payment channels)
	// -------------------------------------------------------------------------
	FIBER_NODE_URL: Env.schema.string.optional(),
	FIBER_BISCUIT_TOKEN: Env.schema.string.optional(),
	FIBER_NETWORK: Env.schema.string.optional(),

	CLIENT_URL: Env.schema.string.optional(),

	// -------------------------------------------------------------------------
	// AI Shop Builder (Anthropic)
	// -------------------------------------------------------------------------
	ANTHROPIC_API_KEY: Env.schema.string(),
	ANTHROPIC_MODEL: Env.schema.string(),
	// Optional — when not set the API host itself is used as the shop base domain
	SHOP_BASE_DOMAIN: Env.schema.string.optional(),
})
