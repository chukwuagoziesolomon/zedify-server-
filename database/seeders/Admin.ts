import BaseSeeder from '@ioc:Adonis/Lucid/Seeder'
import Admin from 'App/Models/Admin'

export default class extends BaseSeeder {
  public async run() {
    let admin = await Admin.query()
    if (admin.length > 0) return;

    await Admin.create(
      {
        "type":"SUPER_ADMIN",
        "email":"admin@gmail.com",
        "password":"123456789"
    }
    )
  }
}
