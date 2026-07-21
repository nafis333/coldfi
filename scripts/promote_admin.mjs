import pg from 'pg';
const { Client } = pg;

const client = new Client({ connectionString: 'postgresql://postgres.dlqgaxsuvmqoyazqhyqo:coldfisupabase@aws-1-ap-southeast-2.pooler.supabase.com:5432/postgres' });

try {
  await client.connect();
  
  const existing = await client.query(`SELECT id, email, role FROM users WHERE email = 'coldwolfpack@gmail.com'`);
  console.log('Existing owner:', existing.rows[0]);
  
  const update = await client.query(`UPDATE users SET role = 'owner' WHERE email = 'testuser@example.com' RETURNING id, email, role`);
  console.log('Promoted:', update.rows[0]);
  
  await client.end();
} catch (err) {
  console.error('Error:', err.message);
}
