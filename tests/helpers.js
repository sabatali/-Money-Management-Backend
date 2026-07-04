const request = require("supertest");
const app = require("../src/app");

const defaultUser = {
  name: "Test User",
  email: "test@example.com",
  password: "password123",
};

const registerAndLogin = async (userData = defaultUser) => {
  const agent = request(app);
  const response = await agent.post("/api/auth/register").send(userData);
  return {
    agent,
    token: response.body.token,
    user: response.body.user,
  };
};

const authHeader = (token) => ({ Authorization: `Bearer ${token}` });

module.exports = {
  request,
  app,
  defaultUser,
  registerAndLogin,
  authHeader,
};
