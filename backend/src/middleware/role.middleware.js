module.exports =
  (...roles) =>
  (req, res, next) => {
    if (
      !req.user ||
      !roles.includes(req.user.role) ||
      req.user.approvalStatus !== "APPROVED"
    ) {
      return res
        .status(403)
        .json({
          success: false,
          message: "You do not have permission to perform this action.",
        });
    }
    next();
  };
