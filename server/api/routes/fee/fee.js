const express = require("express");
const router = express.Router();
const mysql = require("mysql");
const checkAuth = require("../middleware/check-atuh"); // correct the spelling typo from check-atuh to check-auth
const multer = require("multer");
const path = require("path");
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "./uploads");
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname);
  },
});

const fileFilter = (req, file, cb) => {
  if (
    file.mimetype === "image/jpeg" ||
    file.mimetype === "image/png" ||
    file.mimetype === "image/jpeg"
  ) {
    cb(null, true);
  } else {
    cb(null, false);
  }
};

const upload = multer({
  storage: storage,
  limits: { fileSize: 1024 * 1024 * 5 },
  fileFilter: fileFilter,
});


// MySQL connection
// MySQL connection
const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});
db.connect((err) => {
  if (err) {
    console.error("Database connection failed:", err);
    return;
  }
});

// New endpoint for profile or verification
router.get("/", checkAuth, async (req, res) => {
  const feedetailQuery = `
  SELECT fee_tbl.*, basicinfo.*
  FROM fee_tbl
  JOIN basicinfo ON fee_tbl.fee_adm_no = basicinfo.adm_no`;

  // const feedetailQuery = "SELECT * FROM fee_tbl"; // renamed for clarity

  db.query(feedetailQuery, (error, result) => {
    if (error) {
      console.error("Database query error:", error);
      return res.status(500).json({ error: "Database query failed" });
    }

    // Send the retrieved fee details back to the client
    return res.status(200).json({ success: true, data: result });
  });
});

router.post("/insert-fees", checkAuth, async (req, res) => {
  // Get the current year and month
  const currentYear = new Date().getFullYear();
  let currentMonth = new Date().getMonth() + 1; // Months are 0-based in JavaScript

  // Calculate the next month and handle year transition
  let nextMonth;
  let nextYear = currentYear;

  if (currentMonth === 12) {
    nextMonth = 1; // January of the next year
    nextYear += 1; // Increment the year
  } else {
    nextMonth = currentMonth + 1; // Increment to next month
  }

  // Calculate the first day of the next month
  const nextMonthDate = new Date(nextYear, nextMonth - 1, 1); // Adjust for 0-based month

  const queryBasicInfo = "SELECT adm_no, standard, section, monthly_fee FROM basicinfo";

  db.query(queryBasicInfo, async (error, basicInfoResults) => {
    if (error) {
      console.error("Database query error:", error);
      return res.status(500).json({ error: "Database query failed" });
    }

    let insertedRecords = 0;
    let pendingQueries = basicInfoResults.length;

    for (const info of basicInfoResults) {
      // Check if monthly_fee is not "Free"
      if (info.monthly_fee !== "Free") {
        // Check for existing records in fee_tbl for the next month
        const checkExistingQuery = "SELECT * FROM fee_tbl WHERE fee_adm_no = ? AND fyear = ? AND fmonth = ?";
        
        db.query(checkExistingQuery, [info.adm_no, nextYear, nextMonth], (checkErr, existingRecord) => {
          if (checkErr) {
            console.error("Check existing record error:", checkErr);
            return res.status(500).json({ error: "Database query failed" });
          }

          if (existingRecord.length === 0) {
            // Calculate total arrears from fee_tbl for the given adm_no for the current month
            const arrearsQuery = `
              SELECT 
                balance, 
                fine_balance, 
                adm_balance, 
                exam_balance, 
                misc_balance 
              FROM fee_tbl 
              WHERE fee_adm_no = ? AND fyear = ? AND fmonth = ?
            `;
            
            db.query(arrearsQuery, [info.adm_no, currentYear, currentMonth], (arrearsErr, arrearsResults) => {
              if (arrearsErr) {
                console.error("Calculate arrears error:", arrearsErr);
                return res.status(500).json({ error: "Database query failed" });
              }

              const feebalance = arrearsResults[0]?.balance || 0;
              const finebalance = arrearsResults[0]?.fine_balance || 0;
              const admbalance = arrearsResults[0]?.adm_balance || 0;
              const exambalance = arrearsResults[0]?.exam_balance || 0;
              const miscbalance = arrearsResults[0]?.misc_balance || 0;

              // Insert new record with calculated arrears
              const insertSQL = `
                INSERT INTO fee_tbl 
                (fee_adm_no, FeeStandard, sec, monthly_fee_feetbl, created_at, arrears, fine_arrears, exam_arrears, adm_arrears, misc_arrears) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              `;
              db.query(insertSQL, [info.adm_no, info.standard, info.section, info.monthly_fee, nextMonthDate, feebalance, finebalance, exambalance, admbalance, miscbalance], (insertErr) => {
                if (insertErr) {
                  console.error("Insert fee record error:", insertErr);
                } else {
                  insertedRecords++;
                }

                if (--pendingQueries === 0) {
                  return res.status(200).json({ success: true, insertedRecords });
                }
              });
            });
          } else {
            // If the record already exists for the next month, only decrement pendingQueries
            if (--pendingQueries === 0) {
              return res.status(200).json({ success: true, insertedRecords });
            }
          }
        });
      } else {
        // If monthly_fee is "Free", decrement pendingQueries
        if (--pendingQueries === 0) {
          return res.status(200).json({ success: true, insertedRecords });
        }
      }
    }
  });
});

// Get data by idf
router.get("/editfee/:idf", checkAuth, async (req, res) => {
  const idf = req.params.idf;
  const query = ` 
    SELECT fee_tbl.*, basicinfo.* 
    FROM fee_tbl 
    JOIN basicinfo 
    ON fee_tbl.fee_adm_no = basicinfo.adm_no 
    WHERE fee_tbl.idf = ? 
  `;
  db.query(query, [idf], (error, result) => {
    if (error) {
      console.error("Database query error:", error);
      return res.status(500).json({ error: "Database query failed" });
    }
    res.status(200).json({ success: true, data: result[0] });
  });
});


// Update data by idf
router.patch("/:idf", checkAuth, async (req, res) => {
  const idf = req.params.idf; // Get idf from URL parameter
  const {
    collection,
    fine_collection,
    exam_collection,
    adm_collection,
    misc_collection,
    collection_by,
    payment_at,
  } = req.body;

  // Check the current year and month from the database first
  const checkQuery = `SELECT fyear, fmonth FROM fee_tbl WHERE idf = ?`;
  db.query(checkQuery, [idf], (error, results) => {
    if (error) {
      console.error("Database query error:", error);
      return res.status(500).json({ error: "Database query failed" });
    }

    if (results.length === 0) {
      return res.status(404).json({ error: "No record found for this idf" });
    }

    const { fyear, fmonth } = results[0];

    // Proceed with the update
    const updateQuery = `
      UPDATE fee_tbl 
      SET 
        collection = ?, 
        collection_by = ?, 
        payment_at = ?, 
        fine_collection = ?, 
        exam_collection = ?, 
        adm_collection = ?, 
        misc_collection = ?
      WHERE idf = ?
    `;

    db.query(
      updateQuery,
      [
        collection,
        collection_by,
        payment_at,
        fine_collection,
        exam_collection,
        adm_collection,
        misc_collection,
        idf,
      ],
      (error) => {
        if (error) {
          console.error("Database query error:", error);
          return res.status(500).json({ error: "Database query failed" });
        }

        res.status(200).json({ success: true });
      }
    );
  });
});

 

// search data by adm no
// Search fees by admission number for the current and next month
router.get("/search/:admno", checkAuth, async (req, res) => {
  const admno = req.params.admno;
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1; // Current month (1-12)
  const nextMonth = currentMonth === 12 ? 1 : currentMonth + 1;
  const nextYear = currentMonth === 12 ? currentYear + 1 : currentYear;

  const query = `
      SELECT fee_tbl.*, basicinfo.*
      FROM fee_tbl
      JOIN basicinfo ON fee_tbl.fee_adm_no = basicinfo.adm_no
      WHERE fee_tbl.fee_adm_no = ?
      AND ( (fee_tbl.fyear = ? AND fee_tbl.fmonth = ?)
            OR (fee_tbl.fyear = ? AND fee_tbl.fmonth = ?) )
  `;

  db.query(query, [admno, currentYear, currentMonth, nextYear, nextMonth], (error, results) => {
      if (error) {
          console.error("Database query error:", error);
          return res.status(500).json({ error: "Database query failed" });
      }

      return res.status(200).json({ success: true, data: results });
  });
});


// Get data by idf
router.get("/collect/:idf", checkAuth, async (req, res) => {
  const idf = req.params.idf;
  // Assuming 'id' is the common field to join on in both tables
  const query = `
    SELECT fee_tbl.*, basicinfo.*
    FROM fee_tbl
    JOIN basicinfo ON fee_tbl.fee_adm_no = basicinfo.adm_no
    WHERE fee_tbl.idf = ?`;

  db.query(query, [idf], (error, result) => {
    if (error) {
      console.error("Database query error:", error);
      return res.status(500).json({ error: "Database query failed" });
    }
    res.status(200).json({ success: true, data: result });
  });
});

// Delete fee record by idf
router.delete("/:idf", checkAuth, async (req, res) => {
  const idf = req.params.idf;
  const query = "DELETE FROM fee_tbl WHERE idf = ?";
  db.query(query, [idf], (error) => {
    if (error) {
      console.error("Database query error:", error);
      return res.status(500).json({ error: "Database query failed" });
    }
    res.status(200).json({ success: true });
  });
});

// Get all paid fees
router.get("/paid", checkAuth, async (req, res) => {
  const query = `SELECT 
    f.idf, 
    f.fee_adm_no, 
    b.name, 
    f.FeeStandard, 
    f.collection, 
    f.monthly_fee_feetbl AS total_fee, 
    f.collection_by, 
    f.payment_at 
FROM 
    fee_tbl f 
JOIN 
    basicinfo b 
ON 
    f.fee_adm_no = b.adm_no 
WHERE 
    f.collection > 0;
`;
  db.query(query, (error, results) => {
    if (error) {
      console.error("Database query error:", error);
      return res.status(500).json({ error: "Database query failed" });
    }
    res.status(200).json({ success: true, data: results });
  });
});

router.patch("/update/:idf", checkAuth, async (req, res) => {
  const { idf } = req.params;
  const { collection, adm_collection, exam_collection, fine_collection, collection_by } = req.body;

  // Check if payment_at is already set
  db.query(`SELECT payment_at FROM fee_tbl WHERE idf = ?`, [idf], (error, results) => {
    if (error) {
      console.error("Error checking payment_at:", error);
      return res.status(500).json({ error: "Database query failed" });
    }

    if (results[0].payment_at !== null) {
      return res.status(400).json({ error: "Fee has already been collected for this student. No changes can be made at this stage." });
    }

    const updates = [];
    const values = [];

    if (collection !== undefined) {
      updates.push(`collection = ?`);
      values.push(collection);
    }
    if (adm_collection !== undefined) {
      updates.push(`adm_collection = ?`);
      values.push(adm_collection);
    }
    if (exam_collection !== undefined) {
      updates.push(`exam_collection = ?`);
      values.push(exam_collection);
    }
    if (fine_collection !== undefined) {
      updates.push(`fine_collection = ?`);
      values.push(fine_collection);
    }
    if (collection_by !== undefined) {
      updates.push(`collection_by = ?`);
      values.push(collection_by);
    }

    // Set payment_at to current date
    updates.push(`payment_at = ?`);
    values.push(new Date());

    if (updates.length === 0) {
      return res.status(400).json({ error: "No fields provided to update" });
    }

    const query = `UPDATE fee_tbl SET ${updates.join(', ')} WHERE idf = ?`;
    values.push(idf);

    console.log("Query:", query);
    console.log("Values:", values);

    db.query(query, values, (error, results) => {
      if (error) {
        console.error("Error updating fee:", error);
        return res.status(500).json({ error: "Database query failed" });
      }

      console.log("Update results:", results);
      res.status(200).json({ success: true, message: "Fee updated successfully" });
    });
  });
});

router.patch("/edit/update/:idf", checkAuth, async (req, res) => {
  const { idf } = req.params;
  const {
    monthly_fee,
    arrears,
    adm_fee,
    adm_arrears,
    fine_fee,
    fine_arrears,
    exam_fee,
    exam_arrears,
    updated_at
  } = req.body;

  const updates = [];
  const values = [];

  if (monthly_fee !== undefined) {
    updates.push(`monthly_fee_feetbl = ?`);
    values.push(monthly_fee);
  }

  if (arrears !== undefined) {
    updates.push(`arrears = ?`);
    values.push(arrears);
  }

  if (adm_fee !== undefined) {
    updates.push(`adm_fee = ?`);
    values.push(adm_fee);
  }

  if (adm_arrears !== undefined) {
    updates.push(`adm_arrears = ?`);
    values.push(adm_arrears);
  }

  if (fine_fee !== undefined) {
    updates.push(`fine_fee = ?`);
    values.push(fine_fee);
  }

  if (fine_arrears !== undefined) {
    updates.push(`fine_arrears = ?`);
    values.push(fine_arrears);
  }

  if (exam_fee !== undefined) {
    updates.push(`exam_fee = ?`);
    values.push(exam_fee);
  }

  if (exam_arrears !== undefined) {
    updates.push(`exam_arrears = ?`);
    values.push(exam_arrears);
  }

  updates.push(`updated_at = ?`);
  values.push(updated_at);

  if (updates.length === 0) {
    return res.status(400).json({ error: "No fields provided to update" });
  }

  const query = `UPDATE fee_tbl SET ${updates.join(', ')} WHERE idf = ?`;
  values.push(idf);

  console.log("Query:", query);
  console.log("Values:", values);

  db.query(query, values, (error, results) => {
    if (error) {
      console.error("Error updating fee:", error);
      return res.status(500).json({ error: "Database query failed" });
    }

    console.log("Update results:", results);
    res.status(200).json({ success: true, message: "Fee updated successfully" });
  });
});



// New endpoint for fetching standards
router.get("/standards", checkAuth, (req, res) => {
  const query = "SELECT DISTINCT FeeStandard FROM fee_tbl";
  
  db.query(query, (error, result) => {
    if (error) {
      console.error("Database query error:", error);
      return res.status(500).json({ error: "Database query failed" });
    }
    
    return res.status(200).json({ success: true, data: result });
  });
});

// Update fee details by idf
router.patch("/edit/:idf", checkAuth, async (req, res) => {
  const idf = req.params.idf;
  const { 
    monthly_fee, 
    fine_fee, 
    exam_fee, 
    misc_fee, 
    arrears, 
    adm_fee,            // New field
    fine_arrears,       // New field
    adm_arrears,        // New field
    exam_arrears,       // New field
    misc_arrears        // New field
  } = req.body;

  const query = `
    UPDATE fee_tbl 
    SET 
      monthly_fee_feetbl = ?, 
      fine_fee = ?, 
      exam_fee = ?, 
      misc_fee = ?, 
      arrears = ?, 
      adm_fee = ?, 
      fine_arrears = ?, 
      adm_arrears = ?, 
      exam_arrears = ?, 
      misc_arrears = ?
    WHERE idf = ?
  `;

  db.query(query, [monthly_fee, fine_fee, exam_fee, misc_fee, arrears, adm_fee, fine_arrears, adm_arrears, exam_arrears, misc_arrears, idf], (error) => {
    if (error) {
      console.error("Database query error:", error);
      return res.status(500).json({ error: "Database query failed" });
    }
    res.status(200).json({ success: true });
  });
});



router.get("/edit/:idf", checkAuth, async (req, res) => {
  const idf = req.params.idf;
  const query = `
    SELECT fee_tbl.*, basicinfo.*
    FROM fee_tbl
    JOIN basicinfo ON fee_tbl.fee_adm_no = basicinfo.adm_no
    WHERE fee_tbl.idf = ?

  `;
  db.query(query, [idf], (error, result) => {
    if (error) {
      console.error("Database query error:", error);
      return res.status(500).json({ error: "Database query failed" });
    }
    res.status(200).json({ success: true, data: result[0] });
  });
});


router.post("/insert-single", checkAuth, async (req, res) => {
  const { adm_no, selected_date, standard, section, monthly_fee } = req.body;

  const selectedDate = new Date(selected_date);
  const selectedMonth = selectedDate.getMonth() + 1; // Get month from the selected date
  const selectedYear = selectedDate.getFullYear(); // Get year from the selected date

  // Check if a record exists for the adm_no, selectedMonth, and selectedYear
  const checkExistingQuery = "SELECT * FROM fee_tbl WHERE fee_adm_no = ? AND fmonth = ? AND fyear = ?";
  
  db.query(checkExistingQuery, [adm_no, selectedMonth, selectedYear], (checkErr, existingRecord) => {
    if (checkErr) {
      console.error("Check existing record error:", checkErr);
      return res.status(500).json({ error: "Database query failed" });
    }
    
    if (existingRecord.length > 0) {
      return res.status(400).json({ success: false, message: "Invoice can only be generated for a fresh month." });
    }

    // Check for past date
    const currentDate = new Date();
    if (selectedDate < new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)) {
      return res.status(400).json({ success: false, message: "Invoice cannot be generated for a past month." });
    }

    // Calculate total arrears from fee_tbl for the given adm_no for the current month
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth() + 1; // Months are 0-based in JavaScript

    const arrearsQuery = `
      SELECT 
        balance, 
        fine_balance, 
        adm_balance, 
        exam_balance, 
        misc_balance 
      FROM fee_tbl 
      WHERE fee_adm_no = ? AND fyear = ? AND fmonth = ?
    `;
    
    db.query(arrearsQuery, [adm_no, currentYear, currentMonth], (arrearsErr, arrearsResults) => {
      if (arrearsErr) {
        console.error("Calculate arrears error:", arrearsErr);
        return res.status(500).json({ error: "Database query failed" });
      }

      const feebalance = arrearsResults[0]?.balance || 0;
      const finebalance = arrearsResults[0]?.fine_balance || 0;
      const admbalance = arrearsResults[0]?.adm_balance || 0;
      const exambalance = arrearsResults[0]?.exam_balance || 0;
      const miscbalance = arrearsResults[0]?.misc_balance || 0;

      // Insert new record with calculated arrears
      const insertSQL = `
        INSERT INTO fee_tbl 
        (fee_adm_no, FeeStandard, sec, monthly_fee_feetbl, created_at, arrears, fine_arrears, exam_arrears, adm_arrears, misc_arrears) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      db.query(insertSQL, [adm_no, standard, section, monthly_fee, selected_date, feebalance, finebalance, exambalance, admbalance, miscbalance], (insertErr) => {
        if (insertErr) {
          console.error("Insert fee record error:", insertErr);
          return res.status(500).json({ error: "Failed to insert record." });
        }
        res.status(200).json({ success: true });
      });
    });
  });
});

// Get total number of students
router.get("/students/count", checkAuth, (req, res) => {
  const query = "SELECT COUNT(*) AS count FROM basicinfo"; // Assuming 'basicinfo' holds student data
  db.query(query, (error, results) => {
      if (error) {
          console.error("Database query error:", error);
          return res.status(500).json({ error: "Database query failed" });
      }
      res.status(200).json({ success: true, totalStudents: results[0].count });
  });
});

// Add error handling for database queries
router.get("/total", checkAuth, async (req, res) => {
  const query = "SELECT total_fee FROM fee_tbl WHERE fyear = ? AND fmonth = ?";
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  db.query(query, [currentYear, currentMonth], (error, results) => {
    if (error) {
      console.error("Database query error:", error);
      return res.status(500).json({ error: "Database query failed" });
    }
    res.status(200).json({ success: true, fees: results });
  });
});


// Get total collections
router.get("/collection", checkAuth, (req, res) => {
  const query = "SELECT IFNULL(SUM(collection), 0) AS total FROM fee_tbl WHERE fyear = ? AND fmonth = ?";
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  db.query(query, [currentYear, currentMonth], (error, results) => {
      if (error) {
          console.error("Database query error:", error);
          return res.status(500).json({ error: "Database query failed" });
      }
      res.status(200).json({ success: true, total: results[0].total });
  });
});

// Get total salaries
router.get("/salary/total", checkAuth, (req, res) => {
  const query = "SELECT IFNULL(SUM(total_salary), 0) AS total FROM salary_tbl WHERE year = ? AND month = ?";
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  db.query(query, [currentYear, currentMonth], (error, results) => {
      if (error) {
          console.error("Database query error:", error);
          return res.status(500).json({ error: "Database query failed" });
      }
      res.status(200).json({ success: true, total: results[0].total });
  });
});

router.delete("/:idf", checkAuth, async (req, res) => {
  const { idf } = req.params;

  try {
    const query = `DELETE FROM fee_tbl WHERE idf = ?`;
    const values = [idf];

    db.query(query, values, (error, results) => {
      if (error) {
        console.error("Error deleting fee record:", error);
        return res.status(500).json({ success: false, error: "Database query failed" });
      }

      if (results.affectedRows > 0) {
        res.status(200).json({ success: true, message: "Fee record deleted successfully" });
      } else {
        res.status(404).json({ success: false, error: "Fee record not found" });
      }
    });
  } catch (error) {
    console.error("Error deleting fee record:", error);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});


module.exports = router;
