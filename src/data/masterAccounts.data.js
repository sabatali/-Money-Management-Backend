/**
 * Seed catalogue for master accounts. `group` is the human-friendly section
 * label shown in the onboarding UI; `type` is the underlying functional
 * category used for icons/filtering.
 */

const section = (group, type, icon, names) =>
  names.map((name, index) => ({
    name,
    group,
    type,
    icon,
    country: "PK",
    sortOrder: index,
  }));

const masterAccounts = [
  ...section("Cash", "cash", "💵", ["Cash Wallet"]),

  ...section("Pakistani Banks", "bank", "🏦", [
    "HBL",
    "UBL",
    "MCB Bank",
    "Allied Bank",
    "Meezan Bank",
    "Bank Alfalah",
    "Askari Bank",
    "Bank Al Habib",
    "Faysal Bank",
    "Habib Metro",
    "JS Bank",
    "Soneri Bank",
    "Standard Chartered Pakistan",
    "Bank of Punjab",
    "National Bank of Pakistan",
    "Silkbank",
    "Summit Bank",
  ]),

  ...section("Digital Wallets", "wallet", "📱", [
    "JazzCash",
    "Easypaisa",
    "NayaPay",
    "SadaPay",
    "Zindigi",
    "UPaisa",
  ]),

  ...section("International Accounts", "international", "🌍", [
    "Payoneer",
    "Wise",
    "PayPal",
    "Stripe Balance",
  ]),

  ...section("Crypto Wallet", "crypto", "🪙", [
    "Binance",
    "Bybit",
    "OKX",
    "MetaMask",
    "Trust Wallet",
  ]),

  ...section("Credit Cards", "credit_card", "💳", [
    "HBL Credit Card",
    "Meezan Credit Card",
    "UBL Credit Card",
  ]),
].map((item, index) => ({ ...item, sortOrder: index }));

module.exports = masterAccounts;
