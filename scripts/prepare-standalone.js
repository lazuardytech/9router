#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
const standaloneDir = path.join(projectRoot, ".next/standalone");
const staticSrc = path.join(projectRoot, ".next/static");
const staticDest = path.join(standaloneDir, ".next/static");
const publicSrc = path.join(projectRoot, "public");
const publicDest = path.join(standaloneDir, "public");

function copyRecursive(src, dest) {
  if (!fs.existsSync(src)) return;
  
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

console.log("Preparing standalone build...");

// Copy static files
if (fs.existsSync(staticSrc)) {
  copyRecursive(staticSrc, staticDest);
  console.log("✓ Copied .next/static");
}

// Copy public folder
if (fs.existsSync(publicSrc)) {
  copyRecursive(publicSrc, publicDest);
  console.log("✓ Copied public");
}

console.log("✓ Standalone build ready");


















