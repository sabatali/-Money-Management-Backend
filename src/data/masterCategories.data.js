/**
 * Seed catalogue for master categories, grouped for the onboarding UI.
 */

const section = (group, type, icon, color, names) =>
  names.map((name, index) => ({
    name,
    group,
    type,
    icon,
    color,
    sortOrder: index,
  }));

const masterCategories = [
  ...section("Hostel & Accommodation", "expense", "🏠", "#f59e0b", [
    "Room Rent",
    "Hostel Rent",
    "Mess Charges",
    "Hostel Maintenance",
    "Laundry",
    "Room Cleaning",
    "Electricity (Hostel)",
    "Water Charges",
    "Other Hostel Expenses",
  ]),

  ...section("Food", "expense", "🍔", "#f87171", [
    "Mess Food",
    "Groceries",
    "Fast Food",
    "Cafeteria",
    "Tea / Coffee",
  ]),

  ...section("Transportation", "expense", "🚌", "#60a5fa", [
    "University Transport",
    "Ride Hailing",
    "Public Transport",
    "Fuel",
    "Rickshaw / Bike Ride",
  ]),

  ...section("Education", "expense", "📚", "#818cf8", [
    "Tuition Fee",
    "Semester Fee",
    "Books",
    "Stationery",
    "Printing / Photocopy",
    "Online Courses",
  ]),

  ...section("Health", "expense", "💊", "#34d399", [
    "Medicine",
    "Doctor Visit",
    "Emergency",
    "Gym / Fitness",
  ]),

  ...section("Student Lifestyle", "expense", "🎮", "#c084fc", [
    "Mobile Recharge",
    "Internet Package",
    "Subscriptions",
    "Gaming",
    "Social Activities",
  ]),

  ...section("Shopping", "expense", "🛍️", "#fb923c", [
    "Clothes",
    "Electronics",
    "Personal Items",
  ]),

  ...section("Bills", "expense", "🧾", "#38bdf8", [
    "Mobile Bill",
    "Internet Bill",
    "Electricity (Personal)",
    "Gas",
  ]),

  ...section("Freelancing / Student Work", "expense", "💻", "#2dd4bf", [
    "Software",
    "AI Tools",
    "Hosting",
    "Domains",
    "Equipment",
    "Internet Tools",
  ]),

  ...section("Travel", "expense", "✈️", "#a3e635", [
    "Trips",
    "Bus / Train Tickets",
    "Local Travel",
  ]),

  ...section("Other", "expense", "🔖", "#94a3b8", [
    "Gifts",
    "Charity",
    "Miscellaneous",
  ]),

  ...section("Income", "income", "💰", "#2dd4bf", [
    "Pocket Money (Parents)",
    "Scholarship",
    "Stipend",
    "Freelance Income",
    "Client Payment",
    "Part-Time Job",
    "Internship Salary",
    "Tuition Teaching",
    "Online Earnings (Fiverr / Upwork)",
    "YouTube / Content Income",
    "Affiliate Income",
    "Prize / Competition Winning",
    "Gift Received",
    "Refund",
    "Other Income",
  ]),
].map((item, index) => ({ ...item, sortOrder: index }));

module.exports = masterCategories;
