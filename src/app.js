
const express = require("express");
const authRoutes = require("./routes/auth.routes");
const transactionRoutes = require("./routes/transaction.routes");
const loanRoutes = require("./routes/loan.routes");
const transferRoutes = require("./routes/transfer.routes");
const categoryRoutes = require("./routes/category.routes");
const accountRoutes = require("./routes/account.routes");
const groupRoutes = require("./routes/group.routes");
const groupExpenseRoutes = require("./routes/groupExpense.routes");
const groupMemberRoutes = require("./routes/groupMember.routes");
const userRoutes = require("./routes/user.routes");
const settingRoutes = require("./routes/setting.routes");
const masterDataRoutes = require("./routes/masterData.routes");

const app = express();

app.use(express.json());
const allowedOrigins = [
  "http://localhost:5173",
  "https://money-management-frontend-gamma.vercel.app",
  ...(process.env.FRONTEND_URL ? process.env.FRONTEND_URL.split(",").map((origin) => origin.trim()) : []),
];

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.header("Access-Control-Allow-Origin", origin);
  }
  res.header("Vary", "Origin");
  res.header("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }
  return next();
});

app.options("*", (req, res) => {
  res.sendStatus(204);
});

app.get("/", (req, res) => {
  res.json({ message: "Student Daily Expense Management System API" });
});

app.use("/api/auth", authRoutes);
app.use("/api/transactions", transactionRoutes);
app.use("/api/loans", loanRoutes);
app.use("/api/transfers", transferRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/accounts", accountRoutes);
app.use("/api/groups", groupRoutes);
app.use("/api/group-expenses", groupExpenseRoutes);
app.use("/api/group-members", groupMemberRoutes);
app.use("/api/users", userRoutes);
app.use("/api/settings", settingRoutes);
app.use("/api/master-data", masterDataRoutes);

const devToolsEnabled =
  process.env.NODE_ENV !== "production" || process.env.ENABLE_DEV_RESET === "true";
if (devToolsEnabled) {
  const devRoutes = require("./routes/dev.routes");
  app.use("/api/dev", devRoutes);
}

app.use((req, res) => {
  res.status(404).json({ message: "Route not found." });
});

module.exports = app;
