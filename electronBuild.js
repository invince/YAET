const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const angularDistDir = "dist/angular-app";
const electronDistDir = "dist/electron-app";
const electronMainFile = "electron/electronMain.js";

// Helper to execute commands
function runCommand(command, options = {}) {
  console.log(`Running: ${command}`);
  execSync(command, { stdio: "inherit", ...options });
}

// Step 1: Build Angular App
console.log("Building Angular application...");
runCommand("ng build --prod");

// Step 2: Clean Electron Dist Directory
if (fs.existsSync(electronDistDir)) {
  fs.rmSync(electronDistDir, { recursive: true, force: true });
}
fs.mkdirSync(electronDistDir, { recursive: true });

// Step 3: Copy Angular Build to Electron Directory
console.log("Copying Angular build to Electron dist...");
fs.cpSync(path.resolve(angularDistDir), path.resolve(electronDistDir, "app"), {
  recursive: true,
});

// Step 4: Copy Electron Main Process Files
console.log("Copying Electron main process files...");
fs.copyFileSync(
  electronMainFile,
  path.resolve(electronDistDir, "main.js")
);

// Step 5: Run electron-rebuild
console.log("Rebuilding native modules for Electron...");
runCommand("npx electron-rebuild", { cwd: electronDistDir });

// Step 5: Package with Electron Packager
console.log("Packaging Electron application...");
runCommand(
  `npx electron-packager ${electronDistDir} MyApp --platform=win32 --arch=x64 --out=release-build --overwrite`
);

console.log("Build completed successfully!");
