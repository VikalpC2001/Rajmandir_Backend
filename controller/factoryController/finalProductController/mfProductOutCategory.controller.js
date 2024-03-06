const pool = require('../../../database');

// Get Category List

const getmfProductOutCategoryList = async (req, res) => {
    try {
        sql_queries_getCategoryTable = `SELECT
                                            fscd.stockOutCategoryId,
                                            fscd.stockOutCategoryName
                                        FROM
                                            factory_mfProductOutCategory_data AS fscd`;
        pool.query(sql_queries_getCategoryTable, (err, rows) => {
            if (err) {
                console.error("An error occurd in SQL Queery", err);
                return res.status(500).send('Database Error');;
            } else {
                return res.status(200).send(rows);
            }
        });
    } catch (error) {
        console.error('An error occurd', error);
        res.status(500).json('Internal Server Error');
    }
}

// Add stockOut Category API

const addmfProductOutCategory = async (req, res) => {
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
            req.body.productName = pool.query(`SELECT stockOutCategoryName FROM factory_mfProductOutCategory_data WHERE stockOutCategoryName = '${data.stockOutCategoryName}'`, function (err, row) {
                if (err) {
                    console.error("An error occurd in SQL Queery", err);
                    return res.status(500).send('Database Error');
                }
                if (row && row.length) {
                    return res.status(400).send('Category is Already In Use');
                } else {
                    const sql_querry_addCategory = `INSERT INTO factory_mfProductOutCategory_data (stockOutCategoryId, stockOutCategoryName)  
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

const removemfProductOutCategory = async (req, res) => {

    try {
        const stockOutCategoryId = req.query.stockOutCategoryId.trim();
        req.query.stockOutCategoryId = pool.query(`SELECT stockOutCategoryId FROM factory_mfProductOutCategory_data WHERE stockOutCategoryId = '${stockOutCategoryId}'`, (err, row) => {
            if (err) {
                console.error("An error occurd in SQL Queery", err);
                return res.status(500).send('Database Error');
            }
            if (row && row.length) {
                const sql_querry_removedetails = `DELETE FROM factory_mfProductOutCategory_data WHERE stockOutCategoryId = '${stockOutCategoryId}'`;
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
    } catch (error) {
        console.error('An error occurd', error);
        res.status(500).send('Internal Server Error');
    }
}

// Update stockOut Category API

const updatemfProductOutCategory = async (req, res) => {
    try {
        const data = {
            stockOutCategoryId: req.body.stockOutCategoryId.trim(),
            stockOutCategoryName: req.body.stockOutCategoryName.trim()
        }
        if (!data.stockOutCategoryName) {
            res.status(400).send("Please Add Category");
        }
        const sql_querry_updatedetails = `UPDATE factory_mfProductOutCategory_data SET stockOutCategoryName = '${data.stockOutCategoryName}'
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
    getmfProductOutCategoryList,
    addmfProductOutCategory,
    removemfProductOutCategory,
    updatemfProductOutCategory
}