const router = require("express").Router();
// Reuse the authoritative Park records; no duplicate frontend dataset.
router.get("/", async (req, res, next) => {
  try {
    const parks = await require("../config/database").park.findMany({
      select: { id: true, name: true },
      orderBy: [{ name: "asc" }, { id: "asc" }],
    });
    res.json({ success: true, parks });
  } catch (error) {
    next(error);
  }
});
module.exports = router;
