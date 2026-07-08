const User = require("../models/user.model");
const Group = require("../models/group.model");
const GroupMember = require("../models/groupMember.model");
const { serializeMemberFull } = require("../utils/groupMemberService");

/**
 * Cross-group check: "does the currently logged-in user's email match any
 * unclaimed guest profile?" Powers the post-registration/login "We found
 * previous group expenses associated with this email" prompt.
 */
const getPendingClaims = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("email");
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    const guestMembers = await GroupMember.find({
      memberType: "guest",
      claimed: false,
      guestEmail: user.email.toLowerCase(),
    }).populate("group", "name");

    const data = guestMembers.map((member) => ({
      memberId: String(member._id),
      groupId: String(member.group?._id || member.group),
      groupName: member.group?.name || "Group",
      guestName: member.guestName,
    }));

    return res.status(200).json({ data });
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch pending claims.", error: error.message });
  }
};

/**
 * Converts a guest member into a registered member linked to the calling
 * user, preserving every historical expense/split/transfer reference
 * (they all point at this same GroupMember._id already) with no
 * duplicate member created.
 */
const claimGuestMember = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("email name");
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    const member = await GroupMember.findById(req.params.memberId);
    if (!member || member.memberType !== "guest") {
      return res.status(404).json({ message: "Guest profile not found." });
    }
    if (member.claimed) {
      return res.status(409).json({ message: "This guest profile has already been claimed." });
    }
    if (!member.guestEmail || member.guestEmail.toLowerCase() !== user.email.toLowerCase()) {
      return res.status(403).json({
        message: "This guest profile does not match your account email.",
      });
    }

    member.memberType = "registered";
    member.user = user._id;
    member.claimed = true;
    await member.save();

    const group = await Group.findById(member.group);
    if (group) {
      const alreadyEmbedded = group.members.some(
        (groupMember) => String(groupMember.user) === String(user._id)
      );
      if (!alreadyEmbedded) {
        group.members.push({ user: user._id, role: member.role || "member" });
        await group.save();
      }
    }

    return res.status(200).json({
      message: "Guest profile claimed. Your expense history has been linked.",
      data: serializeMemberFull(member),
      groupId: String(member.group),
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to claim guest profile.", error: error.message });
  }
};

module.exports = { getPendingClaims, claimGuestMember };
