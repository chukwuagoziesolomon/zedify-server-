const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://neondb_owner:npg_9p2dPLmuwBVo@ep-still-glitter-ap209l7u-pooler.c-7.us-east-1.aws.neon.tech/neondb?channel_binding=require&sslmode=require' });
client.connect().then(async () => {
  const res = await client.query("SELECT column_name, data_type, udt_name FROM information_schema.columns WHERE table_name = 'transactions' ORDER BY ordinal_position");
  console.table(res.rows);
  await client.end();
}).catch(console.error);
