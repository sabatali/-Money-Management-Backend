const { request, registerAndLogin, authHeader } = require("../helpers");

describe("Transfers API", () => {
  test("moves balance between accounts and records transfer fee expense", async () => {
    const { token } = await registerAndLogin();

    await request(require("../../src/app"))
      .post("/api/accounts")
      .set(authHeader(token))
      .send({ name: "Bank", currency: "PKR", openingBalance: 5000 });

    await request(require("../../src/app"))
      .post("/api/accounts")
      .set(authHeader(token))
      .send({ name: "Wallet", currency: "PKR", openingBalance: 0 });

    const transferResponse = await request(require("../../src/app"))
      .post("/api/transfers")
      .set(authHeader(token))
      .send({
        date: "2026-02-01",
        fromAccount: "Bank",
        toAccount: "Wallet",
        amountOriginal: 1000,
        currency: "PKR",
        fee: 50,
      });

    expect(transferResponse.status).toBe(201);

    const balances = await request(require("../../src/app"))
      .get("/api/accounts/balances")
      .set(authHeader(token));

    const bank = balances.body.data.find((item) => item.name === "Bank");
    const wallet = balances.body.data.find((item) => item.name === "Wallet");

    expect(bank.currentBalancePKR).toBe(3950);
    expect(wallet.currentBalancePKR).toBe(1000);
  });
});

describe("Loans API", () => {
  test("deducts pending lent money from source account", async () => {
    const { token } = await registerAndLogin();

    await request(require("../../src/app"))
      .post("/api/accounts")
      .set(authHeader(token))
      .send({ name: "Cash", currency: "PKR", openingBalance: 3000 });

    const loanResponse = await request(require("../../src/app"))
      .post("/api/loans")
      .set(authHeader(token))
      .send({
        person: "Friend",
        type: "Lent",
        status: "Pending",
        amountPKR: 500,
        fromAccount: "Cash",
        dateGiven: "2026-02-05",
      });

    expect(loanResponse.status).toBe(201);

    const balances = await request(require("../../src/app"))
      .get("/api/accounts/balances")
      .set(authHeader(token));

    expect(balances.body.data[0].currentBalancePKR).toBe(2500);
  });

  test("keeps total balance unchanged when borrowed pending loan is marked returned", async () => {
    const { token } = await registerAndLogin();
    const app = require("../../src/app");

    await request(app)
      .post("/api/accounts")
      .set(authHeader(token))
      .send({ name: "Wallet", currency: "PKR", openingBalance: 3500 });

    const pendingLoan = await request(app)
      .post("/api/loans")
      .set(authHeader(token))
      .send({
        person: "Friend",
        type: "Borrowed",
        status: "Pending",
        amountPKR: 1000,
        toAccount: "Wallet",
        dateGiven: "2026-02-05",
      });

    expect(pendingLoan.status).toBe(201);

    const pendingBalances = await request(app)
      .get("/api/accounts/balances")
      .set(authHeader(token));

    expect(pendingBalances.body.data[0].currentBalancePKR).toBe(4500);

    const returnedLoan = await request(app)
      .put(`/api/loans/${pendingLoan.body.data._id}`)
      .set(authHeader(token))
      .send({
        status: "Returned",
        fromAccount: "Wallet",
        toAccount: "Wallet",
        dateReturned: "2026-02-10",
      });

    expect(returnedLoan.status).toBe(200);

    const returnedBalances = await request(app)
      .get("/api/accounts/balances")
      .set(authHeader(token));

    expect(returnedBalances.body.data[0].currentBalancePKR).toBe(3500);
  });
});
