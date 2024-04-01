const pool = require('../../../database');
const jwt = require("jsonwebtoken");
const excelJS = require("exceljs");
const { jsPDF } = require('jspdf');
require('jspdf-autotable');
const { PDFDocument, StandardFonts, rgb } = require("pdf-lib");
const { writeFileSync, readFileSync } = require("fs");
const fs = require('fs');
const { Readable } = require('stream');

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
        token = req.headers ? req.headers.authorization.split(" ")[1] : null;
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
        token = req.headers ? req.headers.authorization.split(" ")[1] : null;
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
            return res.status(401).send('Pleasr Login Firest.....!');
        }
    } catch (error) {
        console.error('An error occurd', error);
        res.status(500).send('Internal Server Error');
    }
}

// Export Excel Data

const exportExcelForDistributorCashAndDebit = (req, res) => {
    try {
        let token;
        token = req.headers.authorization ? req.headers.authorization.split(" ")[1] : null;
        if (token) {
            const data = {
                startDate: (req.query.startDate ? req.query.startDate : '').slice(4, 15),
                endDate: (req.query.endDate ? req.query.endDate : '').slice(4, 15),
                payType: req.query.payType,
                distributorId: req.query.distributorId
            }
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
                                              fdwod.sellAmount - mfso.mfProductOutPrice AS profit,
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
                                                ORDER BY sellDate DESC, outDataCreationDate DESC`;
            } else if (req.query.startDate && req.query.endDate && req.query.distributorId) {
                sql_query_getDetails = `${sql_common_qurey}
                                                WHERE distributorId = '${data.distributorId}' AND sellDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')
                                                ORDER BY sellDate DESC, outDataCreationDate DESC`;
            } else if (req.query.startDate && req.query.endDate && req.query.payType) {
                sql_query_getDetails = `${sql_common_qurey}
                                                WHERE payType = '${data.payType}' AND sellDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')
                                                ORDER BY sellDate DESC, outDataCreationDate DESC`;
            } else if (req.query.startDate && req.query.endDate) {
                sql_query_getDetails = `${sql_common_qurey}
                                                WHERE sellDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')
                                                ORDER BY sellDate DESC, outDataCreationDate DESC`;
            } else if (req.query.distributorId && req.query.payType) {
                sql_query_getDetails = `${sql_common_qurey}
                                                WHERE distributorId = '${data.distributorId}' AND payType = '${data.payType}' AND sellDate >= DATE_SUB(CURDATE(), INTERVAL 1 MONTH) AND sellDate <= CURDATE()
                                                ORDER BY sellDate DESC, outDataCreationDate DESC`;
            } else if (req.query.payType) {
                sql_query_getDetails = `${sql_common_qurey}
                                                WHERE payType = '${data.payType}' AND sellDate >= DATE_SUB(CURDATE(), INTERVAL 1 MONTH) AND sellDate <= CURDATE()
                                                ORDER BY sellDate DESC, outDataCreationDate DESC`;
            } else {
                sql_query_getDetails = `${sql_common_qurey}
                                                WHERE distributorId = '${data.distributorId}' AND sellDate >= DATE_SUB(CURDATE(), INTERVAL 1 MONTH) AND sellDate <= CURDATE()
                                                ORDER BY sellDate DESC, outDataCreationDate DESC`;
            }
            pool.query(sql_query_getDetails, async (err, rows) => {
                if (err) {
                    console.error("An error occurd in SQL Queery", err);
                    return res.status(500).send('Database Error');;
                } else {
                    if (rows.length == 0) {
                        return res.status(400).send('No Data Found');
                    } else {
                        const workbook = new excelJS.Workbook();  // Create a new workbook
                        const worksheet = workbook.addWorksheet("Transaction List"); // New Worksheet

                        worksheet.mergeCells('A1', 'I1');
                        worksheet.getCell('A1').value = `Transaction List`

                        /*Column headers*/
                        worksheet.getRow(2).values = ['S no.', 'Entered By', 'Product', 'Quantity', 'Pay Type', 'Cost', 'Sell Price', 'Profit', 'Date', "Time"];

                        // Column for data in excel. key must match data key
                        worksheet.columns = [
                            { key: "s_no", width: 10, },
                            { key: "userName", width: 20 },
                            { key: "mfProductName", width: 30 },
                            { key: "qty", width: 20 },
                            { key: "payType", width: 10 },
                            { key: "costPrice", width: 10 },
                            { key: "sellAmount", width: 30 },
                            { key: "profit", width: 30 },
                            { key: "sellDate", width: 20 },
                            { key: "sellTime", width: 20 },
                        ];
                        //Looping through User data
                        const arr = rows
                        let counter = 1;
                        arr.forEach((user, index) => {
                            user.s_no = counter;
                            const row = worksheet.addRow(user); // Add data in worksheet
                            counter++;
                        });
                        // Making first line in excel bold
                        worksheet.getRow(1).eachCell((cell) => {
                            cell.font = { bold: true, size: 13 }
                            cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
                            height = 200
                        });
                        worksheet.getRow(2).eachCell((cell) => {
                            cell.font = { bold: true, size: 13 }
                            cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
                        });
                        worksheet.getRow(1).height = 30;
                        worksheet.getRow(2).height = 20;
                        worksheet.getRow(arr.length + 3).values = ['Total:', '', '', '', '', { formula: `SUM(F3:F${arr.length + 2})` }, { formula: `SUM(G3:G${arr.length + 2})` }, { formula: `SUM(H3:H${arr.length + 2})` }];

                        worksheet.getRow(arr.length + 3).eachCell((cell) => {
                            cell.font = { bold: true, size: 14 }
                            cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
                        })
                        worksheet.eachRow((row) => {
                            row.eachCell((cell) => {
                                cell.alignment = { horizontal: 'center', vertical: 'middle' };
                                row.height = 20
                            });
                        });
                        try {
                            const data = await workbook.xlsx.writeBuffer()
                            res.contentType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
                            res.type = 'blob';
                            res.send(data)
                        } catch (err) {
                            throw new Error(err);
                        }
                    }
                }
            })

        } else {
            return res.status(401).send('Pleasr Login Firest.....!');
        }
    } catch (error) {
        console.error('An error occurd', error);
        res.status(500).send('Internal Server Error');
    }
}

const exportExcelForDistributorDebitTransactionList = async (req, res) => {
    try {
        let token;
        token = req.headers.authorization ? req.headers.authorization.split(" ")[1] : null;
        if (token) {
            var date = new Date(), y = date.getFullYear(), m = (date.getMonth());
            var firstDay = new Date(y, m, 1).toString().slice(4, 15);
            var lastDay = new Date(y, m + 1, 0).toString().slice(4, 15);

            const data = {
                startDate: (req.query.startDate ? req.query.startDate : '').slice(4, 15),
                endDate: (req.query.endDate ? req.query.endDate : '').slice(4, 15),
                distributorId: req.query.distributorId,
            }
            const sql_common_qurey = `SELECT 
                                        distributorTransactionId,
                                        RIGHT(distributorTransactionId,9) AS invoiceNumber, 
                                        CONCAT(user_details.userFirstName,' ',user_details.userLastName) AS paidBy, 
                                        factory_distributor_data.distributorNickName, 
                                        receivedBy, 
                                        pendingAmount, 
                                        paidAmount, 
                                        transactionNote, 
                                        DATE_FORMAT(transactionDate,'%d-%M-%Y') AS transactionDate, 
                                        DATE_FORMAT(distributorTransactionCreationDate,'%h:%i %p') AS transactionTime 
                                      FROM factory_distributorTransaction_data
                                      LEFT JOIN user_details ON user_details.userId = factory_distributorTransaction_data.UserId
                                      LEFT JOIN factory_distributor_data ON factory_distributor_data.distributorId = factory_distributorTransaction_data.distributorId`;
            if (req.query.distributorId && req.query.startDate && req.query.endDate) {
                sql_queries_getdetails = `${sql_common_qurey}
                                            WHERE factory_distributorTransaction_data.distributorId = '${data.distributorId}' AND factory_distributorTransaction_data.transactionDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y') 
                                            ORDER BY factory_distributorTransaction_data.transactionDate ,factory_distributorTransaction_data.distributorTransactionCreationDate DESC`;
            } else if (req.query.startDate && req.query.endDate) {
                sql_queries_getdetails = `${sql_common_qurey}
                                            WHERE factory_distributorTransaction_data.transactionDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y') 
                                            ORDER BY factory_distributorTransaction_data.transactionDate, factory_distributorTransaction_data.distributorTransactionCreationDate DESC`;
            } else if (req.query.distributorId) {
                sql_queries_getdetails = `${sql_common_qurey}
                                            WHERE factory_distributorTransaction_data.distributorId = '${data.distributorId}' AND factory_distributorTransaction_data.transactionDate BETWEEN STR_TO_DATE('${firstDay}','%b %d %Y') AND STR_TO_DATE('${lastDay}','%b %d %Y')
                                            ORDER BY factory_distributorTransaction_data.transactionDate, factory_distributorTransaction_data.distributorTransactionCreationDate DESC`;
            } else {
                sql_queries_getdetails = `${sql_common_qurey}
                                            WHERE factory_distributorTransaction_data.transactionDate BETWEEN STR_TO_DATE('${firstDay}','%b %d %Y') AND STR_TO_DATE('${lastDay}','%b %d %Y')
                                            ORDER BY factory_distributorTransaction_data.transactionDate, factory_distributorTransaction_data.distributorTransactionCreationDate DESC`;
            }
            pool.query(sql_queries_getdetails, async (err, rows, fields) => {
                if (err) {
                    console.error("An error occurd in SQL Queery", err);
                    return res.status(500).send('Database Error');;
                } else {
                    if (rows.length === 0) {
                        return res.status(400).send('No Data Found');
                    } else {
                        const workbook = new excelJS.Workbook();  // Create a new workbook
                        const worksheet = workbook.addWorksheet("Transaction List"); // New Worksheet

                        worksheet.mergeCells('A1', 'I1');
                        worksheet.getCell('A1').value = `Transaction List`

                        /*Column headers*/
                        worksheet.getRow(2).values = ['S no.', 'Invoice Number', 'Received By', 'Paid By', 'Pending Amount', 'Paid Amount', 'Transaction Note', 'Date', 'Time'];

                        // Column for data in excel. key must match data key
                        worksheet.columns = [
                            { key: "s_no", width: 10, },
                            { key: "invoiceNumber", width: 20 },
                            { key: "paidBy", width: 30 },
                            { key: "distributorNickName", width: 20 },
                            { key: "pendingAmount", width: 10 },
                            { key: "paidAmount", width: 10 },
                            { key: "transactionNote", width: 30 },
                            { key: "transactionDate", width: 20 },
                            { key: "transactionTime", width: 20 },
                        ];
                        //Looping through User data
                        const arr = rows
                        let counter = 1;
                        arr.forEach((user, index) => {
                            user.s_no = counter;
                            const row = worksheet.addRow(user); // Add data in worksheet
                            counter++;
                        });
                        // Making first line in excel bold
                        worksheet.getRow(1).eachCell((cell) => {
                            cell.font = { bold: true, size: 13 }
                            cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
                            height = 200
                        });
                        worksheet.getRow(2).eachCell((cell) => {
                            cell.font = { bold: true, size: 13 }
                            cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
                        });
                        worksheet.getRow(1).height = 30;
                        worksheet.getRow(2).height = 20;
                        worksheet.getRow(arr.length + 3).values = ['Total:', '', '', '', '', { formula: `SUM(F3:F${arr.length + 2})` }];

                        worksheet.getRow(arr.length + 3).eachCell((cell) => {
                            cell.font = { bold: true, size: 14 }
                            cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
                        })
                        worksheet.eachRow((row) => {
                            row.eachCell((cell) => {
                                cell.alignment = { horizontal: 'center', vertical: 'middle' };
                                row.height = 20
                            });
                        });
                        try {
                            const data = await workbook.xlsx.writeBuffer()
                            res.contentType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
                            res.type = 'blob';
                            res.send(data)
                        } catch (err) {
                            throw new Error(err);
                        }
                    }
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

// Export PDF Common Function

async function createPDF(res, datas, sumFooterArray, tableHeading) {
    try {
        // Create a new PDF document
        console.log(';;;;;;', datas);
        console.log('?????', sumFooterArray);
        console.log('?????', tableHeading);
        const doc = new jsPDF();

        // JSON data
        const jsonData = datas;
        // console.log(jsonData);

        // Get the keys from the first JSON object to set as columns
        const keys = Object.keys(jsonData[0]);

        // Define columns for the auto table, including a "Serial No." column
        const columns = [
            { header: 'Sr.', dataKey: 'serialNo' }, // Add Serial No. column
            ...keys.map(key => ({ header: key, dataKey: key }))
        ]

        // Convert JSON data to an array of arrays (table rows) and add a serial number
        const data = jsonData.map((item, index) => [index + 1, ...keys.map(key => item[key]), '', '']);

        // Initialize the sum columns with empty strings
        if (sumFooterArray) {
            data.push(sumFooterArray);
        }

        // Add auto table to the PDF document
        doc.text(15, 15, tableHeading);
        doc.autoTable({
            startY: 20,
            head: [columns.map(col => col.header)], // Extract headers correctly
            body: data,
            theme: 'grid',
            styles: {
                cellPadding: 2, // Add padding to cells for better appearance
                halign: 'center', // Horizontally center-align content
                fontSize: 10
            },
        });

        const pdfBytes = await doc.output();
        const fileName = 'jane-doe.pdf'; // Set the desired file name

        // Set the response headers for the PDF download
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        res.setHeader('Content-Type', 'application/pdf');

        // Stream the PDF to the client for download
        res.send(pdfBytes);


        // Save the PDF to a file
        // const pdfFilename = 'output.pdf';
        // fs.writeFileSync(pdfFilename, doc.output());
        // console.log(`PDF saved as ${pdfFilename}`);
    } catch (error) {
        console.error('An error occurd', error);
        res.status(500).json('Internal Server Error');
    }
}

// Export PDF Data

const exportPdfForDistributorCashAndDebit = (req, res) => {
    try {
        let token;
        token = req.headers.authorization ? req.headers.authorization.split(" ")[1] : null;
        if (token) {
            const data = {
                startDate: (req.query.startDate ? req.query.startDate : '').slice(4, 15),
                endDate: (req.query.endDate ? req.query.endDate : '').slice(4, 15),
                payType: req.query.payType,
                distributorId: req.query.distributorId
            }
            const sql_common_qurey = `SELECT
                                          user_details.userName AS "Enter By",
                                          fmpd.mfProductName AS "Product Name",
                                          CONCAT(mfso.mfStockOutDisplayQty,' ',mfso.mfStockOutDisplayUnit) AS "Qty",
                                          fdwod.payType AS "Pay Type",
                                          mfso.mfProductOutPrice AS "Cost",
                                          fdwod.sellAmount AS "Sell Amount",
                                          fdwod.sellAmount - mfso.mfProductOutPrice AS "Profit",
                                          DATE_FORMAT(fdwod.sellDate,'%d-%M-%Y') AS "Date"
                                      FROM
                                          factory_distributorWiseOut_data AS fdwod
                                      INNER JOIN user_details ON user_details.userId = fdwod.userId
                                      INNER JOIN factory_mfProductStockOut_data AS mfso ON mfso.mfStockOutId = fdwod.mfStockOutId
                                      INNER JOIN factory_manufactureProduct_data AS fmpd ON fmpd.mfProductId = fdwod.mfProductId`;

            if (req.query.startDate && req.query.endDate && req.query.payType && req.query.distributorId) {
                sql_query_getDetails = `${sql_common_qurey}
                                            WHERE distributorId = '${data.distributorId}' AND payType = '${data.payType}' AND sellDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')
                                            ORDER BY sellDate DESC, outDataCreationDate DESC`;
            } else if (req.query.startDate && req.query.endDate && req.query.distributorId) {
                sql_query_getDetails = `${sql_common_qurey}
                                            WHERE distributorId = '${data.distributorId}' AND sellDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')
                                            ORDER BY sellDate DESC, outDataCreationDate DESC`;
            } else if (req.query.startDate && req.query.endDate && req.query.payType) {
                sql_query_getDetails = `${sql_common_qurey}
                                            WHERE payType = '${data.payType}' AND sellDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')
                                            ORDER BY sellDate DESC, outDataCreationDate DESC`;
            } else if (req.query.startDate && req.query.endDate) {
                sql_query_getDetails = `${sql_common_qurey}
                                            WHERE sellDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')
                                            ORDER BY sellDate DESC, outDataCreationDate DESC`;
            } else if (req.query.distributorId && req.query.payType) {
                sql_query_getDetails = `${sql_common_qurey}
                                            WHERE distributorId = '${data.distributorId}' AND payType = '${data.payType}' AND sellDate >= DATE_SUB(CURDATE(), INTERVAL 1 MONTH) AND sellDate <= CURDATE()
                                            ORDER BY sellDate DESC, outDataCreationDate DESC`;
            } else if (req.query.payType) {
                sql_query_getDetails = `${sql_common_qurey}
                                            WHERE payType = '${data.payType}' AND sellDate >= DATE_SUB(CURDATE(), INTERVAL 1 MONTH) AND sellDate <= CURDATE()
                                            ORDER BY sellDate DESC, outDataCreationDate DESC`;
            } else {
                sql_query_getDetails = `${sql_common_qurey}
                                            WHERE distributorId = '${data.distributorId}' AND sellDate >= DATE_SUB(CURDATE(), INTERVAL 1 MONTH) AND sellDate <= CURDATE()
                                            ORDER BY sellDate DESC, outDataCreationDate DESC`;
            }
            pool.query(sql_query_getDetails, async (err, rows) => {
                if (err) {
                    console.error("An error occurd in SQL Queery", err);
                    return res.status(500).send('Database Error');;
                } else {
                    if (rows && rows.length <= 0) {
                        return res.status(400).send('No Data Found');
                    } else {
                        const abc = Object.values(JSON.parse(JSON.stringify(rows)));
                        const cost = abc.reduce((total, item) => total + (item['Cost'] || 0), 0);;
                        const sell = abc.reduce((total, item) => total + (item['Sell Amount'] || 0), 0);
                        const Profit = abc.reduce((total, item) => total + (item['Profit'] || 0), 0);;
                        const sumFooterArray = ['Total', '', '', '', '', parseFloat(cost).toLocaleString('en-IN'), parseFloat(sell).toLocaleString('en-IN'), parseFloat(Profit).toLocaleString('en-IN')];

                        let tableHeading = `Transaction List`;

                        createPDF(res, abc, sumFooterArray, tableHeading)
                            .then(() => {
                                console.log('PDF created successfully');
                                res.status(200);
                            })
                            .catch((err) => {
                                console.log(err);
                                res.status(500).send('Error creating PDF');
                            });
                    }
                }
            })

        } else {
            return res.status(401).send('Pleasr Login Firest.....!');
        }
    } catch (error) {
        console.error('An error occurd', error);
        res.status(500).send('Internal Server Error');
    }
}

const exportPdfForDistributorDebitTransactionList = async (req, res) => {
    try {
        let token;
        token = req.headers.authorization ? req.headers.authorization.split(" ")[1] : null;
        if (token) {
            var date = new Date(), y = date.getFullYear(), m = (date.getMonth());
            var firstDay = new Date(y, m, 1).toString().slice(4, 15);
            var lastDay = new Date(y, m + 1, 0).toString().slice(4, 15);

            const data = {
                startDate: (req.query.startDate ? req.query.startDate : '').slice(4, 15),
                endDate: (req.query.endDate ? req.query.endDate : '').slice(4, 15),
                distributorId: req.query.distributorId,
            }
            const sql_common_qurey = `SELECT 
                                        RIGHT(distributorTransactionId,9) AS "Invoice Number", 
                                        CONCAT(user_details.userFirstName,' ',user_details.userLastName) AS "Received By", 
                                        factory_distributor_data.distributorNickName AS "Paid By",   
                                        pendingAmount AS "Pending Amount", 
                                        paidAmount AS "Paid Amount", 
                                        transactionNote AS "Note", 
                                        DATE_FORMAT(transactionDate,'%d-%M-%Y') AS "Date", 
                                        DATE_FORMAT(distributorTransactionCreationDate,'%h:%i %p') AS "Time" 
                                      FROM factory_distributorTransaction_data
                                      LEFT JOIN user_details ON user_details.userId = factory_distributorTransaction_data.UserId
                                      LEFT JOIN factory_distributor_data ON factory_distributor_data.distributorId = factory_distributorTransaction_data.distributorId`;
            if (req.query.distributorId && req.query.startDate && req.query.endDate) {
                sql_queries_getdetails = `${sql_common_qurey}
                                            WHERE factory_distributorTransaction_data.distributorId = '${data.distributorId}' AND factory_distributorTransaction_data.transactionDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y') 
                                            ORDER BY factory_distributorTransaction_data.transactionDate ,factory_distributorTransaction_data.distributorTransactionCreationDate DESC`;
            } else if (req.query.startDate && req.query.endDate) {
                sql_queries_getdetails = `${sql_common_qurey}
                                            WHERE factory_distributorTransaction_data.transactionDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y') 
                                            ORDER BY factory_distributorTransaction_data.transactionDate, factory_distributorTransaction_data.distributorTransactionCreationDate DESC`;
            } else if (req.query.distributorId) {
                sql_queries_getdetails = `${sql_common_qurey}
                                            WHERE factory_distributorTransaction_data.distributorId = '${data.distributorId}' AND factory_distributorTransaction_data.transactionDate BETWEEN STR_TO_DATE('${firstDay}','%b %d %Y') AND STR_TO_DATE('${lastDay}','%b %d %Y')
                                            ORDER BY factory_distributorTransaction_data.transactionDate, factory_distributorTransaction_data.distributorTransactionCreationDate DESC`;
            } else {
                sql_queries_getdetails = `${sql_common_qurey}
                                            WHERE factory_distributorTransaction_data.transactionDate BETWEEN STR_TO_DATE('${firstDay}','%b %d %Y') AND STR_TO_DATE('${lastDay}','%b %d %Y')
                                            ORDER BY factory_distributorTransaction_data.transactionDate, factory_distributorTransaction_data.distributorTransactionCreationDate DESC`;
            }
            pool.query(sql_queries_getdetails, async (err, rows, fields) => {
                if (err) {
                    console.error("An error occurd in SQL Queery", err);
                    return res.status(500).send('Database Error');;
                } else {
                    if (rows.length === 0) {
                        return res.status(400).send('No Data Found');
                    } else {
                        const abc = Object.values(JSON.parse(JSON.stringify(rows)));
                        const paid = abc.reduce((total, item) => total + (item['Paid Amount'] || 0), 0);;
                        const sumFooterArray = ['Total', '', '', '', '', parseFloat(paid).toLocaleString('en-IN')];

                        let tableHeading = `Transaction List`;

                        createPDF(res, abc, sumFooterArray, tableHeading)
                            .then(() => {
                                console.log('PDF created successfully');
                                res.status(200);
                            })
                            .catch((err) => {
                                console.log(err);
                                res.status(500).send('Error creating PDF');
                            });
                    }
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

// Export Invoice

async function createPDFInvoice(res, data) {
    try {
        const details = {
            invoiceNumber: data[0].invoiceNumber ? data[0].invoiceNumber.toString() : '',
            paidBy: data[0].paidBy ? data[0].paidBy : '',
            suppliertName: data[0].suppliertName ? data[0].suppliertName : '',
            supplierFirmName: data[0].supplierFirmName ? data[0].supplierFirmName : '',
            supplierPhoneNumber: data[0].supplierPhoneNumber ? data[0].supplierPhoneNumber : '',
            receivedBy: data[0].receivedBy ? data[0].receivedBy : '',
            pendingAmount: data[0].pendingAmount ? data[0].pendingAmount.toString() : '',
            paidAmount: data[0].paidAmount ? data[0].paidAmount.toString() : '',
            remainingAmount: data[0].remainingAmount ? data[0].remainingAmount.toString() : '',
            transactionNote: data[0].transactionNote ? data[0].transactionNote : '',
            transactionDate: data[0].transactionDate ? data[0].transactionDate : '',
            transactionTime: data[0].transactionTime ? data[0].transactionTime : '',
        }
        const document = await PDFDocument.load(readFileSync(process.env.INVOICE_RAJMANDIR_URL));
        console.log('>>?>>?>?>?', process.env.INVOICE_RAJMANDIR_URL)
        const helveticaFont = await document.embedFont(StandardFonts.Helvetica);
        const HelveticaBold = await document.embedFont(StandardFonts.HelveticaBold);
        const firstPage = document.getPage(0);

        // Load the image data synchronously using readFileSync
        const draftImageData = fs.readFileSync(process.env.DRAFT_LOGO_IMAGE_URL);

        // Embed the image data in the PDF document
        const draftImage = await document.embedPng(draftImageData);

        // Draw the image on the desired page
        const draftImageDims = draftImage.scale(0.1); // Adjust the scale as needed
        firstPage.drawImage(draftImage, {
            x: 50, // Adjust the X position as needed
            y: 440, // Adjust the Y position as needed
            width: draftImageDims.width + 10,
            height: draftImageDims.height + 10,
            opacity: 0.07, // Apply transparency (0.0 to 1.0)
        });

        firstPage.moveTo(105, 530);
        firstPage.drawText('', {
            x: 140,
            y: 645,
            size: 10,
            fontSize: 100,
            font: HelveticaBold
        })

        firstPage.drawText(details.transactionDate, {
            x: 140,
            y: 631,
            size: 9,
            font: helveticaFont
        })

        firstPage.drawText(details.transactionTime, {
            x: 140,
            y: 616,
            size: 9,
            font: helveticaFont
        })

        firstPage.drawText(details.supplierFirmName, {
            x: 300,
            y: 645,
            size: 10,
            fontSize: 100,
            font: HelveticaBold
        })

        firstPage.drawText(details.suppliertName, {
            x: 300,
            y: 631,
            size: 9,
            font: helveticaFont
        })

        firstPage.drawText(details.supplierPhoneNumber, {
            x: 300,
            y: 616,
            size: 9,
            font: helveticaFont
        })

        firstPage.drawText(details.paidBy, {
            x: 50,
            y: 505,
            size: 9,
            font: helveticaFont
        })

        firstPage.drawText(details.receivedBy, {
            x: 159,
            y: 505,
            size: 9,
            font: helveticaFont
        })

        firstPage.drawText(details.pendingAmount, {
            x: 295,
            y: 505,
            size: 9,
            font: helveticaFont
        })

        firstPage.drawText(details.paidAmount, {
            x: 404,
            y: 505,
            size: 9,
            font: helveticaFont
        })

        firstPage.drawText(details.remainingAmount, {
            x: 476,
            y: 505,
            size: 9,
            font: helveticaFont
        })

        firstPage.drawText(details.transactionNote, {
            x: 85,
            y: 435,
            size: 9,
            font: helveticaFont
        })

        const pdfBytes = await document.save();

        const stream = new Readable();
        stream.push(pdfBytes);
        stream.push(null);

        const fileName = 'jane-doe.pdf'; // Set the desired file name

        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        res.setHeader('Content-Type', 'application/pdf');

        stream.pipe(res);
    } catch (error) {
        console.error('An error occurd', error);
        res.status(500).json('Internal Server Error');
    }
    // writeFileSync("jane-doe.pdf", await document.save());
}

const exportDistributorTransactionInvoiceData = async (req, res) => {
    try {
        const transactionId = req.query.transactionId;
        const sql_queries_getInvoiceDetails = `SELECT 
                                                    RIGHT(distributorTransactionId,9) AS invoiceNumber,
                                                    CONCAT(user_details.userFirstName,' ',user_details.userLastName) AS paidBy, 
                                                    dd.distributorName, 
                                                    dd.distributorFirmName, 
                                                    dd.distributorPhoneNumber,
                                                    receivedBy, 
                                                    pendingAmount, 
                                                    paidAmount, 
                                                    (pendingAmount - paidAmount) AS remainingAmount, 
                                                    transactionNote, 
                                                    DATE_FORMAT(transactionDate,'%d %M %Y, %W') AS transactionDate, 
                                                    DATE_FORMAT(distributorTransactionCreationDate,'%h:%i %p') AS transactionTime 
                                                FROM 
                                                    factory_distributorTransaction_data AS istd
                                                INNER JOIN user_details ON user_details.userId = istd.UserId
                                                INNER JOIN 
                                                (
                                                	SELECT 
                                                   		distributorId,
                                                		distributorNickName AS distributorName,
                                                		distributorFirmName,
                                                		distributorPhoneNumber
                                                    FROM 
                                                        factory_distributor_data
                                                ) AS dd ON istd.distributorId = dd.distributorId
                                                WHERE istd.distributorTransactionId = '${transactionId}'`;
        pool.query(sql_queries_getInvoiceDetails, (err, data) => {
            if (err) {
                console.error("An error occurd in SQL Queery", err);
                return res.status(500).send('Database Error');
            }
            createPDFInvoice(res, data)
                .then(() => {
                    console.log('PDF created successfully');
                    res.status(200);
                })
                .catch((err) => {
                    console.log(err);
                    res.status(500).send('Error creating PDF');
                });
        })
    } catch (error) {
        console.error('An error occurd', error);
        res.status(500).json('Internal Server Error');
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
    getDistributorDebitTransactionCounter,
    exportExcelForDistributorCashAndDebit,
    exportExcelForDistributorDebitTransactionList,
    exportPdfForDistributorCashAndDebit,
    exportPdfForDistributorDebitTransactionList,
    exportDistributorTransactionInvoiceData
}