#\!/bin/bash

echo "Updating ShipStation credentials in Vercel..."

# Remove existing ShipStation variables
vercel env rm SHIPSTATION_API_KEY production --yes 2>/dev/null
vercel env rm SHIPSTATION_API_SECRET production --yes 2>/dev/null

# Add them back with correct values from .env.local
echo "de8a69f616f44d6487097bf4e5ab46f2" | vercel env add SHIPSTATION_API_KEY production
echo "0f4f5e5cc9bd4ea39dac6ff447914664" | vercel env add SHIPSTATION_API_SECRET production

echo "Redeploying..."
vercel --prod --yes

echo "Done\! Check https://order-management-kappa-seven.vercel.app"
