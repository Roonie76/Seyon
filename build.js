const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const projectType = process.env.PROJECT_TYPE || 'buyer';
const subfolder = projectType === 'seller' ? 'seller-portal' : 'buyer-market';

try {
  console.log(`--- VERCEL BUILD START: ${projectType.toUpperCase()} (${subfolder}) ---`);

  // 1. Run the build in the subfolder
  execSync(`npm run build --prefix ${subfolder}`, { stdio: 'inherit' });

  console.log('--- COPYING BUILD OUTPUTS TO ROOT ---');

  // 2. Clear root .next if it exists
  const rootNext = path.join(__dirname, '.next');
  if (fs.existsSync(rootNext)) {
    console.log('Cleaning existing root .next...');
    fs.rmSync(rootNext, { recursive: true, force: true });
  }

  // 3. Copy subfolder/.next to root .next
  const subfolderNext = path.join(__dirname, subfolder, '.next');
  console.log(`Copying ${subfolderNext} to ${rootNext}...`);
  fs.cpSync(subfolderNext, rootNext, { recursive: true });

  // 4. Copy subfolder/public to root public
  const rootPublic = path.join(__dirname, 'public');
  const subfolderPublic = path.join(__dirname, subfolder, 'public');
  if (fs.existsSync(subfolderPublic)) {
    console.log(`Copying ${subfolderPublic} to ${rootPublic}...`);
    fs.cpSync(subfolderPublic, rootPublic, { recursive: true });
  }

  console.log('--- VERCEL BUILD COMPLETED SUCCESSFULLY ---');
} catch (error) {
  console.error('Build router failed:', error);
  process.exit(1);
}
