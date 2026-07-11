import BaseSeeder from '@ioc:Adonis/Lucid/Seeder'
import User from 'App/Models/User'

export default class extends BaseSeeder {
  public async run() {
    let users = await User.query()
    if (users.length > 0) return;

    await User.create(
      {
        "email": "tester1@gmail.com",
        "password": "123456789"
      }
    )
  }
}
