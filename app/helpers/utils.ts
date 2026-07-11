// import Env from '@ioc:Adonis/Core/Env'
import { v4 as uuidv4 } from 'uuid';
// import { ethers } from 'ethers';

export function genRandomUuid() {
  return String(uuidv4()).toLowerCase()
}

export function formatErrorMessage(error: any) {
  let data: string;
  let code: number;

  console.error(error)

  if (
    error &&
    Array.isArray(error.errors) &&
    error.errors[0]?.message &&
    error.errors[0].message.includes('E_UNAUTHORIZED_ACCESS')
  ) {
    return {
      error: true,
      data: 'Unauthorized access. Please sign in again.',
      details: error.errors[0].message,
      code: 401,
    }
  }

  if (error && error.code === 'E_VALIDATION_FAILURE') {
    return {
      error: true,
      message: 'Validation failed',
      errors: error.messages,
      code: 422,
    };
  } else if (error && error.code === 'E_INVALID_AUTH_UID') {
    data = 'Invalid email or password';
    code = 401;
  } else if (error && error.messages) {
    const errorMessage = error.messages.errors[0];
    data = `${errorMessage.message}`;
    code = 400;
  } else if (error && error.code === 'E_ROW_NOT_FOUND') {
    data = 'Resource not found!';
    code = 404;
  } else if (error && error.code === 'E_INVALID_AUTH_PASSWORD') {
    data = 'Password does not match!';
    code = 401;
  } else if (
    (error && error.code === 'E_UNAUTHORIZED_ACCESS') ||
    (typeof error === 'string' && error.includes('E_UNAUTHORIZED_ACCESS')) ||
    (error && typeof error.message === 'string' && error.message.includes('E_UNAUTHORIZED_ACCESS'))
  ) {
    data = 'Unauthorized access. Please sign in again.';
    code = 401;
  } else if (String(error)?.split('Error:')) {
    data = String(error)?.split('Error:')[1]
    code = 500
  } else {
    data = 'Unexpected error. Please, contact an Administrator.';
    code = 500;
  }

  console.error({
    code: error.code,
    data: data,
    message: error.message,
    stack: error.stack
  })

  return {
    error: true,
    data: data,
    details: error.message,
    code,
  };
}


export function formatSuccessMessage(message: string, result: any) {
  return {
    error: false,
    data: message,
    code: 200,
    result
  };
}

// export function getRpcUrl(network: supportedChains) {
//   let url;
//   if (!Env.get('BSC_RPC')) {
//     console.error('BSC_RPC environment variable is not set.');
//     return;
//   }
//   if (!Env.get('SEPOLIA_RPC')) {
//     console.error('SEPOLIA_RPC environment variable is not set.');
//     return;
//   }
//   if (!Env.get('ASSETCHAIN_TESTNET_RPC')) {
//     console.error('ASSETCHAIN_TESTNET_RPC environment variable is not set.');
//     return;
//   }
//   if (!Env.get('BASE_RPC')) {
//     console.error('BASE_RPC environment variable is not set.');
//     return;
//   }
//   if (!Env.get('BASE_SEPOLIA_RPC')) {
//     console.error('BASE_SEPOLIA_RPC environment variable is not set.');
//     return;
//   }
//   switch (network) {
//     case 'bsc':
//       url = Env.get('BSC_RPC');
//       break;
//     case 'sepolia':
//       url = Env.get('SEPOLIA_RPC');
//       break;
//     case 'assetchain_testnet':
//       url = Env.get('ASSETCHAIN_TESTNET_RPC');
//       break;
//     case 'local':
//       url = 'http://127.0.0.1:8545/';
//       break;
//     case 'base':
//       url = Env.get('BASE_RPC');
//       break;
//     case 'base_sepolia':
//       url = Env.get('BASE_SEPOLIA_RPC');
//       break;
//     default:
//       break;
//   }
//   return url;
// }

// export function getEthersProvider(network: supportedChains) {
//   let client;
//   switch (network) {
//     case 'bsc':
//       client = new ethers.providers.JsonRpcProvider(Env.get('BSC_RPC'));
//       break;
//     case 'sepolia':
//       client = new ethers.providers.JsonRpcProvider(Env.get('SEPOLIA_RPC'));
//       break;
//     case 'assetchain_testnet':
//       client = new ethers.providers.JsonRpcProvider(Env.get('ASSETCHAIN_TESTNET_RPC'));
//       break;
//     case 'local':
//       client = new ethers.providers.JsonRpcProvider('http://127.0.0.1:8545/');
//       break;
//     case 'base':
//       client = new ethers.providers.JsonRpcProvider(Env.get('BASE_RPC'));
//       break;
//     case 'base_sepolia':
//       client = new ethers.providers.JsonRpcProvider(Env.get('BASE_SEPOLIA_RPC'));
//       break;
//     default:
//       break;
//   }
//   return client;
// }


// export const contractAddress = {
//   bsc: {
//     FACTORY_CONTRACT_ADDRESS: '0xb017E4E9AFA12AcFE94366E50025AE31E0C2E5C6',
//     WALLET_CONTRACT_ADDRESS: '0xe7b02877ffccB798e4f3a427d1920437FA9E9E28',
//   },
//   sepolia: {
//     FACTORY_CONTRACT_ADDRESS: '0x028bA0F1A498AdCD86535053bd357899Bf9ADAb9',
//     WALLET_CONTRACT_ADDRESS: '0x5A110FF22233AD6AC6196948f72bEcE1f5196179',
//   },
//   assetchain_testnet: {
//     FACTORY_CONTRACT_ADDRESS: '0x381AFE71090cf71B75a886EA8833dfc9683c57b6',
//     WALLET_CONTRACT_ADDRESS: '0x43d77792b5992fE8c3e1F863e276c7826A806c9C',
//   },
//   base: {
//     FACTORY_CONTRACT_ADDRESS: '0x7A03EE0A68191b33c69fC60F2a481fA5CB490FFc',
//     WALLET_CONTRACT_ADDRESS: '0xb017E4E9AFA12AcFE94366E50025AE31E0C2E5C6',
//   },
//   base_sepolia: {
//     FACTORY_CONTRACT_ADDRESS: '0x5784fff973B28b151Be14D57B58Ff47c510Ad795',
//     WALLET_CONTRACT_ADDRESS: '0x728185cD95F9f540431ad5A65C2886b91e85D583',
//   }
// }

// export const isTestNetwork = (network) => {
//   return NETWORKS.TEST.includes(network);
// };

// export class CustomError extends Error {
//   code;
//   constructor(code, message) {
//     super(message);
//     this.code = code;
//   }
// }

export function roundToTwoDecimalPlace(number, decimalPlaces = 2) {
  if (isNaN(number) || isNaN(decimalPlaces)) {
    throw new Error("Both arguments must be numbers.");
  }
  const factor = Math.pow(10, decimalPlaces);
  return Math.round(number * factor) / factor;
}
