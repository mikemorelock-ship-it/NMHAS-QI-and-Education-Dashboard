/* eslint-disable @typescript-eslint/no-require-imports */
// mock-native.cjs - Preload script to mock missing native libsql module on Windows ARM64
// Usage: node --require ./scripts/mock-native.cjs --import tsx prisma/seed.mjs
const Module = require("module");
const origResolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...args) {
  if (request === "@libsql/win32-arm64-msvc") {
    // Redirect to the web client so the import doesn't fail
    return require.resolve("@libsql/client/web");
  }
  return origResolve.call(this, request, ...args);
};
