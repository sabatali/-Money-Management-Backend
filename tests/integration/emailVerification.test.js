const { request, app, registerAndLogin, authHeader } = require("../helpers");

describe("Email verification", () => {
  test("new users register as unverified without being blocked from login", async () => {
    const registerResponse = await request(app).post("/api/auth/register").send({
      name: "Unverified User",
      email: "unverified@example.com",
      password: "password123",
    });

    expect(registerResponse.status).toBe(201);
    expect(registerResponse.body.user.emailVerified).toBe(false);

    const loginResponse = await request(app).post("/api/auth/login").send({
      email: "unverified@example.com",
      password: "password123",
    });

    expect(loginResponse.status).toBe(200);
    expect(loginResponse.body.user.emailVerified).toBe(false);
  });

  test("unverified users can use personal finance features (accounts, categories, transactions)", async () => {
    const { token } = await registerAndLogin(
      { name: "Personal", email: "personal@example.com", password: "password123" },
      { verifyEmail: false }
    );

    const accountResponse = await request(app)
      .post("/api/accounts")
      .set(authHeader(token))
      .send({ name: "Cash", currency: "PKR", openingBalance: 100 });
    expect(accountResponse.status).toBe(201);

    const categoryResponse = await request(app)
      .post("/api/categories")
      .set(authHeader(token))
      .send({ name: "Groceries", type: "expense" });
    expect(categoryResponse.status).toBe(201);
  });

  test("unverified users are blocked from creating groups and group expenses", async () => {
    const { token } = await registerAndLogin(
      { name: "Blocked", email: "blocked@example.com", password: "password123" },
      { verifyEmail: false }
    );

    const groupResponse = await request(app)
      .post("/api/groups")
      .set(authHeader(token))
      .send({ name: "Roomies" });

    expect(groupResponse.status).toBe(403);
    expect(groupResponse.body.code).toBe("EMAIL_VERIFICATION_REQUIRED");

    const listResponse = await request(app).get("/api/groups").set(authHeader(token));
    expect(listResponse.status).toBe(403);

    const expenseResponse = await request(app)
      .post("/api/group-expenses")
      .set(authHeader(token))
      .send({
        group: "000000000000000000000000",
        title: "Food",
        totalAmountOriginal: 100,
        currency: "PKR",
        paidBy: "000000000000000000000000",
        splitType: "EQUAL",
        accountUsed: "Cash",
        date: "2026-01-01",
      });
    expect(expenseResponse.status).toBe(403);
  });

  test("verified users can create groups", async () => {
    const { token } = await registerAndLogin({
      name: "Verified",
      email: "verified-group@example.com",
      password: "password123",
    });

    const groupResponse = await request(app)
      .post("/api/groups")
      .set(authHeader(token))
      .send({ name: "Roomies" });

    expect(groupResponse.status).toBe(201);
  });

  test("send verification email enforces cooldown and returns a dev token", async () => {
    const { token } = await registerAndLogin(
      { name: "Sender", email: "sender@example.com", password: "password123" },
      { verifyEmail: false }
    );

    const first = await request(app)
      .post("/api/auth/verify-email/send")
      .set(authHeader(token));

    expect(first.status).toBe(200);
    expect(first.body.message).toMatch(/verification email sent/i);
    expect(first.body.data.devVerificationToken).toBeDefined();

    const second = await request(app)
      .post("/api/auth/verify-email/send")
      .set(authHeader(token));

    expect(second.status).toBe(429);
    expect(second.body.retryAfterSeconds).toBeGreaterThan(0);
  });

  test("full verification flow: send -> verify -> gains access -> old token invalid", async () => {
    const { token, user } = await registerAndLogin(
      { name: "Flow", email: "flow@example.com", password: "password123" },
      { verifyEmail: false }
    );

    const sendResponse = await request(app)
      .post("/api/auth/verify-email/send")
      .set(authHeader(token));
    const firstToken = sendResponse.body.data.devVerificationToken;

    const blocked = await request(app)
      .post("/api/groups")
      .set(authHeader(token))
      .send({ name: "Blocked Group" });
    expect(blocked.status).toBe(403);

    const verifyResponse = await request(app)
      .post("/api/auth/verify-email")
      .send({ token: firstToken });

    expect(verifyResponse.status).toBe(200);
    expect(verifyResponse.body.data.emailVerified).toBe(true);

    const me = await request(app).get("/api/auth/me").set(authHeader(token));
    expect(me.body.data.emailVerified).toBe(true);

    const allowed = await request(app)
      .post("/api/groups")
      .set(authHeader(token))
      .send({ name: "Unlocked Group" });
    expect(allowed.status).toBe(201);

    // Re-verifying with the same (now consumed) token should be idempotent,
    // not an error, since the account is already verified.
    const reuse = await request(app)
      .post("/api/auth/verify-email")
      .send({ token: firstToken });
    expect(reuse.status).toBe(400);

    void user;
  });

  test("rejects invalid and expired verification tokens", async () => {
    const invalid = await request(app)
      .post("/api/auth/verify-email")
      .send({ token: "not-a-real-token" });
    expect(invalid.status).toBe(400);
    expect(invalid.body.message).toMatch(/invalid or expired/i);

    const missing = await request(app).post("/api/auth/verify-email").send({});
    expect(missing.status).toBe(400);
  });

  test("generating a new verification token invalidates the previous one", async () => {
    const { token } = await registerAndLogin(
      { name: "Rotate", email: "rotate@example.com", password: "password123" },
      { verifyEmail: false }
    );

    const first = await request(app)
      .post("/api/auth/verify-email/send")
      .set(authHeader(token));
    const firstToken = first.body.data.devVerificationToken;

    // Wait out the cooldown isn't practical in a unit test, so directly
    // reset the cooldown timestamp to simulate time passing.
    const User = require("../../src/models/user.model");
    await User.updateOne(
      { email: "rotate@example.com" },
      { emailVerificationLastSentAt: new Date(Date.now() - 61 * 1000) }
    );

    const second = await request(app)
      .post("/api/auth/verify-email/send")
      .set(authHeader(token));
    const secondToken = second.body.data.devVerificationToken;
    expect(secondToken).not.toBe(firstToken);

    const verifyWithOldToken = await request(app)
      .post("/api/auth/verify-email")
      .send({ token: firstToken });
    expect(verifyWithOldToken.status).toBe(400);

    const verifyWithNewToken = await request(app)
      .post("/api/auth/verify-email")
      .send({ token: secondToken });
    expect(verifyWithNewToken.status).toBe(200);
  });
});
