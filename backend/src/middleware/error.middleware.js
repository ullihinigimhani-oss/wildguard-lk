// Never expose database errors, request contents, or stack traces to clients.
function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);
  if (error.authError)
    return res.status(error.status).json({
      success: false,
      message: error.message,
      ...(error.code === "ACCOUNT_NOT_APPROVED" && {
        code: error.code,
        ...(["PENDING", "REJECTED"].includes(error.approvalStatus) && {
          approvalStatus: error.approvalStatus,
        }),
      }),
    });
  if (error.registrationError && [400, 409].includes(error.status)) {
    return res
      .status(error.status)
      .json({ success: false, message: error.message, errors: error.fields });
  }
  const status = error.status >= 400 && error.status < 500 ? error.status : 500;
  const message =
    status === 400
      ? "Invalid request body"
      : status === 413
        ? "Request body too large"
        : status < 500
          ? "Invalid request"
          : "Internal server error";
  res.status(status).json({ success: false, message });
}

module.exports = errorHandler;
