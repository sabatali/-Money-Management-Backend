require("dotenv").config();
const app = require("./app");
const connectDB = require("./config/db");
const seedMasterData = require("./utils/seedMasterData");
const migrateGroupMembers = require("./utils/migrateGroupMembers");

const PORT = process.env.PORT || 5001;

const startServer = async () => {
  await connectDB();
  await seedMasterData();
  await migrateGroupMembers();
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
};

startServer();
