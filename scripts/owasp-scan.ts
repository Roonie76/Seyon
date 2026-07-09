import fs from 'fs';
import path from 'path';

interface ScanFinding {
  owaspCategory: string;
  file: string;
  line: number;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  description: string;
  snippet: string;
}

const findings: ScanFinding[] = [];

// Recursive file scanner
function scanDirectory(dir: string, extensions: string[], fileCallback: (filePath: string) => void) {
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      if (file !== 'node_modules' && file !== '.next' && file !== '.git') {
        scanDirectory(fullPath, extensions, fileCallback);
      }
    } else {
      const ext = path.extname(file);
      if (extensions.includes(ext)) {
        fileCallback(fullPath);
      }
    }
  }
}

// Scans individual files for security patterns
function auditFile(filePath: string) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const relativePath = path.relative(process.cwd(), filePath).replace(/\\/g, '/');

  lines.forEach((lineText, idx) => {
    const lineNum = idx + 1;
    const trimmed = lineText.trim();

    // Skip line if it has an inline suppression comment
    if (trimmed.includes('owasp-scan-ignore')) {
      return;
    }

    // 1. A03:2021-Injection (Prisma Raw SQL Injection checks)
    if (trimmed.includes('$queryRawUnsafe') || trimmed.includes('$executeRawUnsafe')) {
      findings.push({
        owaspCategory: 'A03:2021-Injection',
        file: relativePath,
        line: lineNum,
        severity: 'CRITICAL',
        description: 'Use of raw SQL query string execution. Ensure query arguments are fully sanitized or parameterized.',
        snippet: trimmed,
      });
    }

    // String interpolation inside raw query
    if (trimmed.includes('$queryRaw') && trimmed.includes('${') && !trimmed.includes('`')) {
      findings.push({
        owaspCategory: 'A03:2021-Injection',
        file: relativePath,
        line: lineNum,
        severity: 'HIGH',
        description: 'Possible string interpolation inside raw database query. Ensure tagged templates are used directly.',
        snippet: trimmed,
      });
    }

    // 2. A01:2021-Broken Access Control (Unchecked Server Actions or DB calls)
    if (filePath.includes('src/backend/actions') && trimmed.startsWith('export async function')) {
      const actionName = trimmed.replace('export async function ', '').split('(')[0].trim();
      const isMutator = /create|update|delete|verify|remove|onboard|quickAdd/i.test(actionName);
      
      let hasAuthCheck = false;
      let hasOwnershipVerify = false;
      
      for (let i = idx; i < Math.min(idx + 25, lines.length); i++) {
        const checkLine = lines[i];
        if (checkLine.includes('auth()') || checkLine.includes('verifyShopOwnership') || checkLine.includes('getOwnedShop')) {
          hasAuthCheck = true;
        }
        if (checkLine.includes('verifyShopOwnership') || checkLine.includes('getOwnedShop')) {
          hasOwnershipVerify = true;
        }
      }

      if (isMutator && !hasAuthCheck) {
        findings.push({
          owaspCategory: 'A01:2021-Broken Access Control',
          file: relativePath,
          line: lineNum,
          severity: 'HIGH',
          description: `Server Action '${actionName}' modifies state but has no visible 'auth()' check in its first 25 lines.`,
          snippet: trimmed,
        });
      } else if (isMutator && /shop|product/i.test(actionName) && !hasOwnershipVerify) {
        findings.push({
          owaspCategory: 'A01:2021-Broken Access Control',
          file: relativePath,
          line: lineNum,
          severity: 'MEDIUM',
          description: `Server Action '${actionName}' modifies shop/product scope but does not call 'verifyShopOwnership()' or 'getOwnedShop()' in its first 25 lines.`,
          snippet: trimmed,
        });
      }
    }

    // 3. A05:2021-Security Misconfiguration (Disabled security features)
    // Only flag if allowDangerousEmailAccountLinking is hardcoded to literal boolean true
    if (/allowDangerousEmailAccountLinking:\s*true\s*[,}]/.test(trimmed)) {
      findings.push({
        owaspCategory: 'A05:2021-Security Misconfiguration',
        file: relativePath,
        line: lineNum,
        severity: 'MEDIUM',
        description: 'Dangerous email account linking enabled. Ensure OAuth provider configurations strictly match this risk.',
        snippet: trimmed,
      });
    }

    // 4. A04:2021-Insecure Design (Missing Magic Byte Validation in other uploaders, if any)
    if (trimmed.includes('file.type') && !filePath.includes('tests') && !filePath.includes('rate-limit') && !filePath.includes('owasp')) {
      // Re-use already loaded file content buffer to avoid duplicate readFileSync Disk IO
      if (!content.includes('fromBuffer') && !content.includes('fileTypeFromBuffer') && filePath.includes('api/upload')) {
        findings.push({
          owaspCategory: 'A04:2021-Insecure Design',
          file: relativePath,
          line: lineNum,
          severity: 'HIGH',
          description: 'Validating file upload type solely via file.type. Ensure server-side magic byte analysis is implemented.',
          snippet: trimmed,
        });
      }
    }
  });
}

function runAudit() {
  console.log('\n======================================================================');
  console.log('                 OWASP SECURITY AUDIT SAST SCANNER                    ');
  console.log('======================================================================');
  console.log('Scanning codebase for vulnerability patterns...\n');

  scanDirectory(path.join(process.cwd(), 'src'), ['.ts', '.tsx'], auditFile);

  // 5. A05:2021-Security Misconfiguration (CSP configuration checks in next.config.ts)
  const nextConfigPath = path.join(process.cwd(), 'next.config.ts');
  if (fs.existsSync(nextConfigPath)) {
    const configContent = fs.readFileSync(nextConfigPath, 'utf-8');
    if (!configContent.includes('Content-Security-Policy')) {
      findings.push({
        owaspCategory: 'A05:2021-Security Misconfiguration',
        file: 'next.config.ts',
        line: 1,
        severity: 'HIGH',
        description: 'Content-Security-Policy (CSP) headers are not defined in Next.js headers config.',
        snippet: 'N/A',
      });
    }
    if (!configContent.includes('X-Frame-Options')) {
      findings.push({
        owaspCategory: 'A05:2021-Security Misconfiguration',
        file: 'next.config.ts',
        line: 1,
        severity: 'MEDIUM',
        description: 'X-Frame-Options clickjacking protection header is missing.',
        snippet: 'N/A',
      });
    }
  }

  // 6. A06:2021-Vulnerable and Outdated Components (package.json checks)
  const packageJsonPath = path.join(process.cwd(), 'package.json');
  if (fs.existsSync(packageJsonPath)) {
    const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    
    if (deps['next-auth'] && deps['next-auth'].includes('beta.25')) {
      findings.push({
        owaspCategory: 'A06:2021-Vulnerable Components',
        file: 'package.json',
        line: 1,
        severity: 'HIGH',
        description: 'Vulnerable next-auth version configured (v5.0.0-beta.25). Contains GHSA-5jpx-9hw9-2fx4.',
        snippet: `"next-auth": "${deps['next-auth']}"`,
      });
    }
  }

  // Print results
  if (findings.length === 0) {
    console.log('✓ No critical or high severity OWASP vulnerability patterns detected.');
  } else {
    console.log(`Found ${findings.length} security alerts:\n`);
    
    findings.forEach((finding, index) => {
      console.log(`[ALERT #${index + 1}] [${finding.severity}] - ${finding.owaspCategory}`);
      console.log(`  File:    ${finding.file}:${finding.line}`);
      console.log(`  Detail:  ${finding.description}`);
      if (finding.snippet !== 'N/A') {
        console.log(`  Code:    "${finding.snippet.trim()}"`);
      }
      console.log('----------------------------------------------------------------------');
    });

    console.log('\nScan Summary:');
    const severityCounts = findings.reduce((acc, f) => {
      acc[f.severity] = (acc[f.severity] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    console.log(`  Critical: ${severityCounts['CRITICAL'] || 0}`);
    console.log(`  High:     ${severityCounts['HIGH'] || 0}`);
    console.log(`  Medium:   ${severityCounts['MEDIUM'] || 0}`);
    console.log(`  Low:      ${severityCounts['LOW'] || 0}`);

    const hasFailures = findings.some(f => f.severity === 'CRITICAL' || f.severity === 'HIGH');
    if (hasFailures) {
      console.log('\n======================================================================');
      console.log('  FAILURE: Critical or High severity security vulnerability detected!  ');
      console.log('======================================================================\n');
      process.exit(1);
    }
  }
  console.log('======================================================================\n');
}

runAudit();
