require("dotenv").config();

const app = require("./app");
const { testConnection } = require("./config/database");

const PORT = Number(process.env.PORT || 5000);

async function startServer() {
  try {
    await testConnection();
    console.log("PostgreSQL (Neon) connected successfully.");
  } catch (error) {
    console.error("PostgreSQL connection failed:", error.message);
    console.error("Make sure your PostgreSQL / Neon DATABASE_URL or .env settings are correct.");
    process.exit(1);
  }

  app.listen(PORT, () => {
    console.log(`SyncLink backend running on http://localhost:${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/api/health`);
  });
}

startServer();