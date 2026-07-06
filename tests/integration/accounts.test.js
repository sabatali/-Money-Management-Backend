const { request, registerAndLogin, authHeader, setExchangeRate } = require("../helpers");

describe("Accounts API", () => {
  test("creates, lists, updates, and deletes an account", async () => {
    const { token } = await registerAndLogin();

    const createResponse = await request(require("../../src/app"))
      .post("/api/accounts")
      .set(authHeader(token))
      .send({ name: "Cash", currency: "PKR", openingBalance: 1000 });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.data.name).toBe("Cash");

    const listResponse = await request(require("../../src/app"))
      .get("/api/accounts")
      .set(authHeader(token));

    expect(listResponse.status).toBe(200);
    expect(listResponse.body.data).toHaveLength(1);

    const accountId = createResponse.body.data._id;
    const updateResponse = await request(require("../../src/app"))
      .put(`/api/accounts/${accountId}`)
      .set(authHeader(token))
      .send({ name: "Wallet" });

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.data.name).toBe("Wallet");

    const deleteResponse = await request(require("../../src/app"))
      .delete(`/api/accounts/${accountId}`)
      .set(authHeader(token));

    expect(deleteResponse.status).toBe(200);

    const afterDelete = await request(require("../../src/app"))
      .get("/api/accounts")
      .set(authHeader(token));

    expect(afterDelete.body.data).toHaveLength(0);
  });

  test("rejects duplicate account names for the same user", async () => {
    const { token } = await registerAndLogin();

    await request(require("../../src/app"))
      .post("/api/accounts")
      .set(authHeader(token))
      .send({ name: "Cash", currency: "PKR", openingBalance: 0 });

    const duplicate = await request(require("../../src/app"))
      .post("/api/accounts")
      .set(authHeader(token))
      .send({ name: "Cash", currency: "PKR", openingBalance: 0 });

    expect(duplicate.status).toBe(409);
  });

  test("converts USD opening balance to PKR", async () => {
    const { token } = await registerAndLogin();

    await setExchangeRate(token, 280);

    const response = await request(require("../../src/app"))
      .post("/api/accounts")
      .set(authHeader(token))
      .send({ name: "USD Account", currency: "USD", openingBalance: 10 });

    expect(response.status).toBe(201);
    expect(response.body.data.openingBalancePKR).toBe(2800);
  });

  test("calculates balances after income and expense transactions", async () => {
    const { token } = await registerAndLogin();

    await request(require("../../src/app"))
      .post("/api/accounts")
      .set(authHeader(token))
      .send({ name: "Cash", currency: "PKR", openingBalance: 1000 });

    await request(require("../../src/app"))
      .post("/api/transactions")
      .set(authHeader(token))
      .send({
        date: "2026-01-15",
        type: "income",
        category: "Salary",
        amount: 500,
        currency: "PKR",
        account: "Cash",
      });

    await request(require("../../src/app"))
      .post("/api/transactions")
      .set(authHeader(token))
      .send({
        date: "2026-01-16",
        type: "expense",
        category: "Food",
        amount: 200,
        currency: "PKR",
        account: "Cash",
      });

    const balances = await request(require("../../src/app"))
      .get("/api/accounts/balances")
      .set(authHeader(token));

    expect(balances.status).toBe(200);
    expect(balances.body.data[0].currentBalancePKR).toBe(1300);
  });
});
