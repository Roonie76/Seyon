const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const projectType = process.env.PROJECT_TYPE || 'buyer';
const subfolder = projectType === 'seller' ? 'seller-portal' : 'buyer-market';

function patchDirectory(dir, subfolder) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      patchDirectory(filePath, subfolder);
    } else {
      const ext = path.extname(file).toLowerCase();
      if (['.json', '.js', '.map', '.html', '.txt', '.webmanifest'].includes(ext)) {
        let content = fs.readFileSync(filePath, 'utf8');
        let changed = false;
        
        const targets = [
          subfolder + '//',
          subfolder + '/',
          subfolder + '\\\\',
          subfolder + '\\'
        ];
        
        for (const target of targets) {
          if (content.includes(target)) {
            content = content.split(target).join('');
            changed = true;
          }
        }
        
        if (file === 'required-server-files.json') {
          try {
            const json = JSON.parse(content);
            if (json.appDir && json.appDir.endsWith(subfolder)) {
              json.appDir = json.appDir.slice(0, -subfolder.length).replace(/[\\/]+$/, '');
              json.relativeAppDir = '';
              content = JSON.stringify(json, null, 2);
              changed = true;
            }
          } catch (e) {
            console.error('Failed to parse required-server-files.json', e);
          }
        }
        
        if (changed) {
          fs.writeFileSync(filePath, content, 'utf8');
        }
      }
    }
  }
}

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

  // 5. Patch build assets to point to root appDir and node_modules
  if (fs.existsSync(rootNext)) {
    console.log('--- PATCHING BUILD MANIFESTS AND CONFIGS FOR VERCEL ---');
    patchDirectory(rootNext, subfolder);
    console.log('Successfully patched build assets for root compatibility');
  }

  console.log('--- VERCEL BUILD COMPLETED SUCCESSFULLY ---');
} catch (error) {
  console.error('Build router failed:', error);
  process.exit(1);
}


