const Group = require("../models/group.model");
const GroupExpense = require("../models/groupExpense.model");
const GroupTransfer = require("../models/groupTransfer.model");
const { calculateBalances } = require("../utils/balanceCalculator");
const { listGroupMembers } = require("../utils/groupMemberService");

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

    const [expenses, transfers, members] = await Promise.all([
      GroupExpense.find({ group: group._id }),
      GroupTransfer.find({ group: group._id }),
      listGroupMembers(group._id),
    ]);

    const memberIds = members.map((member) => member._id);
    const balancesMap = calculateBalances({ members: memberIds, expenses, transfers });

    const balances = members.map((member) => {
      const isRegistered = member.memberType === "registered";
      return {
        // Kept as the real User._id for registered members so existing
        // clients/tests comparing against `user.id` keep working.
        userId: isRegistered ? String(member.user?._id || member.user) : null,
        memberId: String(member._id),
        user: isRegistered ? member.user?.name || "Member" : member.guestName,
        memberType: member.memberType,
        guestEmail: isRegistered ? null : member.guestEmail || null,
        role: member.role,
        balance: Math.round((balancesMap[String(member._id)] || 0) * 100) / 100,
      };
    });

    return res.status(200).json({ data: balances });
  } catch (error) {
    return res.status(500).json({ message: "Failed to calculate balances.", error: error.message });
  }
};

module.exports = {
  getGroupBalances,
};
