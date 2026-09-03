import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const srcRoot = path.join(root, 'src');
const sourceExtensions = new Set(['.js', '.jsx', '.ts', '.tsx']);

// New/reworked product surfaces are strict immediately. Legacy feature folders
// are added when that surface is deliberately migrated under the rewrite guide.
const strictPresentationScopes = [
  'src/app/navigation/',
  'src/ui/components/',
  'src/features/home/',
  'src/features/activity/',
  'src/features/xapps/',
  'src/features/dapps/',
  'src/features/request/',
  'src/features/exchange/',
];

const violations = [];

function toPosix(value) {
  return value.split(path.sep).join('/');
}

function walk(directory) {
  if (!fs.existsSync(directory)) {
    return [];
  }

  const entries = fs.readdirSync(directory, { withFileTypes: true });
  return entries.flatMap(entry => {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      return walk(absolutePath);
    }
    return sourceExtensions.has(path.extname(entry.name)) ? [absolutePath] : [];
  });
}

function extractImportSources(sourceText) {
  const sources = new Set();
  const patterns = [
    /\b(?:import|export)\s+(?:type\s+)?(?:[^'";]+?\s+from\s+)?['"]([^'"]+)['"]/g,
    /\brequire\(\s*['"]([^'"]+)['"]\s*\)/g,
    /\bimport\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];

  for (const pattern of patterns) {
    for (const match of sourceText.matchAll(pattern)) {
      sources.add(match[1]);
    }
  }

  return [...sources];
}

function importsLayer(filePath, importSource, layer) {
  if (importSource === `@${layer}` || importSource.startsWith(`@${layer}/`)) {
    return true;
  }
  if (!importSource.startsWith('.')) {
    return false;
  }

  const resolved = path.resolve(path.dirname(filePath), importSource);
  const layerRoot = path.join(srcRoot, layer);
  return resolved === layerRoot || resolved.startsWith(`${layerRoot}${path.sep}`);
}

function importsPackage(importSource, packageName) {
  return importSource === packageName || importSource.startsWith(`${packageName}/`);
}

function addViolation(relativePath, rule, detail) {
  violations.push({ relativePath, rule, detail });
}

function isStrictPresentationFile(relativePath) {
  return strictPresentationScopes.some(scope => relativePath.startsWith(scope));
}

function checkImports(filePath, relativePath, sourceText) {
  const imports = extractImportSources(sourceText);
  const isFeature = relativePath.startsWith('src/features/');
  const isStrictFeature = isFeature && isStrictPresentationFile(relativePath);
  const isCapability = relativePath.startsWith('src/capabilities/');
  const isUi = relativePath.startsWith('src/ui/');
  const isPlatform = relativePath.startsWith('src/platform/');

  for (const importSource of imports) {
    if (importsPackage(importSource, 'react-native-navigation')) {
      addViolation(
        relativePath,
        'navigation-library-boundary',
        `imports ${importSource}; F0 requires React Navigation`,
      );
    }

    if (isStrictFeature) {
      if (importsLayer(filePath, importSource, 'platform')) {
        addViolation(relativePath, 'feature-platform-boundary', `imports ${importSource}`);
      }
      if (importsPackage(importSource, 'realm') || importsPackage(importSource, '@stellar/stellar-sdk')) {
        addViolation(relativePath, 'feature-external-mechanism-boundary', `imports ${importSource}`);
      }
    }

    if (isCapability) {
      if (importsLayer(filePath, importSource, 'features') || importsLayer(filePath, importSource, 'ui')) {
        addViolation(relativePath, 'capability-presentation-boundary', `imports ${importSource}`);
      }
      if (importSource === 'react' || importSource === 'react-native' || importsPackage(importSource, 'realm')) {
        addViolation(relativePath, 'capability-runtime-boundary', `imports ${importSource}`);
      }
    }

    if (isUi) {
      if (
        importsLayer(filePath, importSource, 'features') ||
        importsLayer(filePath, importSource, 'capabilities') ||
        importsLayer(filePath, importSource, 'platform')
      ) {
        addViolation(relativePath, 'ui-domain-boundary', `imports ${importSource}`);
      }
      if (importsPackage(importSource, 'realm') || importsPackage(importSource, '@stellar/stellar-sdk')) {
        addViolation(relativePath, 'ui-external-mechanism-boundary', `imports ${importSource}`);
      }
    }

    if (isPlatform) {
      if (importsLayer(filePath, importSource, 'features') || importsLayer(filePath, importSource, 'ui')) {
        addViolation(relativePath, 'platform-product-boundary', `imports ${importSource}`);
      }
    }
  }

  if (
    (isStrictFeature || isUi) &&
    /import\s*\{[^}]*\bNativeModules\b[^}]*\}\s*from\s*['"]react-native['"]/.test(sourceText)
  ) {
    addViolation(relativePath, 'native-modules-boundary', 'imports NativeModules from react-native');
  }
}

function checkStrictPresentation(relativePath, sourceText) {
  if (!isStrictPresentationFile(relativePath)) {
    return;
  }

  if (/\bvar\s+[A-Za-z_$]/.test(sourceText)) {
    addViolation(relativePath, 'declaration-style', 'uses var');
  }

  if (/style\s*=\s*\{\s*\{/.test(sourceText)) {
    addViolation(relativePath, 'inline-style', 'uses an inline style object');
  }

  if (relativePath.endsWith('.tsx') && /\bStyleSheet\.create\s*\(/.test(sourceText)) {
    addViolation(
      relativePath,
      'style-colocation',
      'creates a StyleSheet inside a component/screen file; move static styles to styles.ts',
    );
  }

  const isThemeImplementation = relativePath.startsWith('src/ui/theme/');
  if (!isThemeImplementation && /#[0-9a-fA-F]{3,8}\b|\brgba?\s*\(|\bhsla?\s*\(/.test(sourceText)) {
    addViolation(relativePath, 'raw-color-literal', 'contains a raw color literal outside ui/theme');
  }
}

if (!fs.existsSync(srcRoot)) {
  console.error('Architecture check failed: src/ directory not found.');
  process.exit(1);
}

if (fs.existsSync(path.join(srcRoot, 'services'))) {
  addViolation(
    'src/services',
    'global-services-layer',
    'global services layer is forbidden; use features/capabilities/platform',
  );
}

for (const filePath of walk(srcRoot)) {
  const relativePath = toPosix(path.relative(root, filePath));
  const sourceText = fs.readFileSync(filePath, 'utf8');
  checkImports(filePath, relativePath, sourceText);
  checkStrictPresentation(relativePath, sourceText);
}

if (violations.length > 0) {
  console.error('Architecture/style guard found violations:');
  for (const violation of violations) {
    console.error(`- ${violation.relativePath}: [${violation.rule}] ${violation.detail}`);
  }
  process.exit(1);
}

console.log('Architecture/style guard passed.');
