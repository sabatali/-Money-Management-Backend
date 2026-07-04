const Group = require("../models/group.model");
const GroupExpense = require("../models/groupExpense.model");
const GroupTransfer = require("../models/groupTransfer.model");
const { calculateBalances } = require("../utils/balanceCalculator");

const ensureMember = (group, userId) =>
  group.members.some((member) => {
    const memberId = member.user?._id || member.user;
    return String(memberId) === String(userId);
  });

const getGroupBalances = async (req, res) => {
  try {
    const group = await Group.findById(req.params.id).populate("members.user", "name email");
    if (!group) {
      return res.status(404).json({ message: "Group not found." });
    }
    if (!ensureMember(group, req.user.id)) {
      return res.status(403).json({
        message: "Access denied.",
        meta: { userId: req.user.id, groupId: req.params.id },
      });
    }

    const expenses = await GroupExpense.find({ group: group._id });
    const transfers = await GroupTransfer.find({ group: group._id });
    const memberIds = group.members.map((member) => member.user._id);

    const balancesMap = calculateBalances({
      members: memberIds,
      expenses,
      transfers,
    });

    const balances = group.members.map((member) => ({
      userId: member.user._id,
      user: member.user.name,
      balance: Math.round((balancesMap[String(member.user._id)] || 0) * 100) / 100,
    }));

    return res.status(200).json({ data: balances });
  } catch (error) {
    return res.status(500).json({ message: "Failed to calculate balances.", error: error.message });
  }
};

module.exports = {
  getGroupBalances,
};
