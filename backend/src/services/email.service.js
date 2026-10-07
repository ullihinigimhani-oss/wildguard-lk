// Unused adapter retained for future use; account approval/rejection never calls it.
const labels = {
  RANGER: "Park Ranger",
  PARK_MANAGER: "Park Manager",
  COMMUNITY_LIAISON: "Community Liaison",
  RESEARCHER: "Wildlife Researcher",
  COMMUNITY_USER: "Community Member",
};
exports.buildDecisionEmail = (user) => {
  const approved = user.approvalStatus === "APPROVED";
  return {
    to: user.email,
    subject: approved
      ? "Your WildGuard LK Account Has Been Approved"
      : "Update on Your WildGuard LK Account",
    text: approved
      ? `Hello ${user.name},\n\nYour WildGuard LK account has been verified and approved.\n\nRole:\n${labels[user.role]}${user.role === "RANGER" && user.park?.name ? `\n\nAssigned Park / Ranger Area:\n${user.park.name}` : ""}\n\nYou can now sign in to WildGuard LK using the email address and password you provided during registration.\n\nThank you for supporting wildlife conservation.\n\nWildGuard LK Team`
      : `Hello ${user.name},\n\nThank you for registering with WildGuard LK.\n\nYour request for a ${labels[user.role]} account has been reviewed.\n\nUnfortunately, your account request was not approved at this time.${user.rejectionReason ? `\n\nReason:\n${user.rejectionReason}` : ""}\n\nWildGuard LK Team`,
  };
};
exports.sendDecisionEmail = async (user) => {
  if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM)
    return { sent: false, reason: "not_configured" };
  try {
    const { to, subject, text } = exports.buildDecisionEmail(user);
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM,
        to: [to],
        subject,
        text,
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok)
      throw new Error("Email provider did not accept the notification");
    return { sent: true };
  } catch {
    console.warn(
      "Account status updated, but notification email could not be sent.",
    );
    return { sent: false, reason: "delivery_failed" };
  }
};
