import { db } from '../lib/db';
import { user } from '../lib/db/schema/auth';
import bcrypt from 'bcryptjs';

const users = [
  {
    email: 'supervisor@demo.com',
    name: 'Demo Supervisor',
    password: 'demo123',
    role: 'supervisor',
  },
  {
    email: 'agent@demo.com',
    name: 'Demo Agent',
    password: 'demo123',
    role: 'agent',
  },
];

async function seedUsers() {
  console.log('🌱 Seeding users directly into database...\n');
  
  for (const userData of users) {
    try {
      console.log(`Creating user: ${userData.email}`);
      
      // Hash the password
      const hashedPassword = await bcrypt.hash(userData.password, 10);
      
      // Insert user into database
      await db.insert(user).values({
        id: crypto.randomUUID(),
        email: userData.email,
        name: userData.name,
        emailVerified: true,
        role: userData.role,
        createdAt: new Date(),
        updatedAt: new Date(),
      }).onConflictDoNothing();
      
      console.log(`✅ Created: ${userData.email} (${userData.role})`);
      console.log(`   Password: ${userData.password}`);
    } catch (error: any) {
      if (error?.message?.includes('duplicate') || error?.message?.includes('unique')) {
        console.log(`⚠️  User already exists: ${userData.email}`);
      } else {
        console.log(`❌ Error creating ${userData.email}:`, error);
      }
    }
  }
  
  console.log('\n✨ User seeding complete!');
  console.log('\nDemo accounts:');
  console.log('Supervisor: supervisor@demo.com / demo123');
  console.log('Warehouse Agent: agent@demo.com / demo123');
  
  process.exit(0);
}

seedUsers();