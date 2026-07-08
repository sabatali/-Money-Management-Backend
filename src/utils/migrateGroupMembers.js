const Group = require("../models/group.model");
const GroupMember = require("../models/groupMember.model");
const GroupExpense = require("../models/groupExpense.model");
const GroupTransfer = require("../models/groupTransfer.model");

/**
 * One-time (but idempotent, safe to run on every boot) backfill that
 * introduces the GroupMember collection for groups created before Guest
 * Member support existed.
 *
 * For every group:
 *  1. Ensure a GroupMember doc exists for each embedded (legacy) member.
 *  2. Rewrite GroupExpense/GroupTransfer references that still point at
 *     raw User ids so they point at the canonical GroupMember id instead.
 *
 * Step 2 only touches documents that haven't been migrated yet (detected
 * by checking whether the stored id already resolves to a GroupMember),
 * so this is cheap and safe to run repeatedly.
 */
const migrateGroupMembers = async () => {
  const groups = await Group.find({}).select("_id members createdAt");
  if (groups.length === 0) return;

  let createdMembers = 0;
  let rewiredExpenses = 0;
  let rewiredTransfers = 0;

  for (const group of groups) {
    const userIdToMemberId = new Map();

    for (const embeddedMember of group.members || []) {
      const userId = String(embeddedMember.user);
      let member = await GroupMember.findOne({ group: group._id, user: userId });
      if (!member) {
        member = await GroupMember.create({
          group: group._id,
          memberType: "registered",
          user: userId,
          role: embeddedMember.role || "member",
          claimed: true,
          joinedAt: group.createdAt || new Date(),
        });
        createdMembers += 1;
      }
      userIdToMemberId.set(userId, String(member._id));
    }

    if (userIdToMemberId.size === 0) continue;

    const knownMemberIds = new Set(Array.from(userIdToMemberId.values()));

    const expenses = await GroupExpense.find({ group: group._id });
    for (const expense of expenses) {
      let dirty = false;

      if (!knownMemberIds.has(String(expense.paidBy)) && userIdToMemberId.has(String(expense.paidBy))) {
        expense.paidBy = userIdToMemberId.get(String(expense.paidBy));
        dirty = true;
      }

      expense.splits.forEach((split) => {
        const splitUserId = String(split.user);
        if (!knownMemberIds.has(splitUserId) && userIdToMemberId.has(splitUserId)) {
          split.user = userIdToMemberId.get(splitUserId);
          dirty = true;
        }
      });

      if (dirty) {
        await expense.save();
        rewiredExpenses += 1;
      }
    }

    const transfers = await GroupTransfer.find({ group: group._id });
    for (const transfer of transfers) {
      let dirty = false;

      const fromId = String(transfer.fromUser);
      if (!knownMemberIds.has(fromId) && userIdToMemberId.has(fromId)) {
        transfer.fromUser = userIdToMemberId.get(fromId);
        dirty = true;
      }

      const toId = String(transfer.toUser);
      if (!knownMemberIds.has(toId) && userIdToMemberId.has(toId)) {
        transfer.toUser = userIdToMemberId.get(toId);
        dirty = true;
      }

      if (dirty) {
        await transfer.save();
        rewiredTransfers += 1;
      }
    }
  }

  if (createdMembers || rewiredExpenses || rewiredTransfers) {
    console.log(
      `[migrateGroupMembers] Backfilled ${createdMembers} member record(s), rewired ${rewiredExpenses} expense(s) and ${rewiredTransfers} transfer(s).`
    );
  }
};

module.exports = migrateGroupMembers;
