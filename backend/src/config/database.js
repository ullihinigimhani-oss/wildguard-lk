const environment = require("./environment");
const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const { Client } = require("pg");
const { serialClient } = require("./serialPgClient");

if (!environment.DATABASE_URL) {
  throw new Error("DATABASE_URL must be configured");
}

// Preserve pg's current certificate verification without its legacy-mode warning.
// Normalize only the runtime copy; never rewrite the environment or .env file.
const connectionUrl = new URL(environment.DATABASE_URL);
if (
  connectionUrl.searchParams.get("uselibpqcompat") !== "true" &&
  ["prefer", "require", "verify-ca"].includes(
    connectionUrl.searchParams.get("sslmode"),
  )
) {
  connectionUrl.searchParams.set("sslmode", "verify-full");
}

const adapter = new PrismaPg({
  Client: serialClient(Client),
  connectionString: connectionUrl.toString(),
  // Allow time for a suspended Neon compute to wake and establish TLS.
  connectionTimeoutMillis: 15000,
  query_timeout: 5000,
  max: 5,
});

module.exports = new PrismaClient({ adapter });
