import BaseSeeder from '@ioc:Adonis/Lucid/Seeder'
import SystemSetting from 'App/Models/SystemSetting'

export default class SystemSettingSeeder extends BaseSeeder {
  public async run () {
    const settings = await SystemSetting.query()
    if (settings.length > 0) return;

    // if (settings.length === 0) {
      await SystemSetting.create({
        durationPerTransaction: 3600 // 1 hour in seconds
      })
    // }
  }
}
