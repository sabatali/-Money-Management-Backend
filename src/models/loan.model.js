const mongoose = require("mongoose");

const loanSchema = new mongoose.Schema(
  {
    person: { type: String, required: true, trim: true },
    amountPKR: { type: Number, required: true },
    type: { type: String, enum: ["Lent", "Borrowed"], default: "Lent" },
    fromAccount: { type: String, trim: true },
    toAccount: { type: String, trim: true },
    status: { type: String, enum: ["Pending", "Returned"], default: "Pending" },
    dateGiven: { type: Date, required: true },
    dateReturned: { type: Date },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true, versionKey: false }
);

module.exports = mongoose.model("Loan", loanSchema);
