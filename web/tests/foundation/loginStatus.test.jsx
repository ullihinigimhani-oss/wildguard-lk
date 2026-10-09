import { getApprovalNotice } from "../../src/utils/loginStatus";
test.each(["PENDING", "REJECTED"])(
  "notice is based on verified backend %s status",
  (approvalStatus) => {
    expect(
      getApprovalNotice({
        response: {
          status: 403,
          data: { code: "ACCOUNT_NOT_APPROVED", approvalStatus },
        },
      }),
    ).toEqual(
      expect.objectContaining({
        title: expect.any(String),
        message: expect.any(String),
      }),
    );
  },
);
test.each([
  {
    status: 401,
    data: { code: "ACCOUNT_NOT_APPROVED", approvalStatus: "PENDING" },
  },
  { status: 403, data: { approvalStatus: "PENDING" } },
  {
    status: 403,
    data: { code: "ACCOUNT_NOT_APPROVED", approvalStatus: "APPROVED" },
  },
  {
    status: 403,
    data: { code: "ACCOUNT_NOT_APPROVED", approvalStatus: "UNKNOWN" },
  },
  { status: 403, data: { message: "Your account is awaiting approval." } },
])(
  "unrelated errors/approved states never produce an approval notice",
  (response) => {
    expect(getApprovalNotice({ response })).toBeNull();
  },
);
