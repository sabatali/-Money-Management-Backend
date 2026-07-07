const {
  request,
  app,
  registerAndLogin,
  authHeader,
  seedMasterData,
} = require("../helpers");

describe("Master data & onboarding endpoints", () => {
  test("lists master accounts grouped and sorted", async () => {
    await seedMasterData();
    const { token } = await registerAndLogin();

    const response = await request(app)
      .get("/api/master-data/accounts")
      .set(authHeader(token));

    expect(response.status).toBe(200);
    expect(response.body.data.length).toBeGreaterThan(30);
    expect(response.body.data.some((a) => a.name === "HBL")).toBe(true);
    expect(response.body.data.some((a) => a.group === "Pakistani Banks")).toBe(true);
  });

  test("lists master categories filtered by type", async () => {
    await seedMasterData();
    const { token } = await registerAndLogin();

    const response = await request(app)
      .get("/api/master-data/categories?type=income")
      .set(authHeader(token));

    expect(response.status).toBe(200);
    expect(response.body.data.every((c) => c.type === "income")).toBe(true);
    expect(response.body.data.some((c) => c.name === "Scholarship")).toBe(true);
  });

  test("creating an account from a master account uses its canonical name/type", async () => {
    await seedMasterData();
    const { token } = await registerAndLogin();

    const master = await request(app)
      .get("/api/master-data/accounts")
      .set(authHeader(token));
    const hbl = master.body.data.find((a) => a.name === "HBL");

    const response = await request(app)
      .post("/api/accounts")
      .set(authHeader(token))
      .send({ masterAccountId: hbl._id });

    expect(response.status).toBe(201);
    expect(response.body.data.name).toBe("HBL");
    expect(response.body.data.type).toBe("bank");
    expect(response.body.data.isCustom).toBe(false);
  });

  test("custom account names are normalized: trimmed, capitalized, matched to catalogue casing", async () => {
    await seedMasterData();
    const { token } = await registerAndLogin();

    const response = await request(app)
      .post("/api/accounts")
      .set(authHeader(token))
      .send({ name: "  mcb bank  ", currency: "PKR", openingBalance: 0 });

    expect(response.status).toBe(201);
    expect(response.body.data.name).toBe("MCB Bank");
    expect(response.body.data.isCustom).toBe(false);

    const custom = await request(app)
      .post("/api/accounts")
      .set(authHeader(token))
      .send({ name: "my    personal fund", currency: "PKR", openingBalance: 0 });

    expect(custom.status).toBe(201);
    expect(custom.body.data.name).toBe("My Personal Fund");
    expect(custom.body.data.isCustom).toBe(true);
  });

  test("rejects empty, numeric-only, and too-long custom account names", async () => {
    const { token } = await registerAndLogin();

    const empty = await request(app)
      .post("/api/accounts")
      .set(authHeader(token))
      .send({ name: "   ", currency: "PKR" });
    expect(empty.status).toBe(400);

    const numeric = await request(app)
      .post("/api/accounts")
      .set(authHeader(token))
      .send({ name: "12345", currency: "PKR" });
    expect(numeric.status).toBe(400);

    const tooLong = await request(app)
      .post("/api/accounts")
      .set(authHeader(token))
      .send({ name: "a".repeat(51), currency: "PKR" });
    expect(tooLong.status).toBe(400);
  });

  test("duplicate custom account names are rejected case-insensitively", async () => {
    const { token } = await registerAndLogin();

    await request(app)
      .post("/api/accounts")
      .set(authHeader(token))
      .send({ name: "Cash Wallet", currency: "PKR" });

    const duplicate = await request(app)
      .post("/api/accounts")
      .set(authHeader(token))
      .send({ name: "cash wallet", currency: "PKR" });

    expect(duplicate.status).toBe(409);
  });

  test("bulk creates multiple accounts, skipping duplicates", async () => {
    await seedMasterData();
    const { token } = await registerAndLogin();

    const master = await request(app)
      .get("/api/master-data/accounts")
      .set(authHeader(token));
    const jazzCash = master.body.data.find((a) => a.name === "JazzCash");

    const response = await request(app)
      .post("/api/accounts/bulk")
      .set(authHeader(token))
      .send({
        items: [
          { masterAccountId: jazzCash._id },
          { name: "My Custom Fund" },
          { masterAccountId: jazzCash._id },
        ],
      });

    expect(response.status).toBe(201);
    expect(response.body.data.created).toHaveLength(2);
    expect(response.body.data.skipped).toHaveLength(1);
  });

  test("bulk creates multiple categories with validation and dedupe", async () => {
    await seedMasterData();
    const { token } = await registerAndLogin();

    const response = await request(app)
      .post("/api/categories/bulk")
      .set(authHeader(token))
      .send({
        items: [
          { name: "Groceries", type: "expense" },
          { name: "  gaming  ", type: "expense" },
          { name: "123", type: "expense" },
        ],
      });

    expect(response.status).toBe(201);
    expect(response.body.data.created).toHaveLength(2);
    expect(response.body.data.skipped).toHaveLength(1);
    expect(response.body.data.created.map((c) => c.name).sort()).toEqual([
      "Gaming",
      "Groceries",
    ]);
  });
});
