const router = require("express").Router();
const authenticate = require("../middleware/auth.middleware");
const allowRoles = require("../middleware/role.middleware");
const mail = require("../services/email.service");
const db = () => require("../config/database");
const staffRoles = ["RANGER", "COMMUNITY_LIAISON", "RESEARCHER"];
const roles = [...staffRoles, "PARK_MANAGER", "COMMUNITY_USER"];
const statuses = ["PENDING", "APPROVED", "REJECTED"];
const select = {
  id: true,
  name: true,
  email: true,
  phone: true,
  role: true,
  approvalStatus: true,
  profileImageUrl: true,
  createdAt: true,
  rejectionReason: true,
};
const fail = (status, message) =>
  Object.assign(new Error(message), { status, authError: true });
router.use(authenticate, allowRoles("PARK_MANAGER"));
async function list(req, res, next, pendingOnly) {
  try {
    const { search = "", role, status, page = "1" } = req.query;
    if (
      typeof search !== "string" ||
      search.length > 120 ||
      !/^\d+$/.test(String(page)) ||
      Number(page) < 1 ||
      Number(page) > 100000 ||
      (role && !roles.includes(role)) ||
      (status && !statuses.includes(status))
    )
      throw fail(400, "Invalid user filters.");
    const where = pendingOnly
      ? { approvalStatus: "PENDING", role: { in: staffRoles } }
      : { ...(role && { role }), ...(status && { approvalStatus: status }) };
    if (search.trim())
      where.OR = [
        { name: { contains: search.trim(), mode: "insensitive" } },
        { email: { contains: search.trim(), mode: "insensitive" } },
      ];
    const [users, total] = await Promise.all([
      db().user.findMany({
        where,
        select,
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        take: 25,
        skip: (Number(page) - 1) * 25,
      }),
      db().user.count({ where }),
    ]);
    res
      .set("Cache-Control", "no-store")
      .json({ success: true, users, total, page: Number(page), pageSize: 25 });
  } catch (error) {
    next(error);
  }
}
router.get("/pending", (req, res, next) => list(req, res, next, true));
router.get("/", (req, res, next) => list(req, res, next, false));
router.patch("/:id/approval", async (req, res, next) => {
  try {
    const { status, reason } = req.body || {};
    if (
      !["APPROVED", "REJECTED"].includes(status) ||
      (reason != null && (typeof reason !== "string" || reason.length > 1000))
    )
      throw fail(
        400,
        "Choose Approve or Reject and use a reason of up to 1000 characters.",
      );
    const user = await db().$transaction(async (tx) => {
      const target = await tx.user.findUnique({
        where: { id: req.params.id },
        select,
      });
      if (!target) throw fail(404, "Account not found.");
      if (!staffRoles.includes(target.role))
        throw fail(403, "This role requires a different approval process.");
      const result = await tx.user.updateMany({
        where: {
          id: target.id,
          role: { in: staffRoles },
          approvalStatus: "PENDING",
        },
        data: {
          approvalStatus: status,
          rejectionReason:
            status === "REJECTED" ? reason?.trim() || null : null,
          reviewedAt: new Date(),
          reviewedById: req.user.id,
        },
      });
      if (result.count !== 1)
        throw fail(
          409,
          "This account has already been reviewed. Refresh the list.",
        );
      return tx.user.findUnique({ where: { id: target.id }, select });
    });
    // Commit is authoritative; notification failure must never roll it back.
    let notification;
    try {
      notification = await mail.sendDecisionEmail(user);
    } catch {
      notification = { sent: false, reason: "delivery_failed" };
    }
    res.json({
      success: true,
      user,
      notification,
      message: notification.sent
        ? "Account updated and notification sent."
        : "Account updated successfully, but the notification email could not be sent.",
    });
  } catch (error) {
    next(error);
  }
});
module.exports = router;
