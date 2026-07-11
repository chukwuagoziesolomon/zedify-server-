import Route from '@ioc:Adonis/Core/Route'

Route.group(() => {
  Route.get('/chain-info', 'CKBTestController.chainInfo')
  Route.get('/generate-wallet', 'CKBTestController.generateWallet')
  Route.get('/balance/:address', 'CKBTestController.getBalance')
  Route.get('/transaction/:txHash', 'CKBTestController.getTransaction')
  Route.get('/block/:blockNumber', 'CKBTestController.getBlock')
  Route.post('/address-from-key', 'CKBTestController.addressFromKey')
}).prefix('/api/test/ckb')
