require("dotenv").config();

const app = require("./app");
const { testConnection } = require("./config/database");

const PORT = Number(process.env.PORT || 5000);

async function startServer() {
  try {
    await testConnection();
    console.log("MySQL connected successfully.");
  } catch (error) {
    console.error("MySQL connection failed:", error.message);
    console.error("Make sure MySQL is running and your .env settings are correct.");
    process.exit(1);
  }

  app.listen(PORT, () => {
    console.log(`SyncLink backend running on http://localhost:${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/api/health`);
  });
}

startServer();