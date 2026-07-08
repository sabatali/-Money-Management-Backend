const { request, defaultUser, registerAndLogin, authHeader } = require("../helpers");

describe("Auth API", () => {
  test("GET / returns API message", async () => {
    const response = await request(require("../../src/app")).get("/");

    expect(response.status).toBe(200);
    expect(response.body.message).toMatch(/LibraMate API/i);
  });

  test("POST /api/auth/register creates a user and returns token", async () => {
    const response = await request(require("../../src/app"))
      .post("/api/auth/register")
      .send(defaultUser);

    expect(response.status).toBe(201);
    expect(response.body.token).toBeDefined();
    expect(response.body.user.email).toBe(defaultUser.email);
  });

  test("POST /api/auth/register rejects duplicate email", async () => {
    await registerAndLogin();

    const response = await request(require("../../src/app"))
      .post("/api/auth/register")
      .send(defaultUser);

    expect(response.status).toBe(409);
    expect(response.body.message).toMatch(/already registered/i);
  });

  test("POST /api/auth/register validates required fields", async () => {
    const response = await request(require("../../src/app"))
      .post("/api/auth/register")
      .send({ email: "bad-email", password: "123" });

    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/validation failed/i);
  });

  test("POST /api/auth/login succeeds with valid credentials", async () => {
    await registerAndLogin();

    const response = await request(require("../../src/app"))
      .post("/api/auth/login")
      .send({ email: defaultUser.email, password: defaultUser.password });

    expect(response.status).toBe(200);
    expect(response.body.token).toBeDefined();
  });

  test("POST /api/auth/login rejects invalid credentials", async () => {
    await registerAndLogin();

    const response = await request(require("../../src/app"))
      .post("/api/auth/login")
      .send({ email: defaultUser.email, password: "wrong-password" });

    expect(response.status).toBe(401);
    expect(response.body.message).toMatch(/invalid credentials/i);
  });

  test("protected routes reject missing token", async () => {
    const response = await request(require("../../src/app")).get("/api/accounts");

    expect(response.status).toBe(401);
  });

  test("protected routes reject invalid token", async () => {
    const response = await request(require("../../src/app"))
      .get("/api/accounts")
      .set(authHeader("invalid-token"));

    expect(response.status).toBe(401);
  });
});
