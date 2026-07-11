import BaseSeeder from '@ioc:Adonis/Lucid/Seeder'
import User from 'App/Models/User'
import BusinessSetting from 'App/Models/BusinessSetting'

export default class extends BaseSeeder {
  public async run() {
    let users = await User.query()
    if (users.length > 0) return;

    const user = await User.create(
      {
        "email": "tester1@gmail.com",
        "password": "123456789"
      }
    )

    await BusinessSetting.create({
      businessId: user.uniqueId,
    })
  }
}
