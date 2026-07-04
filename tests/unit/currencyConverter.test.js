jest.mock("../../src/models/setting.model");

const Setting = require("../../src/models/setting.model");
const { convertToPKR, getUsdToPkrRate } = require("../../src/utils/currencyConverter");

describe("currencyConverter", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test("returns PKR amounts unchanged", async () => {
    expect(await convertToPKR(1500, "PKR", "user1")).toBe(1500);
  });

  test("converts USD using user setting", async () => {
    Setting.findOne.mockResolvedValue({ value: 300 });
    expect(await getUsdToPkrRate("user1")).toBe(300);
    expect(await convertToPKR(2, "USD", "user1")).toBe(600);
  });

  test("throws when exchange rate is not configured", async () => {
    Setting.findOne.mockResolvedValue(null);
    await expect(getUsdToPkrRate("user1")).rejects.toThrow("Exchange rate not configured");
  });

  test("returns 0 for invalid amounts", async () => {
    expect(await convertToPKR(NaN, "PKR", "user1")).toBe(0);
    expect(await convertToPKR(undefined, "USD", "user1")).toBe(0);
  });

  test("passes through unknown currencies as-is", async () => {
    expect(await convertToPKR(100, "EUR", "user1")).toBe(100);
  });
});
