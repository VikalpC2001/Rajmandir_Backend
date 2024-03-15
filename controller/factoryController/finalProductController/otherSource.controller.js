const pool = require('../../../database');
const jwt = require("jsonwebtoken");

// Get Other Source List

const getOtherSourceList = (req, res) => {
    try {
        let token;
        token = req.headers.authorization ? req.headers.authorization.split(" ")[1] : null;
        if (token) {
            const page = req.query.page;
            const numPerPage = req.query.numPerPage;
            const skip = (page - 1) * numPerPage;
            const limit = skip + ',' + numPerPage;
            sql_querry_getCountdetails = `SELECT count(*) as numRows FROM factory_otherSource_data`;
            pool.query(sql_querry_getCountdetails, (err, rows, fields) => {
                if (err) {
                    console.error("An error occurd in SQL Queery", err);
                    return res.status(500).send('Database Error');
                } else {
                    const numRows = rows[0].numRows;
                    const numPages = Math.ceil(numRows / numPerPage);
                    const commanQuarry = `SELECT
                                              otherSourceId,
                                              otherSourceName,
                                              otherSourceUnit,
                                              otherSourcePrice
                                          FROM
                                              factory_otherSource_data`;
                    sql_queries_getdetails = `${commanQuarry}
                                                ORDER BY factory_otherSource_data.otherSourceName
                                                LIMIT ${limit}`;
                    pool.query(sql_queries_getdetails, (err, rows, fields) => {
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
            return res.status(401).send("Please Login Firest.....!");
        }
    } catch (error) {
        console.error('An error occurd', error);
        res.status(500).send('Internal Server Error');
    }
}

// Add Other Source Data

const addOtherSourceData = (req, res) => {
    try {
        const uid1 = new Date();
        const otherSourceId = String("otherSource_" + uid1.getTime());

        const data = {
            otherSourceName: req.body.otherSourceName.trim(),
            otherSourceUnit: req.body.otherSourceUnit.trim(),
            otherSourcePrice: req.body.otherSourcePrice,
        }
        if (!data.otherSourceName || !data.otherSourcePrice || !data.otherSourceUnit) {
            return res.status(400).send("Please Fill All the Fields....!");
        } else {
            req.body.productName = pool.query(`SELECT otherSourceName FROM factory_otherSource_data WHERE otherSourceName = '${data.otherSourceName}'`, function (err, row) {
                if (err) {
                    console.error("An error occurd in SQL Queery", err);
                    return res.status(500).send('Database Error');
                }
                if (row && row.length) {
                    return res.status(400).send('Source is Already In Use');
                } else {
                    const sql_querry_addCategory = `INSERT INTO factory_otherSource_data (otherSourceId, otherSourceName, otherSourceUnit, otherSourcePrice)  
                                                    VALUES ('${otherSourceId}', '${data.otherSourceName}', '${data.otherSourceUnit}', ${data.otherSourcePrice})`;
                    pool.query(sql_querry_addCategory, (err, data) => {
                        if (err) {
                            console.error("An error occurd in SQL Queery", err);
                            return res.status(500).send('Database Error');
                        }
                        return res.status(200).send("Source Added Successfully");
                    })
                }
            })
        }
    } catch (error) {
        console.error('An error occurd', error);
        res.status(500).send('Internal Server Error');
    }
}

// Remove Other Source Data

const removeOtherSourceData = (req, res) => {
    try {
        let token;
        token = req.headers ? req.headers.authorization.split(" ")[1] : null;
        if (token) {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const rights = decoded.id.rights;
            if (rights == 1) {
                const otherSourceId = req.query.otherSourceId.trim();
                req.query.mfProductCategoryId = pool.query(`SELECT otherSourceId FROM factory_otherSource_data WHERE otherSourceId = '${otherSourceId}'`, (err, row) => {
                    if (err) {
                        console.error("An error occurd in SQL Queery", err);
                        return res.status(500).send('Database Error');
                    }
                    if (row && row.length) {
                        const sql_querry_removedetails = `DELETE FROM factory_otherSource_data WHERE otherSourceId = '${otherSourceId}'`;
                        pool.query(sql_querry_removedetails, (err, data) => {
                            if (err) {
                                console.error("An error occurd in SQL Queery", err);
                                return res.status(500).send('Database Error');
                            }
                            return res.status(200).send("Source Deleted Successfully");
                        })
                    } else {
                        return res.send('SourceId Not Found');
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

// Update Other Source Data

const updateOtherSourceData = (req, res) => {
    try {
        const data = {
            otherSourceId: req.body.otherSourceId.trim(),
            otherSourceName: req.body.otherSourceName.trim(),
            otherSourceUnit: req.body.otherSourceUnit.trim(),
            otherSourcePrice: req.body.otherSourcePrice,
        }
        if (!data.otherSourceName || !data.otherSourcePrice || !data.otherSourceUnit) {
            return res.status(400).send("Please Fill All the Fields....!");
        }
        const sql_querry_updatedetails = `UPDATE
                                              factory_otherSource_data
                                          SET
                                              otherSourceName = '${data.otherSourceName}',
                                              otherSourceUnit = '${data.otherSourceUnit}',
                                              otherSourcePrice = ${data.otherSourcePrice}
                                          WHERE
                                              otherSourceId = '${data.otherSourceId}'`;
        pool.query(sql_querry_updatedetails, (err, data) => {
            if (err) {
                console.error("An error occurd in SQL Queery", err);
                return res.status(500).send('Database Error');
            }
            return res.status(200).send("Source Updated Successfully");
        })
    } catch (error) {
        console.error('An error occurd', error);
        res.status(500).send('Internal Server Error');
    }
}

module.exports = {
    getOtherSourceList,
    addOtherSourceData,
    removeOtherSourceData,
    updateOtherSourceData
}