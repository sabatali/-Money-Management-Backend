const { convertToPKR, getUsdToPkrRate } = require("../../src/utils/currencyConverter");

describe("currencyConverter", () => {
  const originalRate = process.env.USD_TO_PKR_RATE;

  afterEach(() => {
    process.env.USD_TO_PKR_RATE = originalRate;
  });

  test("returns PKR amounts unchanged", () => {
    expect(convertToPKR(1500, "PKR")).toBe(1500);
  });

  test("converts USD using default rate when env is unset", () => {
    delete process.env.USD_TO_PKR_RATE;
    expect(getUsdToPkrRate()).toBe(280);
    expect(convertToPKR(10, "USD")).toBe(2800);
  });

  test("converts USD using env rate override", () => {
    process.env.USD_TO_PKR_RATE = "300";
    expect(getUsdToPkrRate()).toBe(300);
    expect(convertToPKR(2, "USD")).toBe(600);
  });

  test("returns 0 for invalid amounts", () => {
    expect(convertToPKR(NaN, "PKR")).toBe(0);
    expect(convertToPKR(undefined, "USD")).toBe(0);
  });

  test("passes through unknown currencies as-is", () => {
    expect(convertToPKR(100, "EUR")).toBe(100);
  });
});
