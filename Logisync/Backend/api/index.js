
const app = require("../src/app");
const { testConnection } = require("../src/config/database");

let databaseReady;

module.exports = async (req, res) => {
  try {
    if (!databaseReady) {
      databaseReady = testConnection();
    }

    await databaseReady;
    return app(req, res);
  } catch (error) {
    console.error("Database initialization failed:", error);

    databaseReady = null;

    return res.status(500).json({
      success: false,
      message: "Database connection failed."
    });
  }
};
