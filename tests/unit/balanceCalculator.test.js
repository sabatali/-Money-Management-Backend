const { calculateBalances } = require("../../src/utils/balanceCalculator");

describe("balanceCalculator", () => {
  const memberA = "user-a";
  const memberB = "user-b";
  const memberC = "user-c";
  const members = [memberA, memberB, memberC];

  test("returns zero balances for members with no activity", () => {
    const balances = calculateBalances({ members, expenses: [], transfers: [] });

    expect(balances[memberA]).toBe(0);
    expect(balances[memberB]).toBe(0);
    expect(balances[memberC]).toBe(0);
  });

  test("credits payer and debits split members for an expense", () => {
    const balances = calculateBalances({
      members,
      expenses: [
        {
          paidBy: memberA,
          totalAmountPKR: 300,
          splits: [
            { user: memberA, shareAmountPKR: 100 },
            { user: memberB, shareAmountPKR: 100 },
            { user: memberC, shareAmountPKR: 100 },
          ],
        },
      ],
      transfers: [],
    });

    expect(balances[memberA]).toBe(200);
    expect(balances[memberB]).toBe(-100);
    expect(balances[memberC]).toBe(-100);
  });

  test("ignores pending and rejected transfers", () => {
    const balances = calculateBalances({
      members: [memberA, memberB],
      expenses: [],
      transfers: [
        {
          fromUser: memberA,
          toUser: memberB,
          amountPKR: 500,
          status: "Pending",
        },
        {
          fromUser: memberA,
          toUser: memberB,
          amountPKR: 200,
          status: "Rejected",
        },
      ],
    });

    expect(balances[memberA]).toBe(0);
    expect(balances[memberB]).toBe(0);
  });

  test("applies confirmed transfers to balances", () => {
    const balances = calculateBalances({
      members: [memberA, memberB],
      expenses: [],
      transfers: [
        {
          fromUser: memberA,
          toUser: memberB,
          amountPKR: 150,
          status: "Confirmed",
        },
      ],
    });

    expect(balances[memberA]).toBe(150);
    expect(balances[memberB]).toBe(-150);
  });

  test("treats transfers without status as confirmed", () => {
    const balances = calculateBalances({
      members: [memberA, memberB],
      expenses: [],
      transfers: [
        {
          fromUser: memberA,
          toUser: memberB,
          amountPKR: 75,
        },
      ],
    });

    expect(balances[memberA]).toBe(75);
    expect(balances[memberB]).toBe(-75);
  });

  test("combines expenses and confirmed transfers", () => {
    const balances = calculateBalances({
      members: [memberA, memberB],
      expenses: [
        {
          paidBy: memberA,
          totalAmountPKR: 1000,
          splits: [
            { user: memberA, shareAmountPKR: 500 },
            { user: memberB, shareAmountPKR: 500 },
          ],
        },
      ],
      transfers: [
        {
          fromUser: memberB,
          toUser: memberA,
          amountPKR: 200,
          status: "Confirmed",
        },
      ],
    });

    expect(balances[memberA]).toBe(300);
    expect(balances[memberB]).toBe(-300);
  });
});
