const pool = require('../../database');
const pool2 = require('../../databasePool');
const jwt = require("jsonwebtoken");

// Get Branch Dashboard

const getBranchList = (req, res) => {
    try {
        sql_querry_getDetails = `SELECT branchId, branchName FROM branch_data ORDER BY branchName ASC`;
        pool.query(sql_querry_getDetails, (err, data) => {
            if (err) {
                console.error("An error occurd in SQL Queery", err);
                return res.status(500).send('Database Error');
            }
            return res.status(200).send(data);
        })
    } catch (error) {
        console.error('An error occurd', error);
        res.status(500).send('Internal Server Error');
    }
}

// Add Branch API

const addBranch = (req, res) => {
    pool2.getConnection((err, connection) => {
        if (err) {
            console.error('Connection Error', err);
            return res.status(500).send('Database Connection Error');
        }
        try {
            let token;
            token = req.headers ? req.headers.authorization.split(" ")[1] : null;
            if (token) {
                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                const rights = decoded.id.rights;
                if (rights == 1) {
                    const branchName = req.body.branchName?.trim();
                    if (!branchName) {
                        connection.release();
                        return res.status(400).send("Please Fill All The Fields....!");
                    }

                    const branchId = `branchId_${Date.now()}`;

                    connection.beginTransaction((err) => {
                        if (err) {
                            console.error('Transaction Error', err);
                            connection.release();
                            return res.status(500).send('Transaction Error');
                        }

                        // 1️⃣ Check branch exists
                        const sql_check = `SELECT branchId FROM branch_data WHERE branchName = ?`;
                        connection.query(sql_check, [branchName], (err, result) => {
                            if (err) {
                                console.error('Error Checking Branch', err);
                                return connection.rollback(() => {
                                    connection.release();
                                    res.status(500).send('Database Error');
                                });
                            }

                            if (result.length > 0) {
                                return connection.rollback(() => {
                                    connection.release();
                                    res.status(400).send('Branch is Already In Use');
                                });
                            }

                            // 2️⃣ Insert branch
                            const sql_insert_branch = `
                        INSERT INTO branch_data (branchId, branchName)
                        VALUES (?, ?)
                    `;

                            connection.query(sql_insert_branch, [branchId, branchName], (err) => {
                                if (err) {
                                    console.error('Error Insert Branch', err);
                                    return connection.rollback(() => {
                                        connection.release();
                                        res.status(500).send('Database Error');
                                    });
                                }

                                // 3️⃣ Insert branch-wise categories
                                const sql_insert_branchWiseCategory = `
                            INSERT INTO billing_branchWiseCategory_data
                            (
                                bwcId,
                                branchId,
                                categoryId,
                                menuId,
                                firmId,
                                isOfficial,
                                billFooterNote,
                                appriciateLine,
                                categoryStatus
                            )
                            SELECT
                                CONCAT('bwc_', FLOOR(UNIX_TIMESTAMP(NOW()) * 1000) + ROW_NUMBER() OVER()),
                                ?,
                                categoryId,
                                '${process.env.BASE_MENU}',
                                'A',
                                0,
                                NULL,
                                NULL,
                                1
                            FROM billing_category_data`;

                                connection.query(sql_insert_branchWiseCategory, [branchId], (err) => {
                                    if (err) {
                                        console.error('Error Insert BranchWise Category', err);
                                        return connection.rollback(() => {
                                            connection.release();
                                            res.status(500).send('Database Error');
                                        });
                                    }

                                    // 4️⃣ Commit transaction
                                    connection.commit((err) => {
                                        if (err) {
                                            console.error('Commit Error', err);
                                            return connection.rollback(() => {
                                                connection.release();
                                                res.status(500).send('Database Error');
                                            });
                                        }

                                        connection.release();
                                        return res.status(200).send("Branch Added Successfully");
                                    });
                                });
                            });
                        });
                    });

                } else {
                    connection.rollback(() => {
                        connection.release();
                        return res.status(400).send('You are not Authorised.');
                    });
                }
            } else {
                connection.rollback(() => {
                    connection.release();
                    return res.status(404).send('Please Login First....!');
                });
            }
        } catch (error) {
            console.error('Internal Error', error);
            connection.rollback(() => {
                connection.release();
                res.status(500).send('Internal Server Error');
            });
        }
    });
};


// Remove Branch API

const removeBranch = async (req, res) => {
    try {
        let token;
        token = req.headers ? req.headers.authorization.split(" ")[1] : null;
        if (token) {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const rights = decoded.id.rights;
            if (rights == 1) {
                const branchId = req.query.branchId ? req.query.branchId.trim() : null;
                if (!branchId) {
                    return res.status(404).send('Id Not Found');
                }
                req.query.stockInCategoryId = pool.query(`SELECT branchId FROM branch_data WHERE branchId = '${branchId}'`, (err, row) => {
                    if (err) {
                        console.error("An error occurd in SQL Queery", err);
                        return res.status(500).send('Database Error');
                    }
                    if (row && row.length) {
                        const sql_querry_removedetails = `DELETE FROM branch_data WHERE branchId = '${branchId}'`;
                        pool.query(sql_querry_removedetails, (err, data) => {
                            if (err) {
                                console.error("An error occurd in SQL Queery", err);
                                return res.status(500).send('Database Error');
                            }
                            return res.status(200).send("Branch Deleted Successfully");
                        })
                    } else {
                        return res.send('BranchId Not Found');
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

// Update Branch API

const updateBranch = async (req, res) => {
    try {
        let token;
        token = req.headers ? req.headers.authorization.split(" ")[1] : null;
        if (token) {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const rights = decoded.id.rights;
            if (rights == 1) {
                const data = {
                    branchId: req.body.branchId.trim(),
                    branchName: req.body.branchName.trim()
                }
                if (!data.branchName) {
                    res.status(400).send("Please Add branchName");
                }
                const sql_querry_updatedetails = `UPDATE branch_data SET branchName = '${data.branchName}'
                                                  WHERE branchId = '${data.branchId}'`;
                pool.query(sql_querry_updatedetails, (err, data) => {
                    if (err) {
                        console.error("An error occurd in SQL Queery", err);
                        return res.status(500).send('Database Error');
                    }
                    return res.status(200).send("Branch Updated Successfully");
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

module.exports = {
    getBranchList,
    addBranch,
    removeBranch,
    updateBranch
}
