const router = require("express").Router();
const { prisma } = require("../database/prisma");
const { plain, idParam, str, idList } = require("../database/prismaHelpers");
const randomstring = require("randomstring");
const bcrypt = require("bcrypt");
const {
  isValidEmail,
  areMobileNumbersFilled,
} = require("../functions/function.js");
const { sign } = require("jsonwebtoken");
const validateUser = require("../middlewares/user.js");
const csv = require("csv-parser");
const fs = require("fs");
const { checkPlan, checkContactLimit } = require("../middlewares/plan.js");
const logger = require("../utils/logger.js");

// add phonebook name
router.post(
  "/add",
  validateUser,
  checkPlan,
  async (req, res) => {
    try {
      const rawName = req.body?.name;

      if (!rawName || typeof rawName !== "string" || !rawName.trim()) {
        return res.status(400).json({
          success: false,
          msg: "Please enter a phonebook name",
        });
      }

      const name = rawName.trim();

      // find ext
      const findExt = await prisma.phonebook.findFirst({
        where: { uid: req.decode.uid, name },
        select: { id: true },
      });

      if (findExt) {
        return res.status(409).json({
          success: false,
          msg: "Duplicate phonebook name found",
        });
      }

      const created = await prisma.phonebook.create({
        data: { name, uid: req.decode.uid },
        select: { id: true },
      });

      if (!created?.id) {
        return res.status(500).json({
          success: false,
          msg: "Failed to create phonebook group in database",
        });
      }

      return res.status(200).json({
        success: true,
        msg: "Phonebook group created successfully",
        data: {
          id: created.id,
          name,
          uid: req.decode.uid,
          contactCount: 0,
        },
      });
    } catch (err) {
      logger.error("Error adding phonebook:", err);
      return res.status(500).json({
        success: false,
        msg: err?.message || "Something went wrong while creating phonebook",
      });
    }
  },
);

// get by uid
router.get("/get_by_uid", validateUser, async (req, res) => {
  try {
    const [phonebooks, counts] = await Promise.all([
      prisma.phonebook.findMany({
        where: { uid: req.decode.uid },
        orderBy: { id: "desc" },
      }),
      prisma.contact.groupBy({
        by: ["phonebook_id"],
        where: { uid: req.decode.uid },
        _count: { id: true },
      }),
    ]);

    // contact.phonebook_id is VARCHAR while phonebook.id is INT
    const countByPhonebook = new Map(
      counts.map((c) => [String(c.phonebook_id), c._count.id]),
    );
    const data = phonebooks.map((p) => ({
      ...plain(p),
      contactCount: countByPhonebook.get(String(p.id)) || 0,
    }));

    res.json({ data, success: true });
  } catch (err) {
    logger.error("Error fetching phonebooks by uid:", err);
    res.status(500).json({ success: false, msg: "Something went wrong" });
  }
});

// Edit Contact
router.put("/edit_contact", validateUser, async (req, res) => {
  const { contactId, name, mobile, var1, var2, var3, var4, var5, var6 = null } = req.body;

  try {
    // Update contact in the database
    const result = await prisma.contact.updateMany({
      where: { id: idParam(contactId), uid: req.decode.uid },
      data: {
        name: str(name),
        mobile: str(mobile),
        var1: str(var1),
        var2: str(var2),
        var3: str(var3),
        var4: str(var4),
        var5: str(var5),
        var6: str(var6),
      },
    });

    if (result.count > 0) {
      res.json({ success: true, msg: "Contact updated successfully" });
    } else {
      res.json({ success: false, msg: "Contact not found or no changes made" });
    }
  } catch (err) {
    logger.error(err);
    res.json({ success: false, msg: "Something went wrong" });
  }
});

const { getLimit, getUsage } = require("../helper/entitlements.js");

// del a phonebook
router.post("/del_phonebook", validateUser, async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) {
      return res.status(400).json({ success: false, msg: "Phonebook ID is required" });
    }

    const existing = await prisma.phonebook.findFirst({
      where: { id: idParam(id), uid: req.decode.uid },
      select: { id: true },
    });
    if (!existing) {
      return res.status(404).json({ success: false, msg: "Phonebook not found or unauthorized" });
    }

    await prisma.$transaction([
      prisma.phonebook.deleteMany({ where: { id: existing.id, uid: req.decode.uid } }),
      prisma.contact.deleteMany({
        where: { phonebook_id: String(existing.id), uid: req.decode.uid },
      }),
    ]);

    res.json({ success: true, msg: "Phonebook was deleted" });
  } catch (err) {
    logger.error("del_phonebook error:", err);
    res.status(500).json({ success: false, msg: "Failed to delete phonebook" });
  }
});

function parseCSVFile(fileData) {
  return new Promise((resolve, reject) => {
    const results = [];

    // Check if file data is provided
    if (!fileData) {
      resolve(null);
      return;
    }

    const stream = require("stream");
    const bufferStream = new stream.PassThrough();

    // Convert file data (Buffer) to a readable stream
    bufferStream.end(fileData);

    // Use csv-parser to parse the CSV data
    bufferStream
      .pipe(csv())
      .on("data", (data) => {
        // Push each row of data to the results array
        results.push(data);
      })
      .on("end", () => {
        // Resolve the promise with the parsed CSV data
        resolve(results);
      })
      .on("error", (error) => {
        // Reject the promise if there is an error
        resolve(null);
      });
  });
}

function validateMobile(mobile) {
  if (!mobile) return false;

  const cleaned = String(mobile).trim();

  // Only digits allowed
  return /^\d+$/.test(cleaned);
}

router.post(
  "/import_contacts",
  validateUser,
  checkPlan,
  checkContactLimit,
  async (req, res) => {
    try {
      if (!req.files || Object.keys(req.files).length === 0) {
        return res.status(400).json({
          success: false,
          msg: "No files were uploaded",
        });
      }

      const uploadedFile = req.files.file;
      const fileName = (uploadedFile?.name || "").toLowerCase();
      if (!fileName.endsWith(".csv") && !fileName.endsWith(".txt")) {
        return res.status(400).json({
          success: false,
          msg: "Invalid file format. Only CSV files are allowed.",
        });
      }

      if (uploadedFile.size > 10 * 1024 * 1024) {
        return res.status(400).json({
          success: false,
          msg: "File size exceeds 10MB limit.",
        });
      }

      const { id, phonebook_name } = req.body;
      if (!id) {
        return res.status(400).json({
          success: false,
          msg: "Phonebook ID is required",
        });
      }

      // Verify phonebook ownership (Tenant Isolation)
      const ownedPhonebook = await prisma.phonebook.findFirst({
        where: { id: idParam(id), uid: req.decode.uid },
        select: { id: true, name: true },
      });
      if (!ownedPhonebook) {
        return res.status(404).json({
          success: false,
          msg: "Phonebook not found or unauthorized",
        });
      }

      const csvData = await parseCSVFile(uploadedFile.data);

      if (!csvData || !Array.isArray(csvData) || csvData.length === 0) {
        return res.status(400).json({
          success: false,
          msg: "Invalid or empty CSV provided",
        });
      }

      // Server-side batch limit enforcement
      const contactLimit = getLimit(req.plan, "contacts");
      const currentUsage = await getUsage(req.decode.uid, "contacts");
      if (currentUsage + csvData.length > contactLimit) {
        return res.status(403).json({
          success: false,
          code: "PLAN_LIMIT_REACHED",
          msg: `Importing ${csvData.length} contacts exceeds your plan limit (${currentUsage}/${contactLimit}). Please upgrade your plan or reduce contacts.`,
        });
      }

      const cvalidateMobile = areMobileNumbersFilled(csvData);

      if (!cvalidateMobile) {
        return res.status(400).json({
          success: false,
          msg: "Please check your CSV. One or more mobile numbers are empty.",
        });
      }

      const invalidNumbers = [];

      csvData.forEach((row, index) => {
        const mobile = String(row.mobile || "").trim();

        if (!validateMobile(mobile)) {
          invalidNumbers.push({
            row: index + 2,
            name: row.name || "",
            mobile,
          });
        }
      });

      if (invalidNumbers.length > 0) {
        return res.status(400).json({
          success: false,
          msg: `${invalidNumbers.length} invalid phone numbers found. Only digits are allowed.`,
          invalidNumbers,
        });
      }

      const values = csvData.map((item) => ({
        uid: req.decode.uid,
        phonebook_id: String(ownedPhonebook.id),
        phonebook_name: str(phonebook_name || ownedPhonebook.name),
        name: str(item.name),
        mobile: String(item.mobile).trim(),
        var1: str(item.var1),
        var2: str(item.var2),
        var3: str(item.var3),
        var4: str(item.var4),
        var5: str(item.var5),
      }));

      // Chunk inserts in batches of 1,000 to prevent packet limit exhaustion and memory spikes
      const CHUNK_SIZE = 1000;
      for (let i = 0; i < values.length; i += CHUNK_SIZE) {
        await prisma.contact.createMany({ data: values.slice(i, i + CHUNK_SIZE) });
      }

      res.json({
        success: true,
        msg: "Contacts were inserted",
        inserted: values.length,
      });
    } catch (err) {
      logger.error("import_contacts error:", err);
      res.status(500).json({
        success: false,
        msg: "Failed to import contacts",
      });
    }
  },
);

router.post(
  "/add_single_contact",
  validateUser,
  checkPlan,
  checkContactLimit,
  async (req, res) => {
    try {
      const { id, phonebook_name, mobile, name, var1, var2, var3, var4, var5 } =
        req.body;
      const targetPbId = id || req.body.phonebook_id;

      if (!targetPbId) {
        return res.status(400).json({
          success: false,
          msg: "Phonebook ID is required",
        });
      }

      // Verify phonebook ownership (Tenant Isolation)
      const ownedPhonebook = await prisma.phonebook.findFirst({
        where: { id: idParam(targetPbId), uid: req.decode.uid },
        select: { id: true, name: true },
      });
      if (!ownedPhonebook) {
        return res.status(404).json({
          success: false,
          msg: "Phonebook not found or unauthorized",
        });
      }

      if (!mobile) {
        return res.status(400).json({
          success: false,
          msg: "Mobile number is required",
        });
      }

      const cleanedMobile = String(mobile).trim();

      if (!validateMobile(cleanedMobile)) {
        return res.status(400).json({
          success: false,
          msg: `Invalid mobile number "${mobile}". Only digits are allowed (0-9).`,
        });
      }

      await prisma.contact.create({
        data: {
          uid: req.decode.uid,
          phonebook_id: String(ownedPhonebook.id),
          phonebook_name: str(phonebook_name || ownedPhonebook.name),
          name: str(name),
          mobile: cleanedMobile,
          var1: str(var1),
          var2: str(var2),
          var3: str(var3),
          var4: str(var4),
          var5: str(var5),
        },
      });

      res.json({
        success: true,
        msg: "Contact was inserted",
      });
    } catch (err) {
      logger.error("add_single_contact error:", err);
      res.status(500).json({
        success: false,
        msg: "Failed to insert contact",
      });
    }
  },
);

function buildContactWhere(uid, search, phonebook_id) {
  const where = { uid };
  if (search) {
    where.OR = [{ name: { contains: search } }, { mobile: { contains: search } }];
  }
  if (phonebook_id) {
    where.phonebook_id = String(phonebook_id);
  }
  return where;
}

// GET /api/phonebook/get_uid_contacts?page=1&limit=50&search=john&phonebook_id=
router.get("/get_uid_contacts", validateUser, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(200, parseInt(req.query.limit) || 50);
    const offset = (page - 1) * limit;
    const search = (req.query.search || "").trim();
    const phonebook_id = req.query.phonebook_id || "";

    const where = buildContactWhere(req.decode.uid, search, phonebook_id);

    const [total, rows] = await Promise.all([
      prisma.contact.count({ where }),
      prisma.contact.findMany({
        where,
        orderBy: { id: "desc" },
        take: limit,
        skip: offset,
      }),
    ]);

    res.json({
      success: true,
      data: plain(rows),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    logger.error("get_uid_contacts error:", err);
    res.status(500).json({ success: false, msg: "Failed to fetch contacts" });
  }
});

// delete contacts with tenant isolation
router.post("/del_contacts", validateUser, async (req, res) => {
  try {
    const selected = req.body.selected;
    if (!Array.isArray(selected) || selected.length === 0) {
      return res.status(400).json({ success: false, msg: "No contacts selected" });
    }
    await prisma.contact.deleteMany({
      where: { id: { in: idList(selected) }, uid: req.decode.uid },
    });
    res.json({ success: true, msg: "Contact(s) was deleted" });
  } catch (err) {
    logger.error("del_contacts error:", err);
    res.status(500).json({ success: false, msg: "Failed to delete contacts" });
  }
});

// In phonebook.js router — just a simple read, no new logic
router.get("/get_for_flow", validateUser, async (req, res) => {
  try {
    const data = await prisma.phonebook.findMany({
      where: { uid: req.decode.uid },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
    res.json({ success: true, data });
  } catch (err) {
    logger.error("get_for_flow error:", err);
    res.status(500).json({ success: false, msg: "Something went wrong" });
  }
});

// GET /api/phonebook/export_contacts_csv?search=&phonebook_id=
router.get("/export_contacts_csv", validateUser, async (req, res) => {
  try {
    const search = (req.query.search || "").trim();
    const phonebook_id = req.query.phonebook_id || "";

    const data = await prisma.contact.findMany({
      where: buildContactWhere(req.decode.uid, search, phonebook_id),
      select: {
        name: true,
        mobile: true,
        phonebook_name: true,
        var1: true,
        var2: true,
        var3: true,
        var4: true,
        var5: true,
        createdAt: true,
      },
      orderBy: { id: "desc" },
    });

    const fields = [
      "name",
      "mobile",
      "phonebook_name",
      "var1",
      "var2",
      "var3",
      "var4",
      "var5",
      "createdAt",
    ];

    // CSV Formula Injection mitigation: escape cells starting with =, +, -, @, \t, \r
    function escapeCsvCell(val) {
      if (val === null || val === undefined) return '""';
      let str = String(val);
      if (/^[=+\-@\t\r]/.test(str)) {
        str = "'" + str;
      }
      return `"${str.replace(/"/g, '""')}"`;
    }

    const header = fields.join(",");
    const rows = data.map((row) =>
      fields.map((f) => escapeCsvCell(row[f])).join(",")
    );

    const csv = [header, ...rows].join("\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="contacts_export_${Date.now()}.csv"`,
    );
    res.send(csv);
  } catch (err) {
    logger.error("export_contacts_csv error:", err);
    res.status(500).json({ success: false, msg: "Failed to export CSV" });
  }
});

module.exports = router;
