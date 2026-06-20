import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env.local explicitly
// We go up one level from 'api' folder to root
console.log('🔄 Loading environment variables...');
dotenv.config({ path: join(__dirname, '..', '.env.local') });

// Verify immediately
if (process.env.TURSO_DATABASE_URL) {
  console.log('✅ Environment variables loaded successfully');
} else {
  console.log('⚠️  Warning: TURSO_DATABASE_URL not found in environment');
}
