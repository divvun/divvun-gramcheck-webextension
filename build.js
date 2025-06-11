const { build } = require('esbuild');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Clean dist directory
if (fs.existsSync('dist')) {
  fs.rmSync('dist', { recursive: true });
}
fs.mkdirSync('dist', { recursive: true });

// Build WASM first
console.log('Building WASM...');
try {
  execSync('cd rust && wasm-pack build --target web --out-dir ../src/wasm', { stdio: 'inherit' });
  console.log('WASM build completed');
} catch (error) {
  console.error('WASM build failed:', error.message);
  process.exit(1);
}

// Copy static files
console.log('Copying static files...');
const copyRecursive = (src, dest) => {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    fs.readdirSync(src).forEach(file => {
      copyRecursive(path.join(src, file), path.join(dest, file));
    });
  } else {
    fs.copyFileSync(src, dest);
  }
};

// Copy manifest and icons
fs.copyFileSync('manifest.json', 'dist/manifest.json');
copyRecursive('icons', 'dist/icons');

// Copy WASM files (excluding TypeScript files)
const copyWasmFiles = (src, dest) => {
  if (!fs.existsSync(src)) return;
  
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  
  fs.readdirSync(src).forEach(file => {
    const srcPath = path.join(src, file);
    const destPath = path.join(dest, file);
    const stat = fs.statSync(srcPath);
    
    if (stat.isDirectory()) {
      copyWasmFiles(srcPath, destPath);
    } else if (!file.endsWith('.ts') && !file.endsWith('.gitignore') && file !== 'package.json') {
      fs.copyFileSync(srcPath, destPath);
    }
  });
};

copyWasmFiles('src/wasm', 'dist/wasm');

// Process HTML files
const processHTML = (templatePath, outputPath, scriptName) => {
  if (!fs.existsSync(templatePath)) {
    console.warn(`Template ${templatePath} not found, creating basic HTML`);
    const basicHTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Extension Page</title>
</head>
<body>
  <div id="app"></div>
  <script src="${scriptName}.js"></script>
</body>
</html>`;
    fs.writeFileSync(outputPath, basicHTML);
    return;
  }
  
  let html = fs.readFileSync(templatePath, 'utf8');
  
  // Replace the module script with the built JavaScript
  html = html.replace(
    /<script src="\.\/index\.ts" type="module"><\/script>/,
    `<script src="${scriptName}.js"></script>`
  );
  
  // Remove any webpack-specific comments
  html = html.replace(/<!-- In Webpack.*?-->/s, '');
  html = html.replace(/<!-- If using Vite.*?-->/s, '');
  
  fs.writeFileSync(outputPath, html);
};

// Process HTML files
processHTML('src/popup/index.html', 'dist/popup.html', 'popup');
processHTML('src/options/index.html', 'dist/options.html', 'options');

// esbuild configuration
const buildConfig = {
  entryPoints: {
    background: 'src/background/index.ts',
    content: 'src/content/index.ts',
    popup: 'src/popup/index.ts',
    options: 'src/options/index.ts',
  },
  bundle: true,
  outdir: 'dist',
  format: 'iife',
  target: 'es2018',
  sourcemap: true,
  minify: process.env.NODE_ENV === 'production',
  loader: {
    '.wasm': 'file',
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
  },
  external: [], // Don't externalize any modules for web extension
};

// Build with esbuild
console.log('Building with esbuild...');
build(buildConfig)
  .then(() => {
    console.log('Build completed successfully!');
  })
  .catch((error) => {
    console.error('Build failed:', error);
    process.exit(1);
  }); 