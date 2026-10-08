const environment = require('./config/environment');
const app = require('./app');
const prisma = require('./config/database');

const port = Number(environment.PORT || 3000);
if (!Number.isInteger(port) || port < 0 || port > 65535) {
  throw new Error('PORT must be an integer between 0 and 65535');
}

const server = app.listen(port, async () => {
  console.log(`WildGuard LK API listening on port ${server.address().port}`);
  try {
    await prisma.$connect();
    console.log('Database connection established successfully');
  } catch (err) {
    console.error('Failed to connect to the database:', err.message);
    shutdown(1);
  }
});

let stopping = false;
function shutdown(exitCode = 0) {
  if (stopping) return;
  stopping = true;
  const timeout = setTimeout(() => process.exit(1), 10000);
  timeout.unref();
  server.close(async () => {
    try {
      await prisma.$disconnect();
    } catch {
      exitCode = 1;
    }
    clearTimeout(timeout);
    process.exit(exitCode);
  });
}

server.on('error', (error) => {
  const reason = error.code ? `${error.code}: ${error.message}` : error.message;
  console.error(`Unable to start the WildGuard LK API HTTP server on port ${port}: ${reason}`);
  if (error.code === 'EADDRINUSE') {
    console.error(`Stop the process using port ${port}, or set PORT to an available port.`);
  }
  shutdown(1);
});
process.on('SIGINT', () => shutdown());
process.on('SIGTERM', () => shutdown());
