const notices = {
  PENDING: {
    title: "Account Pending Approval",
    message:
      "Your account has not been approved yet. Please wait for a Park Manager to verify your account. Once approved, you can sign in to WildGuard LK.",
  },
  REJECTED: {
    title: "Account Not Approved",
    message:
      "Your account request has been rejected. Please contact the Park Manager if you need further assistance.",
  },
};
export function getApprovalNotice(error) {
  const response = error?.response;
  return response?.status === 403 &&
    response.data?.code === "ACCOUNT_NOT_APPROVED"
    ? notices[response.data.approvalStatus] || null
    : null;
}
