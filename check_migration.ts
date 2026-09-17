import '@adonisjs/core/services/app';
import Database from '@ioc:Adonis/Lucid/Database';

async function main() {
  const result = await Database.connection().rawQuery(
    "SELECT * FROM migrations WHERE name = ?",
    ['20260916000000_create_order_messages']
  );
  console.log(JSON.stringify(result.rows, null, 2));
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
