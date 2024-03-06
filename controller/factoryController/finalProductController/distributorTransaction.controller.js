const pool = require('../../../database');
const jwt = require("jsonwebtoken");

// Get Transaction List API

const getdistributorDebitTransactionList = async (req, res) => {
    try {
        let token;
        token = req.headers.authorization ? req.headers.authorization.split(" ")[1] : null;
        if (token) {
            const page = req.query.page;
            const numPerPage = req.query.numPerPage;
            const skip = (page - 1) * numPerPage;
            const limit = skip + ',' + numPerPage;
            var date = new Date(), y = date.getFullYear(), m = (date.getMonth());
            var firstDay = new Date(y, m, 1).toString().slice(4, 15);
            var lastDay = new Date(y, m + 1, 0).toString().slice(4, 15);

            console.log("1111>>>>", firstDay);
            console.log("1111>>>>", lastDay);
            const data = {
                startDate: (req.query.startDate ? req.query.startDate : '').slice(4, 15),
                endDate: (req.query.endDate ? req.query.endDate : '').slice(4, 15),
                distributorId: req.query.distributorId,
                searchInvoiceNumber: req.query.searchInvoiceNumber
            }
            if (req.query.distributorId && req.query.startDate && req.query.endDate) {
                sql_querry_getCountdetails = `SELECT count(*) as numRows FROM factory_distributorTransaction_data WHERE factory_distributorTransaction_data.distributorId = '${data.distributorId}' AND factory_distributorTransaction_data.transactionDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y') `;
            } else if (req.query.startDate && req.query.endDate) {
                sql_querry_getCountdetails = `SELECT count(*) as numRows FROM factory_distributorTransaction_data WHERE factory_distributorTransaction_data.transactionDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')`;
            } else if (req.query.distributorId) {
                sql_querry_getCountdetails = `SELECT count(*) as numRows FROM factory_distributorTransaction_data WHERE factory_distributorTransaction_data.distributorId = '${data.distributorId}' AND factory_distributorTransaction_data.transactionDate BETWEEN STR_TO_DATE('${firstDay}','%b %d %Y') AND STR_TO_DATE('${lastDay}','%b %d %Y')`;
            } else if (req.query.searchInvoiceNumber) {
                sql_querry_getCountdetails = `SELECT count(*) as numRows FROM factory_distributorTransaction_data WHERE distributorTransactionId LIKE '%` + data.searchInvoiceNumber + `%'`;
            } else {
                sql_querry_getCountdetails = `SELECT count(*) as numRows FROM factory_distributorTransaction_data WHERE factory_distributorTransaction_data.transactionDate BETWEEN STR_TO_DATE('${firstDay}','%b %d %Y') AND STR_TO_DATE('${lastDay}','%b %d %Y')`;
            }
            pool.query(sql_querry_getCountdetails, (err, rows, fields) => {
                if (err) {
                    console.error("An error occurd in SQL Queery", err);
                    return res.status(500).send('Database Error');
                } else {
                    const numRows = rows[0].numRows;
                    const numPages = Math.ceil(numRows / numPerPage);
                    const sql_common_qurey = `SELECT distributorTransactionId,RIGHT(distributorTransactionId,9) AS invoiceNumber, CONCAT(user_details.userFirstName,' ',user_details.userLastName) AS paidBy, factory_distributor_data.distributorNickName, receivedBy, pendingAmount, paidAmount, transactionNote, DATE_FORMAT(transactionDate,'%d-%M-%Y') AS transactionDate, DATE_FORMAT(distributorTransactionCreationDate,'%h:%i %p') AS transactionTime 
                                                  FROM factory_distributorTransaction_data
                                                  LEFT JOIN user_details ON user_details.userId = factory_distributorTransaction_data.UserId
                                                  LEFT JOIN factory_distributor_data ON factory_distributor_data.distributorId = factory_distributorTransaction_data.distributorId`;
                    if (req.query.distributorId && req.query.startDate && req.query.endDate) {
                        sql_queries_getdetails = `${sql_common_qurey}
                                                        WHERE factory_distributorTransaction_data.distributorId = '${data.distributorId}' AND factory_distributorTransaction_data.transactionDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y') 
                                                        ORDER BY factory_distributorTransaction_data.transactionDate ,factory_distributorTransaction_data.distributorTransactionCreationDate DESC 
                                                        LIMIT ${limit}`;
                    } else if (req.query.startDate && req.query.endDate) {
                        sql_queries_getdetails = `${sql_common_qurey}
                                                        WHERE factory_distributorTransaction_data.transactionDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y') 
                                                        ORDER BY factory_distributorTransaction_data.transactionDate, factory_distributorTransaction_data.distributorTransactionCreationDate DESC 
                                                        LIMIT ${limit}`;
                    } else if (req.query.distributorId) {
                        sql_queries_getdetails = `${sql_common_qurey}
                                                        WHERE factory_distributorTransaction_data.distributorId = '${data.distributorId}' AND factory_distributorTransaction_data.transactionDate BETWEEN STR_TO_DATE('${firstDay}','%b %d %Y') AND STR_TO_DATE('${lastDay}','%b %d %Y')
                                                        ORDER BY factory_distributorTransaction_data.transactionDate, factory_distributorTransaction_data.distributorTransactionCreationDate DESC 
                                                        LIMIT ${limit}`;
                    } else if (req.query.searchInvoiceNumber) {
                        sql_queries_getdetails = `${sql_common_qurey}
                                                        WHERE distributorTransactionId LIKE '%` + data.searchInvoiceNumber + `%'
                                                        ORDER BY factory_distributorTransaction_data.transactionDate, factory_distributorTransaction_data.distributorTransactionCreationDate DESC 
                                                        LIMIT ${limit}`;
                    } else {
                        sql_queries_getdetails = `${sql_common_qurey}
                                                        WHERE factory_distributorTransaction_data.transactionDate BETWEEN STR_TO_DATE('${firstDay}','%b %d %Y') AND STR_TO_DATE('${lastDay}','%b %d %Y')
                                                        ORDER BY factory_distributorTransaction_data.transactionDate, factory_distributorTransaction_data.distributorTransactionCreationDate DESC LIMIT ${limit}`;
                    }
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
            return res.status(401).send('Pleasr Login Firest.....!');
        }
    } catch (error) {
        console.error('An error occurd', error);
        res.status(500).json('Internal Server Error');
    }
}

// Cash Transaction Count API

const getDistributorCashTransactionCounter = (req, res) => {
    try {
        let token;
        token = req.headers.authorization ? req.headers.authorization.split(" ")[1] : null;
        if (token) {
            var date = new Date(), y = date.getFullYear(), m = (date.getMonth());
            var firstDay = new Date(y, m, 1).toString().slice(4, 15);
            var lastDay = new Date(y, m + 1, 0).toString().slice(4, 15);

            console.log("1111>>>>", firstDay);
            console.log("1111>>>>", lastDay);

            const data = {
                startDate: (req.query.startDate ? req.query.startDate : '').slice(4, 15),
                endDate: (req.query.endDate ? req.query.endDate : '').slice(4, 15),
            }
            if (req.query.startDate && req.query.endDate) {
                sql_querry_getCashCount = `SELECT COALESCE(ROUND(SUM(sellAmount)),0) AS totalSell FROM factory_distributorWiseOut_data WHERE sellDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y');
                                           SELECT COALESCE(ROUND(SUM(sellAmount)),0) AS totalSellOfCash FROM factory_distributorWiseOut_data WHERE payType = 'cash' AND sellDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')`;
            } else {
                sql_querry_getCashCount = `SELECT COALESCE(ROUND(SUM(sellAmount)),0) AS totalSell FROM factory_distributorWiseOut_data WHERE sellDate BETWEEN STR_TO_DATE('${firstDay}','%b %d %Y') AND STR_TO_DATE('${lastDay}','%b %d %Y');
                                           SELECT COALESCE(ROUND(SUM(sellAmount)),0) AS totalSellOfCash FROM factory_distributorWiseOut_data WHERE payType = 'cash' AND sellDate BETWEEN STR_TO_DATE('${firstDay}','%b %d %Y') AND STR_TO_DATE('${lastDay}','%b %d %Y')`;
            }
            pool.query(sql_querry_getCashCount, (err, data) => {
                if (err) {
                    console.error("An error occurd in SQL Queery", err);
                    return res.status(500).send('Database Error');
                }
                else if (data == '') {
                    const msg = [{
                        'msg': 'No Data Available'
                    }]
                    return res.status(400).send(msg);
                } else {
                    const count = {
                        totalExpense: data[0][0].totalSell,
                        totalExpenseOfCash: data[1][0].totalSellOfCash,
                    }
                    return res.status(200).send(count);
                }
            })
        } else {
            return res.status(401).send('Pleasr Login Firest.....!');
        }
    } catch (error) {
        console.error('An error occurd', error);
        res.status(500).json('Internal Server Error');
    }
}

// Debit Transaction Count API

const getDistributorDebitTransactionCounter = (req, res) => {
    try {
        let token;
        token = req.headers.authorization ? req.headers.authorization.split(" ")[1] : null;
        if (token) {
            var date = new Date(), y = date.getFullYear(), m = (date.getMonth());
            var firstDay = new Date(y, m, 1).toString().slice(4, 15);
            var lastDay = new Date(y, m + 1, 0).toString().slice(4, 15);

            console.log("1111>>>>", firstDay);
            console.log("1111>>>>", lastDay);

            const data = {
                startDate: (req.query.startDate ? req.query.startDate : '').slice(4, 15),
                endDate: (req.query.endDate ? req.query.endDate : '').slice(4, 15),
            }
            const sql_querry_remailAmount = `SELECT SUM(COALESCE(sisd.total_price, 0) - COALESCE(sosd.total_paid, 0)) AS remainingAmount FROM factory_distributor_data AS fdd
                                              LEFT JOIN
                                                     (
                                                         SELECT
                                                             factory_distributorWiseOut_data.distributorId,
                                                             ROUND(SUM(factory_distributorWiseOut_data.sellAmount)) AS total_price
                                                         FROM
                                                             factory_distributorWiseOut_data
                                                         WHERE factory_distributorWiseOut_data.payType = 'debit'
                                                         GROUP BY
                                                             factory_distributorWiseOut_data.distributorId
                                                     ) AS sisd ON fdd.distributorId = sisd.distributorId
                                            LEFT JOIN
                                                     (
                                                         SELECT
                                                             factory_distributorTransaction_data.distributorId,
                                                             ROUND(SUM(factory_distributorTransaction_data.paidAmount)) AS total_paid
                                                         FROM
                                                             factory_distributorTransaction_data
                                                         GROUP BY
                                                             factory_distributorTransaction_data.distributorId
                                                     ) AS sosd ON fdd.distributorId = sosd.distributorId`;
            if (req.query.startDate && req.query.endDate) {
                sql_querry_getDebitCount = `SELECT COALESCE(ROUND(SUM(sellAmount)),0) AS totalSell FROM factory_distributorWiseOut_data WHERE sellDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y');
                                                SELECT COALESCE(ROUND(SUM(sellAmount)),0) AS totalSellOfDebit FROM factory_distributorWiseOut_data WHERE payType = 'debit' AND sellDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y');
                                                SELECT COALESCE(ROUND(SUM(paidAmount)),0) AS totalGain FROM factory_distributorTransaction_data WHERE transactionDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y');
                                                ${sql_querry_remailAmount}`;
            } else {
                sql_querry_getDebitCount = `SELECT COALESCE(ROUND(SUM(sellAmount)),0) AS totalSell FROM factory_distributorWiseOut_data WHERE sellDate BETWEEN STR_TO_DATE('${firstDay}','%b %d %Y') AND STR_TO_DATE('${lastDay}','%b %d %Y');
                                                SELECT COALESCE(ROUND(SUM(sellAmount)),0) AS totalSellOfDebit FROM factory_distributorWiseOut_data WHERE payType = 'debit' AND sellDate BETWEEN STR_TO_DATE('${firstDay}','%b %d %Y') AND STR_TO_DATE('${lastDay}','%b %d %Y');
                                                SELECT COALESCE(ROUND(SUM(paidAmount)),0) AS totalGain FROM factory_distributorTransaction_data WHERE transactionDate BETWEEN STR_TO_DATE('${firstDay}','%b %d %Y') AND STR_TO_DATE('${lastDay}','%b %d %Y');
                                                ${sql_querry_remailAmount}`;
            }
            pool.query(sql_querry_getDebitCount, (err, data) => {
                if (err) {
                    console.error("An error occurd in SQL Queery", err);
                    return res.status(500).send('Database Error');
                }
                else if (data == '') {
                    const msg = [{
                        'msg': 'No Data Available'
                    }]
                    return res.status(400).send(msg);
                } else {
                    const count = {
                        totalSell: data[0][0].totalSell,
                        totalSellOfDebit: data[1][0].totalSellOfDebit,
                        totalGain: data[2][0].totalGain,
                        remainingAmount: data[3][0].remainingAmount
                    }
                    return res.status(200).send(count);
                }
            })
        } else {
            return res.status(401).send('Pleasr Login Firest.....!');
        }
    } catch (error) {
        console.error('An error occurd', error);
        res.status(500).json('Internal Server Error');
    }
}

// Add Distributor Transaction API

const addFacttoryDistributorTransactionDetails = async (req, res) => {
    try {

        let token;
        token = req.headers.authorization.split(" ")[1];
        if (token) {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const userId = decoded.id.id;
            const uid1 = new Date();
            const distributorTransactionId = String("Transaction_" + uid1.getTime());

            const distributorId = req.body.distributorId;
            const receivedBy = req.body.receivedBy.trim();
            const paidAmount = req.body.paidAmount;
            const transactionNote = req.body.transactionNote ? req.body.transactionNote.trim() : null;
            const transactionDate = creationDate = new Date().toString().slice(4, 15);

            if (!distributorId || !receivedBy || !paidAmount) {
                return res.status(400).send("Please Fill all the feilds");
            }
            const get_remaining_amount = `SELECT COALESCE(sisd.total_price, 0) - COALESCE(sosd.total_paid, 0) AS remainingAmount FROM factory_distributor_data AS fdd
                                            LEFT JOIN
                                                     (
                                                         SELECT
                                                             factory_distributorWiseOut_data.distributorId,
                                                             ROUND(SUM(factory_distributorWiseOut_data.sellAmount)) AS total_price
                                                         FROM
                                                             factory_distributorWiseOut_data
                                                         WHERE factory_distributorWiseOut_data.payType = 'debit'
                                                         GROUP BY
                                                             factory_distributorWiseOut_data.distributorId
                                                     ) AS sisd ON fdd.distributorId = sisd.distributorId
                                            LEFT JOIN
                                                     (
                                                         SELECT
                                                             factory_distributorTransaction_data.distributorId,
                                                             ROUND(SUM(factory_distributorTransaction_data.paidAmount)) AS total_paid
                                                         FROM
                                                             factory_distributorTransaction_data
                                                         GROUP BY
                                                             factory_distributorTransaction_data.distributorId
                                                     ) AS sosd ON fdd.distributorId = sosd.distributorId
                                          WHERE fdd.distributorId = '${distributorId}'`;
            pool.query(get_remaining_amount, (err, data) => {
                if (err) {
                    console.error("An error occurd in SQL Queery", err);
                    return res.status(500).send('Database Error');
                }
                const remainingAmount = data[0].remainingAmount
                console.log("./././", remainingAmount);
                if (remainingAmount < paidAmount) {
                    return res.status(400).send(`Remaining Amount is ₹ ${remainingAmount}. You can't pay more.`);
                } else {
                    const sql_querry_addTransaction = `INSERT INTO factory_distributorTransaction_data (distributorTransactionId, UserId, distributorId, receivedBy, pendingAmount, paidAmount, transactionNote, transactionDate)  
                                                       VALUES ('${distributorTransactionId}', '${userId}', '${distributorId}', '${receivedBy}', ${remainingAmount}, ${paidAmount}, NULLIF('${transactionNote}','null'), STR_TO_DATE('${transactionDate}','%b %d %Y'))`;
                    pool.query(sql_querry_addTransaction, (err, data) => {
                        if (err) {
                            console.error("An error occurd in SQL Queery", err);
                            return res.status(500).send('Database Error');
                        }
                        return res.status(200).send("Transaction Added Successfully");
                    })
                }
            })
        } else {
            res.status(401);
            res.send("Please Login Firest.....!");
        }
    } catch (error) {
        console.error('An error occurd', error);
        res.status(500).json('Internal Server Error');
    }
}

// Remove Distributor Transaction API

const removeFactoryDistributorTransactionDetails = async (req, res) => {
    try {
        const distributorTransactionId = req.query.distributorTransactionId
        req.query.distributorTransactionId = pool.query(`SELECT distributorTransactionId FROM factory_distributorTransaction_data WHERE distributorTransactionId = '${distributorTransactionId}'`, (err, row) => {
            if (err) {
                console.error("An error occurd in SQL Queery", err);
                return res.status(500).send('Database Error');
            }
            if (row && row.length) {
                const sql_querry_removedetails = `DELETE FROM factory_distributorTransaction_data WHERE distributorTransactionId = '${distributorTransactionId}'`;
                pool.query(sql_querry_removedetails, (err, data) => {
                    if (err) {
                        console.error("An error occurd in SQL Queery", err);
                        return res.status(500).send('Database Error');
                    }
                    return res.status(200).send("Transaction Deleted Successfully");
                })
            } else {
                return res.send('Transaction Not Found');
            }
        })
    } catch (error) {
        console.error('An error occurd', error);
        res.status(500).send('Internal Server Error');
    }
}

// Update Distributor Transaction API

const updateFactoryDistributorTransactionDetails = async (req, res) => {
    try {
        let token;
        token = req.headers.authorization.split(" ")[1];
        if (token) {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const userId = decoded.id.id;
            const distributorTransactionId = req.body.distributorTransactionId;
            const distributorId = req.body.distributorId;
            const receivedBy = req.body.receivedBy.trim();
            const paidAmount = req.body.paidAmount;
            const transactionNote = req.body.transactionNote ? req.body.transactionNote.trim() : null;

            if (!distributorId || !receivedBy || !paidAmount) {
                return res.status(400).send("Please Fill all the feilds");
            }
            const get_remaining_amount = `SELECT pendingAmount AS remainingAmount FROM factory_distributorTransaction_data WHERE distributorTransactionId = '${distributorTransactionId}'`;
            pool.query(get_remaining_amount, (err, data) => {
                if (err) {
                    console.error("An error occurd in SQL Queery", err);
                    return res.status(500).send('Database Error');
                }
                const remainingAmount = data[0].remainingAmount
                console.log("./././", remainingAmount);
                if (remainingAmount < paidAmount) {
                    return res.status(400).send(`Remaining Amount is ₹ ${remainingAmount}. You can't pay more.`);
                } else {
                    const sql_querry_updateTransaction = `UPDATE factory_distributorTransaction_data SET UserId = '${userId}',
											                                                            distributorId = '${distributorId}',
                                                                                                        receivedBy = '${receivedBy}',
                                                                                                        pendingAmount = '${remainingAmount}',
                                                                                                        paidAmount = ${paidAmount},
                                                                                                        transactionNote = NULLIF('${transactionNote}','null')
                                                                                                  WHERE distributorTransactionId = '${distributorTransactionId}'`;
                    pool.query(sql_querry_updateTransaction, (err, data) => {
                        if (err) {
                            console.error("An error occurd in SQL Queery", err);
                            return res.status(500).send('Database Error');
                        }
                        return res.status(200).send("Transaction Updated Successfully");
                    })
                }
            })
        } else {
            res.status(401);
            res.send("Please Login Firest.....!");
        }
    } catch (error) {
        console.error('An error occurd', error);
        res.status(500).json('Internal Server Error');
    }
}

//Fill Supplier Transaction API

const fillFactoryDistributorTransactionrDetails = (req, res) => {
    try {
        const distributorTransactionId = req.query.distributorTransactionId
        sql_querry_fillUser = `SELECT distributorTransactionId, distributorId, receivedBy, pendingAmount, paidAmount, transactionNote FROM factory_distributorTransaction_data WHERE distributorTransactionId = '${distributorTransactionId}'`;
        pool.query(sql_querry_fillUser, (err, data) => {
            if (err) {
                console.error("An error occurd in SQL Queery", err);
                return res.status(500).send('Database Error');
            }
            return res.status(200).send(data);
        })
    } catch (error) {
        console.error('An error occurd', error);
        res.status(500).json('Internal Server Error');
    }
}

// Get Distributor Cash & Debit Transaction List

const getDistributorCashAndDebit = (req, res) => {
    try {
        let token;
        token = req.headers.authorization ? req.headers.authorization.split(" ")[1] : null;
        if (token) {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const departmentId = decoded.id.categoryId ? decoded.id.categoryId : null;
            if (departmentId) {
                const page = req.query.page;
                const numPerPage = req.query.numPerPage;
                const skip = (page - 1) * numPerPage;
                const limit = skip + ',' + numPerPage;
                const data = {
                    startDate: (req.query.startDate ? req.query.startDate : '').slice(4, 15),
                    endDate: (req.query.endDate ? req.query.endDate : '').slice(4, 15),
                    payType: req.query.payType,
                    distributorId: req.query.distributorId
                }
                if (req.query.startDate && req.query.endDate && req.query.payType && req.query.distributorId) {
                    sql_count_data = `SELECT count(*) as numRows FROM factory_distributorWiseOut_data WHERE distributorId = '${data.distributorId}' AND payType = '${data.payType}' AND sellDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')`;
                } else if (req.query.startDate && req.query.endDate && req.query.distributorId) {
                    sql_count_data = `SELECT count(*) as numRows FROM factory_distributorWiseOut_data WHERE distributorId = '${data.distributorId}' AND sellDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')`;
                } else if (req.query.startDate && req.query.endDate && req.query.payType) {
                    sql_count_data = `SELECT count(*) as numRows FROM factory_distributorWiseOut_data WHERE payType = '${data.payType}' AND sellDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')`;
                } else if (req.query.startDate && req.query.endDate) {
                    sql_count_data = `SELECT count(*) as numRows FROM factory_distributorWiseOut_data WHERE sellDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')`;
                } else if (req.query.distributorId && req.query.payType) {
                    sql_count_data = `SELECT count(*) as numRows FROM factory_distributorWiseOut_data WHERE distributorId = '${data.distributorId}' AND payType = '${data.payType}' AND sellDate >= DATE_SUB(CURDATE(), INTERVAL 1 MONTH) AND sellDate <= CURDATE()`;
                } else if (req.query.payType) {
                    sql_count_data = `SELECT count(*) as numRows FROM factory_distributorWiseOut_data WHERE payType = '${data.payType}' AND sellDate >= DATE_SUB(CURDATE(), INTERVAL 1 MONTH) AND sellDate <= CURDATE()`;
                } else {
                    sql_count_data = `SELECT count(*) as numRows FROM factory_distributorWiseOut_data WHERE distributorId = '${data.distributorId}' AND sellDate >= DATE_SUB(CURDATE(), INTERVAL 1 MONTH) AND sellDate <= CURDATE()`;
                }
                pool.query(sql_count_data, (err, rows, fields) => {
                    if (err) {
                        console.error("An error occurd in SQL Queery", err);
                        return res.status(500).send('Database Error');
                    } else {
                        const numRows = rows[0].numRows;
                        const numPages = Math.ceil(numRows / numPerPage);
                        const sql_common_qurey = `SELECT
                                                      fdwod.outDataId,
                                                      user_details.userName AS enteredBy,
                                                      CONCAT(
                                                          user_details.userFirstName,
                                                          ' ',
                                                          user_details.userLastName
                                                      ) AS userName,
                                                      fdwod.mfProductId,
                                                      fmpd.mfProductName,
                                                      CONCAT(mfso.mfStockOutDisplayQty,' ',mfso.mfStockOutDisplayUnit) AS qty,
                                                      mfso.mfProductOutPrice AS costPrice,
                                                      fdwod.payType,
                                                      fdwod.sellAmount,
                                                      DATE_FORMAT(fdwod.sellDate,'%d-%M-%Y') AS sellDate,
                                                      DATE_FORMAT(outDataCreationDate,'%h:%i %p') AS sellTime
                                                  FROM
                                                      factory_distributorWiseOut_data AS fdwod
                                                  INNER JOIN user_details ON user_details.userId = fdwod.userId
                                                  INNER JOIN factory_mfProductStockOut_data AS mfso ON mfso.mfStockOutId = fdwod.mfStockOutId
                                                  INNER JOIN factory_manufactureProduct_data AS fmpd ON fmpd.mfProductId = fdwod.mfProductId`;

                        if (req.query.startDate && req.query.endDate && req.query.payType && req.query.distributorId) {
                            sql_query_getDetails = `${sql_common_qurey}
                                                    WHERE distributorId = '${data.distributorId}' AND payType = '${data.payType}' AND sellDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')
                                                    ORDER BY sellDate DESC, outDataCreationDate DESC
                                                    LIMIT ${limit}`;
                        } else if (req.query.startDate && req.query.endDate && req.query.distributorId) {
                            sql_query_getDetails = `${sql_common_qurey}
                                                    WHERE distributorId = '${data.distributorId}' AND sellDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')
                                                    ORDER BY sellDate DESC, outDataCreationDate DESC
                                                    LIMIT ${limit}`;
                        } else if (req.query.startDate && req.query.endDate && req.query.payType) {
                            sql_query_getDetails = `${sql_common_qurey}
                                                    WHERE payType = '${data.payType}' AND sellDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')
                                                    ORDER BY sellDate DESC, outDataCreationDate DESC
                                                    LIMIT ${limit}`;
                        } else if (req.query.startDate && req.query.endDate) {
                            sql_query_getDetails = `${sql_common_qurey}
                                                    WHERE sellDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')
                                                    ORDER BY sellDate DESC, outDataCreationDate DESC
                                                    LIMIT ${limit}`;
                        } else if (req.query.distributorId && req.query.payType) {
                            sql_query_getDetails = `${sql_common_qurey}
                                                    WHERE distributorId = '${data.distributorId}' AND payType = '${data.payType}' AND sellDate >= DATE_SUB(CURDATE(), INTERVAL 1 MONTH) AND sellDate <= CURDATE()
                                                    ORDER BY sellDate DESC, outDataCreationDate DESC
                                                    LIMIT ${limit}`;
                        } else if (req.query.payType) {
                            sql_query_getDetails = `${sql_common_qurey}
                                                    WHERE payType = '${data.payType}' AND sellDate >= DATE_SUB(CURDATE(), INTERVAL 1 MONTH) AND sellDate <= CURDATE()
                                                    ORDER BY sellDate DESC, outDataCreationDate DESC
                                                    LIMIT ${limit}`;
                        } else {
                            sql_query_getDetails = `${sql_common_qurey}
                                                    WHERE distributorId = '${data.distributorId}' AND sellDate >= DATE_SUB(CURDATE(), INTERVAL 1 MONTH) AND sellDate <= CURDATE()
                                                    ORDER BY sellDate DESC, outDataCreationDate DESC
                                                    LIMIT ${limit}`;
                        }
                        pool.query(sql_query_getDetails, (err, rows) => {
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
                        })
                    }
                })
            } else {
                return res.status(404).send('DepartmentId Not Found');
            }
        } else {
            return res.status(401).send('Pleasr Login Firest.....!');
        }
    } catch (error) {
        console.error('An error occurd', error);
        res.status(500).send('Internal Server Error');
    }
}

module.exports = {
    getdistributorDebitTransactionList,
    addFacttoryDistributorTransactionDetails,
    removeFactoryDistributorTransactionDetails,
    updateFactoryDistributorTransactionDetails,
    fillFactoryDistributorTransactionrDetails,
    getDistributorCashAndDebit,
    getDistributorCashTransactionCounter,
    getDistributorDebitTransactionCounter
}