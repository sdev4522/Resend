const router = require("express").Router();
const { prisma } = require("../database/prisma.js");
const validateUser = require("../middlewares/user.js");
const { checkPlan } = require("../middlewares/plan.js");
const logger = require("../utils/logger.js");

// add templet
router.post("/add_new", validateUser, checkPlan, async (req, res) => {
  try {
    const { title, type, content } = req.body;

    if (!title || !type || !content) {
      return res.json({ success: false, msg: "Please give a title" });
    }

    await prisma.templets.create({
      data: {
        uid: req.decode.uid,
        content: JSON.stringify(content),
        type,
        title,
      },
    });

    res.json({ success: true, msg: "Templet was added" });
  } catch (err) {
    logger.log(err);
    res.json({ err, msg: "something went wrong", success: false });
  }
});

// get my templet
router.get("/get_templets", validateUser, async (req, res) => {
  try {
    const data = await prisma.templets.findMany({
      where: {
        uid: req.decode.uid,
      },
    });
    res.json({ data, success: true });
  } catch (err) {
    logger.log(err);
    res.json({ err, msg: "something went wrong", success: false });
  }
});

// dele templets
router.post("/del_templets", validateUser, async (req, res) => {
  try {
    const rawSelected = req.body.selected ?? req.body.id;
    const selectedIds = (Array.isArray(rawSelected) ? rawSelected : [rawSelected])
      .map((id) => parseInt(id, 10))
      .filter((id) => !isNaN(id) && id > 0);

    if (selectedIds.length > 0) {
      await prisma.templets.deleteMany({
        where: {
          id: { in: selectedIds },
          uid: req.decode.uid,
        },
      });
    }

    res.json({ success: true, msg: "Contact(s) was deleted" });
  } catch (err) {
    res.json({ success: false, msg: "something went wrong" });
    logger.log(err);
  }
});

module.exports = router;
