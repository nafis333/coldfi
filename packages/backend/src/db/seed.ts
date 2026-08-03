import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { pool, query } from './pool';

const SALT_ROUNDS = 12;

interface SeedUser {
  id: string;
  email: string;
  password: string;
  displayName: string;
}

const TEST_USERS: SeedUser[] = [
  {
    id: uuidv4(),
    email: 'alice@test.com',
    password: 'password123',
    displayName: 'Alice Johnson',
  },
  {
    id: uuidv4(),
    email: 'bob@test.com',
    password: 'password123',
    displayName: 'Bob Smith',
  },
];

async function seedUsers(): Promise<Map<string, string>> {
  const userIdMap = new Map<string, string>();

  for (const user of TEST_USERS) {
    const passwordHash = await bcrypt.hash(user.password, SALT_ROUNDS);
    const authKeyHash = await bcrypt.hash(user.password, SALT_ROUNDS);
    const personalSalt = uuidv4();

    const result = await query(
      `INSERT INTO users (
        id, email, password_hash, auth_key_hash,
        personal_salt, personal_data_enc, personal_vc,
        display_name, default_currency, timezone
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (email) DO UPDATE SET
        display_name = EXCLUDED.display_name
      RETURNING id`,
      [
        user.id,
        user.email,
        passwordHash,
        authKeyHash,
        personalSalt,
        Buffer.from('encrypted-placeholder'),
        '[]',
        user.displayName,
        'USD',
        'America/New_York',
      ]
    );

    userIdMap.set(user.email, result.rows[0].id);
    console.log(`  ✓ User: ${user.email} (${result.rows[0].id})`);
  }

  return userIdMap;
}

async function seedGroups(userIdMap: Map<string, string>): Promise<void> {
  const aliceId = userIdMap.get('alice@test.com')!;
  const bobId = userIdMap.get('bob@test.com')!;

  const groupId = uuidv4();

  await query(
    `INSERT INTO groups (
      id, name, group_salt, passphrase_verifier,
      group_data_enc, group_vc, default_currency, created_by
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    ON CONFLICT (id) DO NOTHING`,
    [
      groupId,
      'Test Group',
      uuidv4(),
      'verifier-placeholder',
      Buffer.from('encrypted-placeholder'),
      '[]',
      'USD',
      aliceId,
    ]
  );

  await query(
    `INSERT INTO group_members (group_id, user_id, role, member_index, display_name, avatar_color)
     VALUES ($1, $2, 'admin', 0, 'Alice', '#FF6B6B')
     ON CONFLICT (group_id, user_id) DO NOTHING`,
    [groupId, aliceId]
  );

  await query(
    `INSERT INTO group_members (group_id, user_id, role, member_index, display_name, avatar_color)
     VALUES ($1, $2, 'member', 1, 'Bob', '#4ECDC4')
     ON CONFLICT (group_id, user_id) DO NOTHING`,
    [groupId, bobId]
  );

  console.log(`  ✓ Group: Test Group (${groupId})`);
  console.log(`    Members: alice@test.com (admin), bob@test.com (member)`);
}

async function seed(): Promise<void> {
  console.log('Starting database seed...\n');

  try {
    await query('SELECT 1');
    console.log('Database connected\n');

    console.log('Seeding users...');
    const userIdMap = await seedUsers();

    console.log('\nSeeding groups...');
    await seedGroups(userIdMap);

    console.log('\n✅ Seed completed successfully!');
  } catch (err) {
    console.error('\n❌ Seed failed:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

seed();
