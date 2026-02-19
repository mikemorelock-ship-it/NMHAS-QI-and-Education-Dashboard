import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    throw new Error(
      "Missing DATABASE_URL environment variable. " + "Set it in your .env file (see .env.example)."
    );
  }

  let adapter;

  // Use Turso (libsql) for remote URLs, better-sqlite3 for local file: URLs
  if (dbUrl.startsWith("libsql://") || dbUrl.startsWith("https://")) {
    // Use web-compatible adapter (HTTP-only, no native binary required)
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PrismaLibSql } = require("@prisma/adapter-libsql/web");
    adapter = new PrismaLibSql({
      url: dbUrl,
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
  } else {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PrismaBetterSqlite3 } = require("@prisma/adapter-better-sqlite3");
    const filePath = dbUrl.startsWith("file:") ? dbUrl.slice(5) : dbUrl;
    adapter = new PrismaBetterSqlite3({ url: `file:${filePath}` });
  }

  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
