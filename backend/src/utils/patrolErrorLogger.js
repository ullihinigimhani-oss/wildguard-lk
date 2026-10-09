// Prisma validation messages can echo the complete mutation payload. Never log
// the raw error, SQL, connection URL, request body, headers, or stack.
module.exports = function logPatrolError(error, req) {
  if (process.env.NODE_ENV !== "development" || req.method !== "POST" ||
      req.path.replace(/\/$/, "") !== "/api/patrols") return;
  const identifier = (value) => typeof value === "string" &&
    /^[A-Za-z_][A-Za-z_0-9.]{0,100}$/.test(value) ? value : undefined;
  const unknown = /Unknown (argument|field) `([A-Za-z_][A-Za-z_0-9]*)`/.exec(error.message || "");
  const code = /^P\d{4}$/.test(error.code || "") ? error.code : undefined;
  const messages = {
    P2002: "Unique constraint failed.",
    P2003: "Foreign key constraint failed.",
    P2021: "Required table is missing from the database.",
    P2022: "Required column is missing from the database.",
    P2025: "Required related record was not found.",
  };
  console.error("[Patrol creation failed]", {
    exception: identifier(error.name) || "Error",
    code,
    message: unknown ? `Unknown ${unknown[1]} \`${unknown[2]}\`. Regenerate Prisma Client if the schema defines this field.`
      : messages[code] || "Unexpected patrol creation exception; sensitive error details omitted.",
    metadata: {
      model: identifier(error.meta?.modelName),
      field: identifier(error.meta?.field_name),
      column: identifier(error.meta?.column),
    },
  });
};
