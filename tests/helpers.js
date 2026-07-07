const request = require("supertest");
const app = require("../src/app");
const seedMasterData = require("../src/utils/seedMasterData");
const User = require("../src/models/user.model");

const defaultUser = {
  name: "Test User",
  email: "test@example.com",
  password: "password123",
};

/**
 * Registers + logs in a user. Auto-verifies the email by default so the
 * many pre-existing tests that exercise Group Expenses (which require a
 * verified email) don't need to know about the verification flow. Pass
 * `{ verifyEmail: false }` for tests that specifically need an unverified
 * user (see emailVerification.test.js).
 */
const registerAndLogin = async (userData = defaultUser, { verifyEmail = true } = {}) => {
  const agent = request(app);
  const response = await agent.post("/api/auth/register").send(userData);

  if (verifyEmail && response.body?.user?.id) {
    await User.findByIdAndUpdate(response.body.user.id, {
      emailVerified: true,
      verifiedAt: new Date(),
    });
    response.body.user.emailVerified = true;
  }

  return {
    agent,
    token: response.body.token,
    user: response.body.user,
  };
};

const authHeader = (token) => ({ Authorization: `Bearer ${token}` });

const setExchangeRate = async (token, rate) =>
  request(app).put("/api/settings/exchange-rate").set(authHeader(token)).send({ rate });

module.exports = {
  request,
  app,
  defaultUser,
  registerAndLogin,
  authHeader,
  setExchangeRate,
  seedMasterData,
};
