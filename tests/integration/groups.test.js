const { request, registerAndLogin, authHeader } = require("../helpers");

describe("Groups and group expenses API", () => {
  test("creates a group and calculates equal-split balances", async () => {
    const userOne = await registerAndLogin({
      name: "Alice",
      email: "alice@example.com",
      password: "password123",
    });
    const userTwo = await registerAndLogin({
      name: "Bob",
      email: "bob@example.com",
      password: "password123",
    });

    const groupResponse = await request(require("../../src/app"))
      .post("/api/groups")
      .set(authHeader(userOne.token))
      .send({ name: "Roommates" });

    expect(groupResponse.status).toBe(201);
    const groupId = groupResponse.body.data._id;

    const addMemberResponse = await request(require("../../src/app"))
      .post(`/api/groups/${groupId}/members`)
      .set(authHeader(userOne.token))
      .send({ email: "bob@example.com" });

    expect(addMemberResponse.status).toBe(200);

    await request(require("../../src/app"))
      .post("/api/accounts")
      .set(authHeader(userOne.token))
      .send({ name: "Alice Cash", currency: "PKR", openingBalance: 5000 });

    await request(require("../../src/app"))
      .post(`/api/groups/${groupId}/link-accounts`)
      .set(authHeader(userOne.token))
      .send({ accounts: ["Alice Cash"] });

    const expenseResponse = await request(require("../../src/app"))
      .post("/api/group-expenses")
      .set(authHeader(userOne.token))
      .send({
        group: groupId,
        title: "Groceries",
        totalAmountOriginal: 600,
        currency: "PKR",
        paidBy: userOne.user.id,
        splitType: "EQUAL",
        accountUsed: "Alice Cash",
        date: "2026-01-20",
      });

    expect(expenseResponse.status).toBe(201);

    const balancesResponse = await request(require("../../src/app"))
      .get(`/api/groups/${groupId}/balances`)
      .set(authHeader(userOne.token));

    expect(balancesResponse.status).toBe(200);

    const aliceBalance = balancesResponse.body.data.find(
      (item) => String(item.userId) === String(userOne.user.id)
    );
    const bobBalance = balancesResponse.body.data.find(
      (item) => String(item.userId) === String(userTwo.user.id)
    );

    expect(aliceBalance.balance).toBe(300);
    expect(bobBalance.balance).toBe(-300);
  });

  test("blocks non-members from viewing group details", async () => {
    const owner = await registerAndLogin({
      name: "Owner",
      email: "owner@example.com",
      password: "password123",
    });
    const outsider = await registerAndLogin({
      name: "Outsider",
      email: "outsider@example.com",
      password: "password123",
    });

    const groupResponse = await request(require("../../src/app"))
      .post("/api/groups")
      .set(authHeader(owner.token))
      .send({ name: "Private Group" });

    const groupId = groupResponse.body.data._id;

    const response = await request(require("../../src/app"))
      .get(`/api/groups/${groupId}`)
      .set(authHeader(outsider.token));

    expect(response.status).toBe(403);
  });

  test("rejects manual splits that do not match total amount", async () => {
    const { token, user } = await registerAndLogin({
      name: "Solo",
      email: "solo@example.com",
      password: "password123",
    });

    const groupResponse = await request(require("../../src/app"))
      .post("/api/groups")
      .set(authHeader(token))
      .send({ name: "Solo Group" });

    const groupId = groupResponse.body.data._id;

    await request(require("../../src/app"))
      .post("/api/accounts")
      .set(authHeader(token))
      .send({ name: "Main", currency: "PKR", openingBalance: 1000 });

    await request(require("../../src/app"))
      .post(`/api/groups/${groupId}/link-accounts`)
      .set(authHeader(token))
      .send({ accounts: ["Main"] });

    const response = await request(require("../../src/app"))
      .post("/api/group-expenses")
      .set(authHeader(token))
      .send({
        group: groupId,
        title: "Dinner",
        totalAmountOriginal: 500,
        currency: "PKR",
        paidBy: user.id,
        splitType: "MANUAL",
        splits: [{ user: user.id, shareAmountPKR: 100 }],
        accountUsed: "Main",
        date: "2026-01-21",
      });

    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/manual split amounts must match total amount/i);
  });

  test("deducts full payment from payer account and records only share in expense history", async () => {
    const app = require("../../src/app");
    const userA = await registerAndLogin({
      name: "A",
      email: "a-food@example.com",
      password: "password123",
    });
    const userB = await registerAndLogin({
      name: "B",
      email: "b-food@example.com",
      password: "password123",
    });

    const groupResponse = await request(app)
      .post("/api/groups")
      .set(authHeader(userA.token))
      .send({ name: "Food Group" });
    const groupId = groupResponse.body.data._id;

    await request(app)
      .post(`/api/groups/${groupId}/members`)
      .set(authHeader(userA.token))
      .send({ email: "b-food@example.com" });

    await request(app)
      .post("/api/accounts")
      .set(authHeader(userA.token))
      .send({ name: "Wallet", currency: "PKR", openingBalance: 3500 });

    await request(app)
      .post(`/api/groups/${groupId}/link-accounts`)
      .set(authHeader(userA.token))
      .send({ accounts: ["Wallet"] });

    const expenseResponse = await request(app)
      .post("/api/group-expenses")
      .set(authHeader(userA.token))
      .send({
        group: groupId,
        title: "Food",
        totalAmountOriginal: 1000,
        currency: "PKR",
        paidBy: userA.user.id,
        splitType: "EQUAL",
        accountUsed: "Wallet",
        date: "2026-02-01",
      });

    expect(expenseResponse.status).toBe(201);

    const accountBalances = await request(app)
      .get("/api/accounts/balances")
      .set(authHeader(userA.token));
    expect(accountBalances.body.data[0].currentBalancePKR).toBe(2500);

    const transactions = await request(app)
      .get("/api/transactions")
      .set(authHeader(userA.token));
    const historyExpenses = transactions.body.data.filter(
      (tx) => tx.type === "expense" && tx.countInExpenseHistory !== false
    );
    expect(historyExpenses).toHaveLength(1);
    expect(historyExpenses[0].amountPKR).toBe(500);

    const groupBalances = await request(app)
      .get(`/api/groups/${groupId}/balances`)
      .set(authHeader(userA.token));
    const aBalance = groupBalances.body.data.find(
      (item) => String(item.userId) === String(userA.user.id)
    );
    const bBalance = groupBalances.body.data.find(
      (item) => String(item.userId) === String(userB.user.id)
    );
    expect(aBalance.balance).toBe(500);
    expect(bBalance.balance).toBe(-500);
  });

  test("moves money between accounts only when receiver accepts settlement", async () => {
    const app = require("../../src/app");
    const userA = await registerAndLogin({
      name: "A",
      email: "a-settle@example.com",
      password: "password123",
    });
    const userB = await registerAndLogin({
      name: "B",
      email: "b-settle@example.com",
      password: "password123",
    });

    const groupResponse = await request(app)
      .post("/api/groups")
      .set(authHeader(userA.token))
      .send({ name: "Settle Group" });
    const groupId = groupResponse.body.data._id;

    await request(app)
      .post(`/api/groups/${groupId}/members`)
      .set(authHeader(userA.token))
      .send({ email: "b-settle@example.com" });

    await request(app)
      .post("/api/accounts")
      .set(authHeader(userA.token))
      .send({ name: "A Wallet", currency: "PKR", openingBalance: 5000 });

    await request(app)
      .post("/api/accounts")
      .set(authHeader(userB.token))
      .send({ name: "B Wallet", currency: "PKR", openingBalance: 2000 });

    await request(app)
      .post(`/api/groups/${groupId}/link-accounts`)
      .set(authHeader(userA.token))
      .send({ accounts: ["A Wallet"] });

    await request(app)
      .post(`/api/groups/${groupId}/link-accounts`)
      .set(authHeader(userB.token))
      .send({ accounts: ["B Wallet"] });

    const transferResponse = await request(app)
      .post(`/api/groups/${groupId}/transfers`)
      .set(authHeader(userB.token))
      .send({
        fromUser: userB.user.id,
        toUser: userA.user.id,
        amountPKR: 500,
        account: "B Wallet",
        date: "2026-02-02",
      });

    expect(transferResponse.status).toBe(201);

    const bBefore = await request(app)
      .get("/api/accounts/balances")
      .set(authHeader(userB.token));
    expect(bBefore.body.data[0].currentBalancePKR).toBe(2000);

    const confirmResponse = await request(app)
      .post(`/api/groups/${groupId}/transfers/${transferResponse.body.data._id}/confirm`)
      .set(authHeader(userA.token))
      .send({ toAccount: "A Wallet" });

    expect(confirmResponse.status).toBe(200);

    const aAfter = await request(app)
      .get("/api/accounts/balances")
      .set(authHeader(userA.token));
    const bAfter = await request(app)
      .get("/api/accounts/balances")
      .set(authHeader(userB.token));

    expect(aAfter.body.data[0].currentBalancePKR).toBe(5500);
    expect(bAfter.body.data[0].currentBalancePKR).toBe(1500);

    const aTransactions = await request(app)
      .get("/api/transactions")
      .set(authHeader(userA.token));
    const bTransactions = await request(app)
      .get("/api/transactions")
      .set(authHeader(userB.token));

    const aSettlement = aTransactions.body.data.find((tx) => tx.category === "Group Settlement");
    const bSettlement = bTransactions.body.data.find((tx) => tx.category === "Group Settlement");

    expect(aSettlement.type).toBe("income");
    expect(aSettlement.countInIncomeHistory).toBe(false);
    expect(bSettlement.type).toBe("expense");
    expect(bSettlement.countInExpenseHistory).toBe(false);
  });
});
