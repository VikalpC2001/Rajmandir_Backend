const pool = require('../../database');
const { jsPDF } = require('jspdf');
require('jspdf-autotable');
const jwt = require("jsonwebtoken");

// Get Category List

const getStockOutCategoryList = async (req, res) => {
    try {
        let token;
        token = req.headers ? req.headers.authorization.split(" ")[1] : null;
        if (token) {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const branchId = decoded.id.branchId ? decoded.id.branchId : null;
            if (branchId) {
                const page = req.query.page;
                const numPerPage = req.query.numPerPage;
                const skip = (page - 1) * numPerPage;
                const limit = skip + ',' + numPerPage;
                var date = new Date(), y = date.getFullYear(), m = (date.getMonth());
                var firstDay = new Date(y, m, 1).toString().slice(4, 15);
                var lastDay = new Date(y, m + 1, 0).toString().slice(4, 15);
                const startDate = (req.query.startDate ? req.query.startDate : '').slice(4, 15);
                const endDate = (req.query.endDate ? req.query.endDate : '').slice(4, 15);
                sql_querry_getdetails = `SELECT count(*) as numRows FROM inventory_stockOutCategory_data`;
                pool.query(sql_querry_getdetails, (err, rows, fields) => {
                    if (err) {
                        console.error("An error occurd in SQL Queery", err);
                        return res.status(500).send('Database Error');
                    } else {
                        const numRows = rows[0].numRows;
                        const numPages = Math.ceil(numRows / numPerPage);
                        if (req.query.startDate && req.query.endDate) {
                            sql_queries_getCategoryTable = `SELECT
                                                                iscod.stockOutCategoryId,
                                                                iscod.stockOutCategoryName,
                                                                COALESCE(SUM(iso.stockOutPrice),0) AS totalUsedPrice
                                                            FROM
                                                                inventory_stockOutCategory_data AS iscod
                                                            LEFT JOIN inventory_stockOut_data AS iso ON iso.stockOutCategory = iscod.stockOutCategoryId 
                                                            AND iso.branchId = '${branchId}' AND iso.stockOutDate BETWEEN STR_TO_DATE('${startDate}','%b %d %Y') AND STR_TO_DATE('${endDate}','%b %d %Y')
                                                            GROUP BY iscod.stockOutCategoryId
                                                            ORDER BY iscod.stockOutCategoryName
                                                            LIMIT ${limit}`;
                        } else {
                            sql_queries_getCategoryTable = `SELECT
                                                                iscod.stockOutCategoryId,
                                                                iscod.stockOutCategoryName,
                                                                COALESCE(SUM(iso.stockOutPrice),0) AS totalUsedPrice
                                                            FROM
                                                                inventory_stockOutCategory_data AS iscod
                                                            LEFT JOIN inventory_stockOut_data AS iso ON iso.stockOutCategory = iscod.stockOutCategoryId 
                                                            AND iso.branchId = '${branchId}' AND iso.stockOutDate BETWEEN STR_TO_DATE('${firstDay}','%b %d %Y') AND STR_TO_DATE('${lastDay}','%b %d %Y')
                                                            GROUP BY iscod.stockOutCategoryId
                                                            ORDER BY iscod.stockOutCategoryName
                                                            LIMIT ${limit}`;
                        }
                        pool.query(sql_queries_getCategoryTable, (err, rows, fields) => {
                            if (err) {
                                console.error("An error occurd in SQL Queery", err);
                                return res.status(500).send('Database Error');;
                            } else {
                                console.log(rows);
                                console.log(numRows);
                                console.log("Total Page :-", numPages);
                                if (numRows === 0) {
                                    const rows = [{
                                        'msg': 'No Data Found'
                                    }]
                                    return res.status(200).send({ rows, numRows });
                                } else {
                                    return res.status(200).send({ rows, numRows });
                                }
                            }
                        });
                    }
                })
            } else {
                return res.status(404).send("Branch Id Not Found..!")
            }
        } else {
            return res.status(401).send("Please Login Firest.....!");
        }
    } catch (error) {
        console.error('An error occurd', error);
        res.status(500).json('Internal Server Error');
    }
}

// Add stockOut Category API

const addstockOutCategory = async (req, res) => {
    try {

        const uid1 = new Date();
        const stockOutCategoryId = String("stockOutCategory_" + uid1.getTime());
        console.log("...", stockOutCategoryId);

        const data = {
            stockOutCategoryName: req.body.stockOutCategoryName.trim(),
        }
        if (!data.stockOutCategoryName) {
            return res.status(400).send("Please Add Category");
        } else {
            req.body.productName = pool.query(`SELECT stockOutCategoryName FROM inventory_stockOutCategory_data WHERE stockOutCategoryName = '${data.stockOutCategoryName}'`, function (err, row) {
                if (err) {
                    console.error("An error occurd in SQL Queery", err);
                    return res.status(500).send('Database Error');
                }
                if (row && row.length) {
                    return res.status(400).send('Category is Already In Use');
                } else {
                    const sql_querry_addCategory = `INSERT INTO inventory_stockOutCategory_data (stockOutCategoryId, stockOutCategoryName)  
                                                    VALUES ('${stockOutCategoryId}','${data.stockOutCategoryName}')`;
                    pool.query(sql_querry_addCategory, (err, data) => {
                        if (err) {
                            console.error("An error occurd in SQL Queery", err);
                            return res.status(500).send('Database Error');
                        }
                        return res.status(200).send("Category Added Successfully");
                    })
                }
            })
        }
    } catch (error) {
        console.error('An error occurd', error);
        res.status(500).send('Internal Server Error');
    }
}

// Remove stockOutCategory API

const removeStockOutCategory = async (req, res) => {
    try {
        let token;
        token = req.headers ? req.headers.authorization.split(" ")[1] : null;
        if (token) {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const rights = decoded.id.rights;
            if (rights == 1) {
                const stockOutCategoryId = req.query.stockOutCategoryId.trim();
                if (stockOutCategoryId == process.env.AUTO_STOCKOUT_ID || stockOutCategoryId == 'Regular') {
                    return res.status(400).send('You Can Not Delet Static Category');
                }
                req.query.stockOutCategoryId = pool.query(`SELECT stockOutCategoryId FROM inventory_stockOutCategory_data WHERE stockOutCategoryId = '${stockOutCategoryId}'`, (err, row) => {
                    if (err) {
                        console.error("An error occurd in SQL Queery", err);
                        return res.status(500).send('Database Error');
                    }
                    if (row && row.length) {
                        const sql_querry_removedetails = `DELETE FROM inventory_stockOutCategory_data WHERE stockOutCategoryId = '${stockOutCategoryId}'`;
                        pool.query(sql_querry_removedetails, (err, data) => {
                            if (err) {
                                console.error("An error occurd in SQL Queery", err);
                                return res.status(500).send('Database Error');
                            }
                            return res.status(200).send("Category Deleted Successfully");
                        })
                    } else {
                        return res.send('CategoryId Not Found');
                    }
                })
            } else {
                return res.status(400).send('You are Not Authorised');
            }
        } else {
            return res.status(404).send('Please Login First...!');
        }
    } catch (error) {
        console.error('An error occurd', error);
        res.status(500).send('Internal Server Error');
    }
}

// Update stockOut Category API

const updateStockOutCategory = async (req, res) => {
    try {
        const data = {
            stockOutCategoryId: req.body.stockOutCategoryId.trim(),
            stockOutCategoryName: req.body.stockOutCategoryName.trim()
        }
        if (!data.stockOutCategoryName) {
            res.status(400).send("Please Add Category");
        }
        const sql_querry_updatedetails = `UPDATE inventory_stockOutCategory_data SET stockOutCategoryName = '${data.stockOutCategoryName}'
                                          WHERE stockOutCategoryId = '${data.stockOutCategoryId}'`;
        pool.query(sql_querry_updatedetails, (err, data) => {
            if (err) {
                console.error("An error occurd in SQL Queery", err);
                return res.status(500).send('Database Error');
            }
            return res.status(200).send("Category Updated Successfully");
        })
    } catch (error) {
        console.error('An error occurd', error);
        res.status(500).send('Internal Server Error');
    }
}

module.exports = {
    getStockOutCategoryList,
    addstockOutCategory,
    removeStockOutCategory,
    updateStockOutCategory
}