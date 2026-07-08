const { request, registerAndLogin, authHeader } = require("../helpers");
const app = require("../../src/app");

describe("Group guest members", () => {
  test("admin can add a guest, who appears in the unified member list", async () => {
    const owner = await registerAndLogin({
      name: "Sabat",
      email: "sabat@example.com",
      password: "password123",
    });

    const groupResponse = await request(app)
      .post("/api/groups")
      .set(authHeader(owner.token))
      .send({ name: "Roommates" });
    const groupId = groupResponse.body.data._id;

    const guestResponse = await request(app)
      .post(`/api/groups/${groupId}/members/guest`)
      .set(authHeader(owner.token))
      .send({ name: "  ali raza  ", email: "ali@example.com", phone: "+923001234567", notes: "Roommate" });

    expect(guestResponse.status).toBe(201);
    expect(guestResponse.body.member.name).toBe("Ali Raza");
    expect(guestResponse.body.member.memberType).toBe("guest");
    expect(guestResponse.body.member.userId).toBeNull();

    const groupDetails = await request(app)
      .get(`/api/groups/${groupId}`)
      .set(authHeader(owner.token));

    expect(groupDetails.body.data.groupMembers).toHaveLength(2);
    const guestEntry = groupDetails.body.data.groupMembers.find((m) => m.memberType === "guest");
    expect(guestEntry.name).toBe("Ali Raza");
    expect(guestEntry.role).toBe("member");
  });

  test("rejects duplicate guest names (case-insensitive) within the same group", async () => {
    const owner = await registerAndLogin({
      name: "Owner",
      email: "dup-owner@example.com",
      password: "password123",
    });
    const groupResponse = await request(app)
      .post("/api/groups")
      .set(authHeader(owner.token))
      .send({ name: "Dup Group" });
    const groupId = groupResponse.body.data._id;

    await request(app)
      .post(`/api/groups/${groupId}/members/guest`)
      .set(authHeader(owner.token))
      .send({ name: "Ahmad" });

    const duplicateResponse = await request(app)
      .post(`/api/groups/${groupId}/members/guest`)
      .set(authHeader(owner.token))
      .send({ name: "  AHMAD " });

    expect(duplicateResponse.status).toBe(400);
    expect(duplicateResponse.body.message).toMatch(/already exists/i);
  });

  test("equal split includes guests exactly like registered members", async () => {
    const owner = await registerAndLogin({
      name: "Sabat",
      email: "sabat-split@example.com",
      password: "password123",
    });
    const groupResponse = await request(app)
      .post("/api/groups")
      .set(authHeader(owner.token))
      .send({ name: "Split Group" });
    const groupId = groupResponse.body.data._id;

    await request(app)
      .post(`/api/groups/${groupId}/members/guest`)
      .set(authHeader(owner.token))
      .send({ name: "Ali" });
    await request(app)
      .post(`/api/groups/${groupId}/members/guest`)
      .set(authHeader(owner.token))
      .send({ name: "Ahmad" });

    await request(app)
      .post("/api/accounts")
      .set(authHeader(owner.token))
      .send({ name: "Wallet", currency: "PKR", openingBalance: 5000 });
    await request(app)
      .post(`/api/groups/${groupId}/link-accounts`)
      .set(authHeader(owner.token))
      .send({ accounts: ["Wallet"] });

    const expenseResponse = await request(app)
      .post("/api/group-expenses")
      .set(authHeader(owner.token))
      .send({
        group: groupId,
        title: "Groceries",
        totalAmountOriginal: 4000,
        currency: "PKR",
        paidBy: owner.user.id,
        splitType: "EQUAL",
        accountUsed: "Wallet",
        date: "2026-03-01",
      });

    expect(expenseResponse.status).toBe(201);
    const splits = expenseResponse.body.data.splits;
    expect(splits).toHaveLength(3);
    splits.forEach((split) => {
      expect(Math.round(split.shareAmountPKR)).toBeGreaterThanOrEqual(1333);
    });
    const guestSplit = splits.find((split) => split.user.memberType === "guest");
    expect(guestSplit).toBeTruthy();
    expect(guestSplit.user.name).toBe("Ali");

    const balancesResponse = await request(app)
      .get(`/api/groups/${groupId}/balances`)
      .set(authHeader(owner.token));

    const guestBalance = balancesResponse.body.data.find((item) => item.memberType === "guest" && item.user === "Ali");
    expect(guestBalance.balance).toBeCloseTo(-1333.33, 1);
    expect(guestBalance.userId).toBeNull();
  });

  test("recording a guest's payment auto-confirms without a personal ledger entry for the guest", async () => {
    const owner = await registerAndLogin({
      name: "Sabat",
      email: "sabat-settle@example.com",
      password: "password123",
    });
    const groupResponse = await request(app)
      .post("/api/groups")
      .set(authHeader(owner.token))
      .send({ name: "Settle Group" });
    const groupId = groupResponse.body.data._id;

    const guestResponse = await request(app)
      .post(`/api/groups/${groupId}/members/guest`)
      .set(authHeader(owner.token))
      .send({ name: "Ali" });
    const guestMemberId = guestResponse.body.member.memberId;

    await request(app)
      .post("/api/accounts")
      .set(authHeader(owner.token))
      .send({ name: "Wallet", currency: "PKR", openingBalance: 5000 });
    await request(app)
      .post(`/api/groups/${groupId}/link-accounts`)
      .set(authHeader(owner.token))
      .send({ accounts: ["Wallet"] });

    const transferResponse = await request(app)
      .post(`/api/groups/${groupId}/transfers`)
      .set(authHeader(owner.token))
      .send({
        fromUser: guestMemberId,
        toUser: owner.user.id,
        amountPKR: 500,
        toAccount: "Wallet",
        date: "2026-03-02",
      });

    expect(transferResponse.status).toBe(201);
    expect(transferResponse.body.data.status).toBe("Confirmed");
    expect(transferResponse.body.data.fromUser.memberType).toBe("guest");

    const ownerBalances = await request(app)
      .get("/api/accounts/balances")
      .set(authHeader(owner.token));
    expect(ownerBalances.body.data[0].currentBalancePKR).toBe(5500);

    const transactions = await request(app)
      .get("/api/transactions")
      .set(authHeader(owner.token));
    const settlementTx = transactions.body.data.filter((tx) => tx.category === "Group Settlement");
    // Only the registered receiver gets a personal ledger entry; the guest has none.
    expect(settlementTx).toHaveLength(1);
    expect(settlementTx[0].type).toBe("income");
  });

  test("invite requires an email, then a guest can claim their profile after registering", async () => {
    const owner = await registerAndLogin({
      name: "Sabat",
      email: "sabat-claim@example.com",
      password: "password123",
    });
    const groupResponse = await request(app)
      .post("/api/groups")
      .set(authHeader(owner.token))
      .send({ name: "Claim Group" });
    const groupId = groupResponse.body.data._id;

    const guestResponse = await request(app)
      .post(`/api/groups/${groupId}/members/guest`)
      .set(authHeader(owner.token))
      .send({ name: "Ali" });
    const guestMemberId = guestResponse.body.member.memberId;

    const inviteWithoutEmail = await request(app)
      .post(`/api/groups/${groupId}/members/${guestMemberId}/invite`)
      .set(authHeader(owner.token))
      .send({});
    expect(inviteWithoutEmail.status).toBe(400);

    const inviteWithEmail = await request(app)
      .post(`/api/groups/${groupId}/members/${guestMemberId}/invite`)
      .set(authHeader(owner.token))
      .send({ email: "ali-claim@example.com" });
    expect(inviteWithEmail.status).toBe(200);

    // Guest registers a real LibraMate account with the matching email.
    const guestUser = await registerAndLogin({
      name: "Ali Raza",
      email: "ali-claim@example.com",
      password: "password123",
    });

    const pendingClaims = await request(app)
      .get("/api/group-members/pending-claims")
      .set(authHeader(guestUser.token));
    expect(pendingClaims.status).toBe(200);
    expect(pendingClaims.body.data).toHaveLength(1);
    expect(pendingClaims.body.data[0].memberId).toBe(guestMemberId);

    const claimResponse = await request(app)
      .post(`/api/group-members/${guestMemberId}/claim`)
      .set(authHeader(guestUser.token))
      .send({});
    expect(claimResponse.status).toBe(200);
    expect(claimResponse.body.data.memberType).toBe("registered");
    expect(claimResponse.body.data.userId).toBe(guestUser.user.id);

    // The (previously guest) user now shows up in the group's own list.
    const guestGroups = await request(app)
      .get("/api/groups")
      .set(authHeader(guestUser.token));
    expect(guestGroups.body.data.some((g) => String(g._id) === String(groupId))).toBe(true);
  });
});
