// Seed script for creating demo users

// Define your users here - you can add as many as needed
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
  // ADD YOUR USERS HERE! Just give me emails and I'll add them
  // Example:
  // {
  //   email: 'john.smith@company.com',
  //   name: 'John Smith',
  //   password: 'temp123', // They can change this after first login
  //   role: 'supervisor', // or 'agent'
  // },
];

async function seedUsers() {
  console.log('🌱 Seeding users with Better Auth...\n');
  
  for (const user of users) {
    try {
      console.log(`Creating user: ${user.email}`);
      
      // Create user using Better Auth's signup endpoint
      const result = await fetch('http://localhost:3003/api/auth/sign-up/email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: user.email,
          password: user.password,
          name: user.name,
          data: {
            role: user.role,
          },
        }),
      });
      
      if (result.ok) {
        console.log(`✅ Created: ${user.email} (${user.role})`);
        console.log(`   Password: ${user.password}`);
      } else {
        const error = await result.text();
        if (error.includes('already exists')) {
          console.log(`⚠️  User already exists: ${user.email}`);
        } else {
          console.log(`❌ Failed to create ${user.email}: ${error}`);
        }
      }
    } catch (error) {
      console.log(`❌ Error creating ${user.email}:`, error);
    }
  }
  
  console.log('\n✨ User seeding complete!');
  console.log('\nUsers can now log in at: http://localhost:3003/login');
  console.log('\nDefault passwords can be changed after first login.');
  
  process.exit(0);
}

// Check if dev server is running
fetch('http://localhost:3003/api/auth')
  .then(() => {
    seedUsers();
  })
  .catch(() => {
    console.error('❌ Error: Dev server is not running!');
    console.error('Please run "npm run dev" first, then run this script again.');
    process.exit(1);
  });