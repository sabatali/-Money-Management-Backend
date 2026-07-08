const GroupMember = require("../models/groupMember.model");
const { sanitizeName, capitalizeName, buildNormalizedKey, ValidationError } = require("./nameValidation");

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^\+?[0-9\-\s()]{7,20}$/;

const validateGuestEmail = (email) => {
  if (!email) return null;
  const trimmed = String(email).trim().toLowerCase();
  if (!trimmed) return null;
  if (!EMAIL_REGEX.test(trimmed)) {
    throw new ValidationError("Guest email is not a valid email address.");
  }
  return trimmed;
};

const validateGuestPhone = (phone) => {
  if (!phone) return null;
  const trimmed = String(phone).trim();
  if (!trimmed) return null;
  if (!PHONE_REGEX.test(trimmed)) {
    throw new ValidationError("Guest phone number is not valid.");
  }
  return trimmed;
};

const validateNotes = (notes) => {
  if (!notes) return null;
  const trimmed = String(notes).trim();
  if (!trimmed) return null;
  if (trimmed.length > 300) {
    throw new ValidationError("Notes must be at most 300 characters.");
  }
  return trimmed;
};

/**
 * Resolves a member reference id coming from a client into the canonical
 * GroupMember document, scoped to the given group. Accepts either:
 *  - a GroupMember._id (the only option for guests, and the modern
 *    reference for registered members going forward), or
 *  - a raw User._id (kept for backward compatibility — existing clients
 *    and tests send `user.id` for paidBy/fromUser/toUser/splits[].user).
 */
const resolveGroupMember = async (groupId, rawId) => {
  if (!rawId) return null;
  const byMemberId = await GroupMember.findOne({ group: groupId, _id: rawId });
  if (byMemberId) return byMemberId;
  return GroupMember.findOne({ group: groupId, user: rawId });
};

const listGroupMembers = (groupId) =>
  GroupMember.find({ group: groupId }).sort({ joinedAt: 1 }).populate("user", "name email emailVerified");

/**
 * Shapes a (possibly populated) GroupMember doc into the flat identity
 * object embedded in expense/transfer JSON responses. For registered
 * members, `_id` is deliberately the real User id (not the GroupMember
 * id) so existing frontend/test comparisons against `user.id` keep
 * working unchanged. Guests get their GroupMember id as `_id` since they
 * have no User id.
 */
const serializeMemberRef = (member) => {
  if (!member) return null;
  const isRegistered = member.memberType === "registered";
  const userDoc = isRegistered ? member.user : null;
  const userId = isRegistered ? String(userDoc?._id || userDoc || "") : null;
  return {
    _id: isRegistered ? userId : String(member._id),
    memberId: String(member._id),
    userId,
    name: isRegistered ? userDoc?.name || "Member" : member.guestName,
    email: isRegistered ? userDoc?.email || null : member.guestEmail || null,
    memberType: member.memberType,
  };
};

/** Full shape for group member list / management UI. */
const serializeMemberFull = (member) => {
  const ref = serializeMemberRef(member);
  return {
    ...ref,
    role: member.role,
    claimed: member.claimed,
    phone: member.memberType === "guest" ? member.guestPhone || null : null,
    notes: member.memberType === "guest" ? member.notes || null : null,
    joinedAt: member.joinedAt,
    guestInviteSentAt: member.guestInviteSentAt || null,
  };
};

const ensureRegisteredMember = async ({ group, userId, role = "member", joinedAt }) => {
  const existing = await GroupMember.findOne({ group, user: userId });
  if (existing) return existing;
  return GroupMember.create({
    group,
    memberType: "registered",
    user: userId,
    role,
    claimed: true,
    joinedAt: joinedAt || new Date(),
  });
};

const assertNoDuplicateGuestName = async (groupId, normalizedGuestName, excludeMemberId) => {
  const query = {
    group: groupId,
    memberType: "guest",
    normalizedGuestName,
  };
  if (excludeMemberId) {
    query._id = { $ne: excludeMemberId };
  }
  const existing = await GroupMember.findOne(query);
  if (existing) {
    throw new ValidationError("A guest with this name already exists in the group.");
  }
};

const createGuestMember = async ({ group, name, email, phone, notes, addedBy }) => {
  const cleanedName = sanitizeName(name);
  const guestName = capitalizeName(cleanedName);
  const normalizedGuestName = buildNormalizedKey(cleanedName);
  await assertNoDuplicateGuestName(group, normalizedGuestName);

  const guestEmail = validateGuestEmail(email);
  const guestPhone = validateGuestPhone(phone);
  const cleanNotes = validateNotes(notes);

  return GroupMember.create({
    group,
    memberType: "guest",
    guestName,
    normalizedGuestName,
    guestEmail,
    guestPhone,
    notes: cleanNotes,
    claimed: false,
    role: "member",
    joinedAt: new Date(),
    createdBy: addedBy,
  });
};

const updateGuestMember = async (member, { name, email, phone, notes }) => {
  if (name !== undefined) {
    const cleanedName = sanitizeName(name);
    const guestName = capitalizeName(cleanedName);
    const normalizedGuestName = buildNormalizedKey(cleanedName);
    await assertNoDuplicateGuestName(member.group, normalizedGuestName, member._id);
    member.guestName = guestName;
    member.normalizedGuestName = normalizedGuestName;
  }
  if (email !== undefined) {
    member.guestEmail = validateGuestEmail(email);
  }
  if (phone !== undefined) {
    member.guestPhone = validateGuestPhone(phone);
  }
  if (notes !== undefined) {
    member.notes = validateNotes(notes);
  }
  await member.save();
  return member;
};

module.exports = {
  resolveGroupMember,
  listGroupMembers,
  serializeMemberRef,
  serializeMemberFull,
  ensureRegisteredMember,
  createGuestMember,
  updateGuestMember,
  assertNoDuplicateGuestName,
  validateGuestEmail,
  validateGuestPhone,
  validateNotes,
};
