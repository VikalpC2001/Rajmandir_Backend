const pool = require('../../database');
const { jsPDF } = require('jspdf');
require('jspdf-autotable');
const jwt = require("jsonwebtoken");

// Get Category List

const getStockInCategoryList = async (req, res) => {
    try {
        let token;
        token = req.headers ? req.headers.authorization.split(" ")[1] : null;
        if (token) {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const userId = decoded.id.id;
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
                sql_querry_getdetails = `SELECT count(*) as numRows FROM inventory_stockInCategory_data`;
                pool.query(sql_querry_getdetails, (err, rows, fields) => {
                    if (err) {
                        console.error("An error occurd in SQL Queery", err);
                        return res.status(500).send('Database Error');
                    } else {
                        const numRows = rows[0].numRows;
                        const numPages = Math.ceil(numRows / numPerPage);
                        if (req.query.startDate && req.query.endDate) {
                            sql_queries_getCategoryTable = `SELECT
                                                        iscd.stockInCategoryId,
                                                        iscd.stockInCategoryName,
                                                        ROUND((
                                                        SELECT
                                                            COALESCE(SUM(isd.totalPrice),
                                                            0)
                                                        FROM
                                                            inventory_stockIn_data AS isd
                                                        WHERE
                                                            isd.productId IN(
                                                            SELECT
                                                                COALESCE(ip.productId, NULL)
                                                            FROM
                                                                inventory_product_data AS ip
                                                            WHERE
                                                                ip.productCategoryId = iscd.stockInCategoryId
                                                        ) AND isd.branchId = '${branchId}' AND isd.stockInDate BETWEEN STR_TO_DATE('${startDate}','%b %d %Y') AND STR_TO_DATE('${endDate}','%b %d %Y'))
                                                    ) AS totalPurchase
                                                    FROM
                                                        inventory_stockInCategory_data AS iscd
                                                    LIMIT ${limit}`;
                        } else {
                            sql_queries_getCategoryTable = `SELECT
                                                        iscd.stockInCategoryId,
                                                        iscd.stockInCategoryName,
                                                        ROUND((
                                                        SELECT
                                                            COALESCE(SUM(isd.totalPrice),
                                                            0)
                                                        FROM
                                                            inventory_stockIn_data AS isd
                                                        WHERE
                                                            isd.productId IN(
                                                            SELECT
                                                                COALESCE(ip.productId, NULL)
                                                            FROM
                                                                inventory_product_data AS ip
                                                            WHERE
                                                                ip.productCategoryId = iscd.stockInCategoryId
                                                        ) AND isd.branchId = '${branchId}' AND isd.stockInDate BETWEEN STR_TO_DATE('${firstDay}','%b %d %Y') AND STR_TO_DATE('${lastDay}','%b %d %Y'))
                                                    ) AS totalPurchase
                                                    FROM
                                                        inventory_stockInCategory_data AS iscd
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

// Add stockIn Category API

const addstockInCategory = async (req, res) => {
    try {

        const uid1 = new Date();
        const stockInCategoryId = String("stockInCategory_" + uid1.getTime());
        console.log("...", stockInCategoryId);

        const data = {
            stockInCategoryName: req.body.stockInCategoryName.trim(),
        }
        if (!data.stockInCategoryName) {
            return res.status(400).send("Please Add Category");
        } else {
            req.body.productName = pool.query(`SELECT stockInCategoryName FROM inventory_stockInCategory_data WHERE stockInCategoryName = '${data.stockInCategoryName}'`, function (err, row) {
                if (err) {
                    console.error("An error occurd in SQL Queery", err);
                    return res.status(500).send('Database Error');
                }
                if (row && row.length) {
                    return res.status(400).send('Category is Already In Use');
                } else {
                    const sql_querry_addCategory = `INSERT INTO inventory_stockInCategory_data (stockInCategoryId, stockInCategoryName)  
                                                    VALUES ('${stockInCategoryId}','${data.stockInCategoryName}')`;
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

// Remove stockInCategory API

const removestockInCategory = async (req, res) => {
    try {
        let token;
        token = req.headers ? req.headers.authorization.split(" ")[1] : null;
        if (token) {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const rights = decoded.id.rights;
            if (rights == 1) {
                const stockInCategoryId = req.query.stockInCategoryId.trim();
                if (stockInCategoryId == 'sa') {
                    return res.status(400).send('You Can Not Delet Static Category');
                }
                req.query.stockInCategoryId = pool.query(`SELECT stockInCategoryId FROM inventory_stockInCategory_data WHERE stockInCategoryId = '${stockInCategoryId}'`, (err, row) => {
                    if (err) {
                        console.error("An error occurd in SQL Queery", err);
                        return res.status(500).send('Database Error');
                    }
                    if (row && row.length) {
                        const sql_querry_removedetails = `DELETE FROM inventory_stockInCategory_data WHERE stockInCategoryId = '${stockInCategoryId}'`;
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

// Update stockIn Category API

const updatestockInCategory = async (req, res) => {
    try {
        const data = {
            stockInCategoryId: req.body.stockInCategoryId.trim(),
            stockInCategoryName: req.body.stockInCategoryName.trim()
        }
        if (!data.stockInCategoryName) {
            res.status(400).send("Please Add Category");
        }
        const sql_querry_updatedetails = `UPDATE inventory_stockInCategory_data SET stockInCategoryName = '${data.stockInCategoryName}'
                                          WHERE stockInCategoryId = '${data.stockInCategoryId}'`;
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
    getStockInCategoryList,
    addstockInCategory,
    removestockInCategory,
    updatestockInCategory
}