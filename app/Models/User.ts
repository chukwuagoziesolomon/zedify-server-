import { DateTime } from 'luxon'
import Hash from '@ioc:Adonis/Core/Hash'
import { BaseModel, beforeSave, column, } from '@ioc:Adonis/Lucid/Orm'
import { genRandomUuid } from '../helpers/utils'

export default class User extends BaseModel {
  @column({ isPrimary: true })
  public id: number

  @column()
  public uniqueId: string = genRandomUuid()

  @column()
  public firstName: string

  @column()
  public lastName: string

  @column()
  public businessName: string

  @column()
  public country: string

  @column()
  public email: string

  @column()
  public password: string

  @column()
  public isBlocked: boolean

  @column()
  public isDeleted: boolean

  @column()
  public phone: string

  @column.dateTime({ autoCreate: true })
  public createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  public updatedAt: DateTime

  @beforeSave()
  public static async hashPassword(user: User) {
    if (user.$dirty.password) {
      user.password = await Hash.make(user.password)
    }
  }

}
