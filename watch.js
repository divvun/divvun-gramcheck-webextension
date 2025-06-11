const { context } = require('esbuild');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { watch } = require('fs');

// Copy static files function
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

const copyStaticFiles = () => {
  console.log('Copying static files...');
  
  // Copy manifest and icons
  fs.copyFileSync('manifest.json', 'dist/manifest.json');
  copyRecursive('icons', 'dist/icons');
  
  // Copy WASM files
  copyWasmFiles('src/wasm', 'dist/wasm');
  
  // Process HTML files
  processHTML('src/popup/index.html', 'dist/popup.html', 'popup');
  processHTML('src/options/index.html', 'dist/options.html', 'options');
};

const buildWasm = () => {
  console.log('Building WASM...');
  try {
    execSync('cd rust && wasm-pack build --target web --out-dir ../src/wasm', { stdio: 'inherit' });
    console.log('WASM build completed');
    return true;
  } catch (error) {
    console.error('WASM build failed:', error.message);
    return false;
  }
};

// Initial setup
console.log('Setting up watch mode...');

// Clean dist directory
if (fs.existsSync('dist')) {
  fs.rmSync('dist', { recursive: true });
}
fs.mkdirSync('dist', { recursive: true });

// Build WASM initially
if (!buildWasm()) {
  process.exit(1);
}

// Copy static files initially
copyStaticFiles();

// esbuild context for watching
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
  loader: {
    '.wasm': 'file',
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify('development'),
  },
  external: [],
};

// Start esbuild watch
context(buildConfig).then(ctx => {
  ctx.watch().then(() => {
    console.log('👀 Watching for TypeScript changes...');
  });

  // Watch for changes to static files
  const watchOptions = { recursive: true };
  
  // Watch manifest.json
  watch('manifest.json', (eventType) => {
    if (eventType === 'change') {
      console.log('📄 Manifest changed, copying...');
      fs.copyFileSync('manifest.json', 'dist/manifest.json');
    }
  });
  
  // Watch icons directory
  if (fs.existsSync('icons')) {
    watch('icons', watchOptions, (eventType) => {
      if (eventType === 'change') {
        console.log('🎨 Icons changed, copying...');
        copyRecursive('icons', 'dist/icons');
      }
    });
  }
  
  // Watch HTML files
  watch('src/popup/index.html', (eventType) => {
    if (eventType === 'change') {
      console.log('📱 Popup HTML changed, processing...');
      processHTML('src/popup/index.html', 'dist/popup.html', 'popup');
    }
  });
  
  watch('src/options/index.html', (eventType) => {
    if (eventType === 'change') {
      console.log('⚙️ Options HTML changed, processing...');
      processHTML('src/options/index.html', 'dist/options.html', 'options');
    }
  });
  
  // Watch Rust files for WASM changes
  if (fs.existsSync('rust')) {
    watch('rust', watchOptions, (eventType, filename) => {
      if (filename && filename.endsWith('.rs')) {
        console.log('🦀 Rust files changed, rebuilding WASM...');
        if (buildWasm()) {
          copyWasmFiles('src/wasm', 'dist/wasm');
        }
      }
    });
  }
  
  console.log('🚀 Watch mode started! Make changes to see them rebuild automatically.');
}).catch(error => {
  console.error('Failed to start watch mode:', error);
  process.exit(1);
}); 