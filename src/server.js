require("dotenv").config();
const app = require("./app");
const connectDB = require("./config/db");
const seedMasterData = require("./utils/seedMasterData");

const PORT = process.env.PORT || 5001;

const startServer = async () => {
  await connectDB();
  await seedMasterData();
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
};

startServer();
