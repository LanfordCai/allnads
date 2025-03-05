// This script fixes the imports in the compiled JavaScript files
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Function to recursively find all JavaScript files in a directory
function findJsFiles(dir) {
  const files = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...findJsFiles(fullPath));
    } else if (entry.name.endsWith('.js')) {
      files.push(fullPath);
    }
  }
  
  return files;
}

// Function to fix imports in a JavaScript file
function fixImports(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Replace relative imports without file extensions
  content = content.replace(/from\s+['"](\.[^'"]*)['"]/g, (match, importPath) => {
    // Skip if the import already has a file extension
    if (importPath.endsWith('.js') || importPath.endsWith('.json')) {
      return match;
    }
    
    // Add .js extension
    return `from '${importPath}.js'`;
  });
  
  fs.writeFileSync(filePath, content);
  console.log(`Fixed imports in ${filePath}`);
}

// Find all JavaScript files in the dist directory
const distDir = path.join(__dirname, 'dist');
const jsFiles = findJsFiles(distDir);

// Fix imports in all JavaScript files
for (const file of jsFiles) {
  fixImports(file);
}

console.log(`Fixed imports in ${jsFiles.length} files.`); 