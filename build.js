const { execSync } = require('child_process');

const projectType = process.env.PROJECT_TYPE || 'buyer';

try {
  if (projectType === 'seller') {
    console.log('--- VERCEL BUILD: SELLER PORTAL ---');
    execSync('npm run build --prefix seller-portal', { stdio: 'inherit' });
  } else {
    console.log('--- VERCEL BUILD: BUYER MARKET ---');
    execSync('npm run build --prefix buyer-market', { stdio: 'inherit' });
  }
} catch (error) {
  console.error('Build failed:', error);
  process.exit(1);
}
