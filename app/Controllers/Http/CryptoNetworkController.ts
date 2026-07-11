import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import { schema } from '@ioc:Adonis/Core/Validator'
import CryptoNetwork from 'App/Models/CryptoNetwork'
import { formatErrorMessage, formatSuccessMessage } from 'App/helpers/utils'
import RolesController from './RolesController'

export default class CryptoNetworkController extends RolesController {
  public async index({ response }: HttpContextContract) {
    try {
      const networks = await CryptoNetwork.query()
      response.status(200).json({ error: false, message: 'Crypto networks fetched successfully', data: networks })
    } catch (error) {
      response.status(400).json(await formatErrorMessage(error))
    }
  }

  public async store({ request, response, auth }: HttpContextContract) {
    try {
      this.allowOnlySuperAdmins(auth)

      const networkSchema = schema.create({
        name: schema.string({ trim: true }),
        logo: schema.string.optional({ trim: true }),
        rpcUrl: schema.string({ trim: true }),
        isTestnet: schema.boolean(),
      })
      const data = await request.validate({ schema: networkSchema })
      const network = await CryptoNetwork.create({
        name: data.name,
        logo: data.logo,
        rpcUrl: data.rpcUrl,
        isTestnet: data.isTestnet,
      })
      response.status(200).json({ error: false, message: 'Crypto network created successfully', data: [network] })
    } catch (error) {
      response.status(400).json(await formatErrorMessage(error))
    }
  }

  public async update({ request, response, auth, params }: HttpContextContract) {
    try {
      this.allowOnlySuperAdmins(auth)

      const network = await CryptoNetwork.findOrFail(params.id)
      const updateSchema = schema.create({
        name: schema.string({ trim: true }),
        logo: schema.string.optional({ trim: true }),
        rpcUrl: schema.string({ trim: true }),
        isTestnet: schema.boolean(),
      })
      const data = await request.validate({ schema: updateSchema })
      network.merge(data)
      await network.save()
      response.status(200).json({ error: false, message: 'Crypto network updated successfully' })
    } catch (error) {
      response.status(400).json(await formatErrorMessage(error))
    }
  }

  public async destroy({ response, auth, params }: HttpContextContract) {
    try {
      this.allowOnlySuperAdmins(auth)

      const network = await CryptoNetwork.findOrFail(params.id)
      await network.delete()
      response.status(200).json({ error: false, message: 'Crypto network deleted successfully' })
    } catch (error) {
      response.status(400).json(await formatErrorMessage(error))
    }
  }
}
