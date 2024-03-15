const pool = require('../../../database');
const jwt = require("jsonwebtoken");

// Get Manufacture Product Category List

const getMfProductCategoryList = async (req, res) => {
    try {
        var sql_queries_getCategoryTable = `SELECT
                                                fmpd.mfProductCategoryId,
                                                fmpd.mfProductCategoryName
                                            FROM
                                                factory_mfProductCategory_data AS fmpd
                                            ORDER BY fmpd.mfProductCategoryName`;

        pool.query(sql_queries_getCategoryTable, (err, rows, fields) => {
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

// Add Manufacture Product Category API

const addMfProductCategory = async (req, res) => {
    try {
        let token;
        token = req.headers ? req.headers.authorization.split(" ")[1] : null;
        if (token) {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const rights = decoded.id.rights;
            if (rights == 1) {
                const uid1 = new Date();
                const mfProductCategoryId = String("mfCategory_" + uid1.getTime());

                const data = {
                    mfProductCategoryName: req.body.mfProductCategoryName.trim(),
                }
                if (!data.mfProductCategoryName) {
                    return res.status(400).send("Please Add Category");
                } else {
                    req.body.productName = pool.query(`SELECT mfProductCategoryName FROM factory_mfProductCategory_data WHERE mfProductCategoryName = '${data.mfProductCategoryName}'`, function (err, row) {
                        if (err) {
                            console.error("An error occurd in SQL Queery", err);
                            return res.status(500).send('Database Error');
                        }
                        if (row && row.length) {
                            return res.status(400).send('Category is Already In Use');
                        } else {
                            const sql_querry_addCategory = `INSERT INTO factory_mfProductCategory_data (mfProductCategoryId, mfProductCategoryName)  
                                                    VALUES ('${mfProductCategoryId}','${data.mfProductCategoryName}')`;
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

// Remove Manufacture Product Category API

const removeMfProductCategory = async (req, res) => {
    try {
        let token;
        token = req.headers ? req.headers.authorization.split(" ")[1] : null;
        if (token) {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const rights = decoded.id.rights;
            if (rights == 1) {
                const mfProductCategoryId = req.query.mfProductCategoryId.trim();
                req.query.mfProductCategoryId = pool.query(`SELECT mfProductCategoryId FROM factory_mfProductCategory_data WHERE mfProductCategoryId = '${mfProductCategoryId}'`, (err, row) => {
                    if (err) {
                        console.error("An error occurd in SQL Queery", err);
                        return res.status(500).send('Database Error');
                    }
                    if (row && row.length) {
                        const sql_querry_removedetails = `DELETE FROM factory_mfProductCategory_data WHERE mfProductCategoryId = '${mfProductCategoryId}'`;
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

// Update Manufacture Product Category API

const updateMfProductCategory = async (req, res) => {
    try {
        const data = {
            mfProductCategoryId: req.body.mfProductCategoryId.trim(),
            mfProductCategoryName: req.body.mfProductCategoryName.trim()
        }
        if (!data.mfProductCategoryName) {
            return res.status(400).send("Please Add Category");
        }
        const sql_querry_updatedetails = `UPDATE factory_mfProductCategory_data SET mfProductCategoryName = '${data.mfProductCategoryName}'
                                          WHERE mfProductCategoryId = '${data.mfProductCategoryId}'`;
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
    getMfProductCategoryList,
    addMfProductCategory,
    removeMfProductCategory,
    updateMfProductCategory
}