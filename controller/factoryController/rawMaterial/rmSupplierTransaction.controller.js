const pool = require('../../../database');
const jwt = require("jsonwebtoken");
const excelJS = require("exceljs");
const { PDFDocument, StandardFonts, rgb } = require("pdf-lib");
const { writeFileSync, readFileSync } = require("fs");
const fs = require('fs');
const { Readable } = require('stream');
const { jsPDF } = require('jspdf');
require('jspdf-autotable');

// Cash Transaction Count API

const getRmCashTransactionCounter = (req, res) => {
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
                sql_querry_getCashCount = `SELECT COALESCE(ROUND(SUM(totalPrice)),0) AS totalExpense FROM factory_rmStockIn_data WHERE rmStockInDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y');
                                               SELECT COALESCE(ROUND(SUM(totalPrice)),0) AS totalExpenseOfCash FROM factory_rmStockIn_data WHERE rmStockInPaymentMethod = 'cash' AND rmStockInDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')`;
            } else {
                sql_querry_getCashCount = `SELECT COALESCE(ROUND(SUM(totalPrice)),0) AS totalExpense FROM factory_rmStockIn_data WHERE rmStockInDate BETWEEN STR_TO_DATE('${firstDay}','%b %d %Y') AND STR_TO_DATE('${lastDay}','%b %d %Y');
                                               SELECT COALESCE(ROUND(SUM(totalPrice)),0) AS totalExpenseOfCash FROM factory_rmStockIn_data WHERE rmStockInPaymentMethod = 'cash' AND rmStockInDate BETWEEN STR_TO_DATE('${firstDay}','%b %d %Y') AND STR_TO_DATE('${lastDay}','%b %d %Y')`;
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
                        totalExpense: data[0][0].totalExpense,
                        totalExpenseOfCash: data[1][0].totalExpenseOfCash,
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

const getRmDebitTransactionCounter = (req, res) => {
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
            const sql_querry_remailAmount = `SELECT SUM(COALESCE(sisd.total_price, 0) - COALESCE(sosd.total_paid, 0)) AS remainingAmount FROM factory_supplier_data AS sd
                                                 LEFT JOIN
                                                             (
                                                                 SELECT
                                                                     factory_rmStockIn_data.rmSupplierId,
                                                                     ROUND(SUM(factory_rmStockIn_data.totalPrice)) AS total_price
                                                                 FROM
                                                                     factory_rmStockIn_data
                                                                 WHERE factory_rmStockIn_data.rmStockInPaymentMethod = 'debit'
                                                                 GROUP BY
                                                                     factory_rmStockIn_data.rmSupplierId
                                                             ) AS sisd ON sd.rmSupplierId = sisd.rmSupplierId
                                                 LEFT JOIN
                                                             (
                                                                 SELECT
                                                                     factory_supplierTransaction_data.rmSupplierId,
                                                                     ROUND(SUM(factory_supplierTransaction_data.paidAmount)) AS total_paid
                                                                 FROM
                                                                     factory_supplierTransaction_data
                                                                 GROUP BY
                                                                     factory_supplierTransaction_data.rmSupplierId
                                                             ) AS sosd ON sd.rmSupplierId = sosd.rmSupplierId;`
            if (req.query.startDate && req.query.endDate) {
                sql_querry_getDebitCount = `SELECT COALESCE(ROUND(SUM(totalPrice)),0) AS totalExpense FROM factory_rmStockIn_data WHERE rmStockInDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y');
                                                SELECT COALESCE(ROUND(SUM(totalPrice)),0) AS totalExpenseOfDebit FROM factory_rmStockIn_data WHERE rmStockInPaymentMethod = 'debit' AND rmStockInDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y');
                                                SELECT COALESCE(ROUND(SUM(paidAmount)),0) AS totalPaid FROM factory_supplierTransaction_data WHERE transactionDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y');
                                                ${sql_querry_remailAmount}`;
            } else {
                sql_querry_getDebitCount = `SELECT COALESCE(ROUND(SUM(totalPrice)),0) AS totalExpense FROM factory_rmStockIn_data WHERE rmStockInDate BETWEEN STR_TO_DATE('${firstDay}','%b %d %Y') AND STR_TO_DATE('${lastDay}','%b %d %Y');
                                                SELECT COALESCE(ROUND(SUM(totalPrice)),0) AS totalExpenseOfDebit FROM factory_rmStockIn_data WHERE rmStockInPaymentMethod = 'debit' AND rmStockInDate BETWEEN STR_TO_DATE('${firstDay}','%b %d %Y') AND STR_TO_DATE('${lastDay}','%b %d %Y');
                                                SELECT COALESCE(ROUND(SUM(paidAmount)),0) AS totalPaid FROM factory_supplierTransaction_data WHERE transactionDate BETWEEN STR_TO_DATE('${firstDay}','%b %d %Y') AND STR_TO_DATE('${lastDay}','%b %d %Y');
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
                        totalExpense: data[0][0].totalExpense,
                        totalExpenseOfDebit: data[1][0].totalExpenseOfDebit,
                        totalPaid: data[2][0].totalPaid,
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

// Debit Transaction List

const getRmDebitTransactionList = async (req, res) => {
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
                rmSupplierId: req.query.rmSupplierId,
                searchInvoiceNumber: req.query.searchInvoiceNumber
            }
            if (req.query.rmSupplierId && req.query.startDate && req.query.endDate) {
                sql_querry_getCountdetails = `SELECT count(*) as numRows FROM factory_supplierTransaction_data WHERE factory_supplierTransaction_data.rmSupplierId = '${data.rmSupplierId}' AND factory_supplierTransaction_data.transactionDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y') `;
            } else if (req.query.startDate && req.query.endDate) {
                sql_querry_getCountdetails = `SELECT count(*) as numRows FROM factory_supplierTransaction_data WHERE factory_supplierTransaction_data.transactionDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')`;
            } else if (req.query.rmSupplierId) {
                sql_querry_getCountdetails = `SELECT count(*) as numRows FROM factory_supplierTransaction_data WHERE factory_supplierTransaction_data.rmSupplierId = '${data.rmSupplierId}' AND factory_supplierTransaction_data.transactionDate BETWEEN STR_TO_DATE('${firstDay}','%b %d %Y') AND STR_TO_DATE('${lastDay}','%b %d %Y')`;
            } else if (req.query.searchInvoiceNumber) {
                sql_querry_getCountdetails = `SELECT count(*) as numRows FROM factory_supplierTransaction_data WHERE supplierTransactionId LIKE '%` + data.searchInvoiceNumber + `%'`;
            } else {
                sql_querry_getCountdetails = `SELECT count(*) as numRows FROM factory_supplierTransaction_data WHERE factory_supplierTransaction_data.transactionDate BETWEEN STR_TO_DATE('${firstDay}','%b %d %Y') AND STR_TO_DATE('${lastDay}','%b %d %Y')`;
            }
            pool.query(sql_querry_getCountdetails, (err, rows, fields) => {
                if (err) {
                    console.error("An error occurd in SQL Queery", err);
                    return res.status(500).send('Database Error');
                } else {
                    const numRows = rows[0].numRows;
                    const numPages = Math.ceil(numRows / numPerPage);
                    const sql_common_qurey = `SELECT supplierTransactionId,RIGHT(supplierTransactionId,9) AS invoiceNumber, CONCAT(user_details.userFirstName,' ',user_details.userLastName) AS paidBy, factory_supplier_data.supplierNickName, receivedBy, pendingAmount, paidAmount, transactionNote, DATE_FORMAT(transactionDate,'%d-%M-%Y') AS transactionDate, DATE_FORMAT(supplierTransactionCreationDate,'%h:%i %p') AS transactionTime 
                                                  FROM factory_supplierTransaction_data
                                                  LEFT JOIN user_details ON user_details.userId = factory_supplierTransaction_data.UserId
                                                  LEFT JOIN factory_supplier_data ON factory_supplier_data.rmSupplierId = factory_supplierTransaction_data.rmSupplierId`;
                    if (req.query.rmSupplierId && req.query.startDate && req.query.endDate) {
                        sql_queries_getdetails = `${sql_common_qurey}
                                                        WHERE factory_supplierTransaction_data.rmSupplierId = '${data.rmSupplierId}' AND factory_supplierTransaction_data.transactionDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y') 
                                                        ORDER BY factory_supplierTransaction_data.supplierTransactionCreationDate DESC LIMIT ${limit}`;
                    } else if (req.query.startDate && req.query.endDate) {
                        sql_queries_getdetails = `${sql_common_qurey}
                                                        WHERE factory_supplierTransaction_data.transactionDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y') 
                                                        ORDER BY factory_supplierTransaction_data.supplierTransactionCreationDate DESC LIMIT ${limit}`;
                    } else if (req.query.rmSupplierId) {
                        sql_queries_getdetails = `${sql_common_qurey}
                                                        WHERE factory_supplierTransaction_data.rmSupplierId = '${data.rmSupplierId}' AND factory_supplierTransaction_data.transactionDate BETWEEN STR_TO_DATE('${firstDay}','%b %d %Y') AND STR_TO_DATE('${lastDay}','%b %d %Y')
                                                        ORDER BY factory_supplierTransaction_data.supplierTransactionCreationDate DESC LIMIT ${limit}`;
                    } else if (req.query.searchInvoiceNumber) {
                        sql_queries_getdetails = `${sql_common_qurey}
                                                        WHERE supplierTransactionId LIKE '%` + data.searchInvoiceNumber + `%'
                                                        ORDER BY factory_supplierTransaction_data.supplierTransactionCreationDate DESC LIMIT ${limit}`;
                    } else {
                        sql_queries_getdetails = `${sql_common_qurey}
                                                        WHERE factory_supplierTransaction_data.transactionDate BETWEEN STR_TO_DATE('${firstDay}','%b %d %Y') AND STR_TO_DATE('${lastDay}','%b %d %Y')
                                                        ORDER BY factory_supplierTransaction_data.supplierTransactionCreationDate DESC LIMIT ${limit}`;
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

// cash Transaction List

const getRmCashTransactionList = async (req, res) => {
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
                payMode: req.query.payMode
            }
            if (req.query.startDate && req.query.endDate) {
                sql_querry_getCountdetails = `SELECT count(*) as numRows FROM factory_rmStockIn_data WHERE factory_rmStockIn_data.rmStockInPaymentMethod = '${data.payMode}' AND factory_rmStockIn_data.rmStockInDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')`;
            } else {
                sql_querry_getCountdetails = `SELECT count(*) as numRows FROM factory_rmStockIn_data WHERE factory_rmStockIn_data.rmStockInPaymentMethod = '${data.payMode}' AND factory_rmStockIn_data.rmStockInDate BETWEEN STR_TO_DATE('${firstDay}','%b %d %Y') AND STR_TO_DATE('${lastDay}','%b %d %Y')`;
            }
            pool.query(sql_querry_getCountdetails, (err, rows, fields) => {
                if (err) {
                    console.error("An error occurd in SQL Queery", err);
                    return res.status(500).send('Database Error');
                } else {
                    const numRows = rows[0].numRows;
                    const numPages = Math.ceil(numRows / numPerPage);
                    if (req.query.startDate && req.query.endDate) {
                        sql_queries_getdetails = `SELECT CONCAT(user_details.userFirstName,' ',user_details.userLastName) AS paidBy, factory_supplier_data.supplierNickName AS receviedBy, totalPrice AS paidAmount,  DATE_FORMAT(rmStockInDate,'%d-%M-%Y') AS transactionDate, DATE_FORMAT(rmStockInCreationDate,'%h:%i %p') AS transactionTime 
                                                      FROM factory_rmStockIn_data
                                                      INNER JOIN user_details ON user_details.userId = factory_rmStockIn_data.userId
                                                      INNER JOIN factory_supplier_data ON factory_supplier_data.rmSupplierId = factory_rmStockIn_data.rmSupplierId
                                                      WHERE factory_rmStockIn_data.rmStockInPaymentMethod = '${data.payMode}' AND factory_rmStockIn_data.rmStockInDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')
                                                      ORDER BY factory_rmStockIn_data.rmStockInCreationDate DESC LIMIT ${limit}`;
                    } else {
                        sql_queries_getdetails = `SELECT CONCAT(user_details.userFirstName,' ',user_details.userLastName) AS paidBy, factory_supplier_data.supplierNickName AS receviedBy, totalPrice AS paidAmount,  DATE_FORMAT(rmStockInDate,'%d-%M-%Y') AS transactionDate, DATE_FORMAT(rmStockInCreationDate,'%h:%i %p') AS transactionTime 
                                                      FROM factory_rmStockIn_data
                                                      INNER JOIN user_details ON user_details.userId = factory_rmStockIn_data.userId
                                                      INNER JOIN factory_supplier_data ON factory_supplier_data.rmSupplierId = factory_rmStockIn_data.rmSupplierId
                                                      WHERE factory_rmStockIn_data.rmStockInPaymentMethod = '${data.payMode}' AND factory_rmStockIn_data.rmStockInDate BETWEEN STR_TO_DATE('${firstDay}','%b %d %Y') AND STR_TO_DATE('${lastDay}','%b %d %Y')
                                                      ORDER BY factory_rmStockIn_data.rmStockInCreationDate DESC LIMIT ${limit}`;
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

// Add Supplier Transaction API

const addFacttorySupplierTransactionDetails = async (req, res) => {
    try {

        let token;
        token = req.headers ? req.headers.authorization.split(" ")[1] : null;
        if (token) {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const userId = decoded.id.id;
            const uid1 = new Date();
            const supplierTransactionId = String("Transaction_" + uid1.getTime());
            console.log("...", supplierTransactionId);

            const rmSupplierId = req.body.rmSupplierId;
            const receivedBy = req.body.receivedBy.trim();
            const paidAmount = req.body.paidAmount;
            const transactionNote = req.body.transactionNote ? req.body.transactionNote.trim() : null;
            const transactionDate = creationDate = new Date().toString().slice(4, 15);

            if (!rmSupplierId || !receivedBy || !paidAmount) {
                return res.status(400).send("Please Fill all the feilds");
            }
            const get_remaining_amount = `SELECT COALESCE(sisd.total_price, 0) - COALESCE(sosd.total_paid, 0) AS remainingAmount FROM factory_supplier_data AS sd
                                         LEFT JOIN
                                                     (
                                                         SELECT
                                                             factory_rmStockIn_data.rmSupplierId,
                                                             ROUND(SUM(factory_rmStockIn_data.totalPrice)) AS total_price
                                                         FROM
                                                             factory_rmStockIn_data
                                                         WHERE factory_rmStockIn_data.rmStockInPaymentMethod = 'debit'
                                                         GROUP BY
                                                             factory_rmStockIn_data.rmSupplierId
                                                     ) AS sisd ON sd.rmSupplierId = sisd.rmSupplierId
                                         LEFT JOIN
                                                     (
                                                         SELECT
                                                             factory_supplierTransaction_data.rmSupplierId,
                                                             ROUND(SUM(factory_supplierTransaction_data.paidAmount)) AS total_paid
                                                         FROM
                                                             factory_supplierTransaction_data
                                                         GROUP BY
                                                             factory_supplierTransaction_data.rmSupplierId
                                                     ) AS sosd ON sd.rmSupplierId = sosd.rmSupplierId
                                                     WHERE sd.rmSupplierId = '${rmSupplierId}'`;
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
                    const sql_querry_addTransaction = `INSERT INTO factory_supplierTransaction_data (supplierTransactionId, UserId, rmSupplierId, receivedBy, pendingAmount, paidAmount, transactionNote, transactionDate)  
                                                       VALUES ('${supplierTransactionId}', '${userId}', '${rmSupplierId}', '${receivedBy}', ${remainingAmount}, ${paidAmount}, NULLIF('${transactionNote}','null'), STR_TO_DATE('${transactionDate}','%b %d %Y'))`;
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

// Remove StockOut API

const removeFactorySupplierTransactionDetails = async (req, res) => {
    try {
        const supplierTransactionId = req.query.supplierTransactionId
        req.query.supplierTransactionId = pool.query(`SELECT supplierTransactionId FROM factory_supplierTransaction_data WHERE supplierTransactionId = '${supplierTransactionId}'`, (err, row) => {
            if (err) {
                console.error("An error occurd in SQL Queery", err);
                return res.status(500).send('Database Error');
            }
            if (row && row.length) {
                const sql_querry_removedetails = `DELETE FROM factory_supplierTransaction_data WHERE supplierTransactionId = '${supplierTransactionId}'`;
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

//Fill Supplier Transaction API

const fillFactorySupplieTransactionrDetails = (req, res) => {
    try {
        const supplierTransactionId = req.query.supplierTransactionId
        sql_querry_fillUser = `SELECT supplierTransactionId, rmSupplierId, receivedBy, pendingAmount, paidAmount, transactionNote FROM factory_supplierTransaction_data WHERE supplierTransactionId = '${supplierTransactionId}'`;
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

// Update Supplier Transaction

const updateFactorySupplierTransactionDetails = async (req, res) => {
    try {

        let token;
        token = req.headers ? req.headers.authorization.split(" ")[1] : null;
        if (token) {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const userId = decoded.id.id;
            const supplierTransactionId = req.body.supplierTransactionId;
            const rmSupplierId = req.body.rmSupplierId;
            const receivedBy = req.body.receivedBy.trim();
            const paidAmount = req.body.paidAmount;
            const transactionNote = req.body.transactionNote ? req.body.transactionNote.trim() : null;

            if (!rmSupplierId || !receivedBy || !paidAmount) {
                return res.status(400).send("Please Fill all the feilds");
            }
            const get_remaining_amount = `SELECT pendingAmount AS remainingAmount FROM factory_supplierTransaction_data WHERE supplierTransactionId = '${supplierTransactionId}'`;
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
                    const sql_querry_updateTransaction = `UPDATE factory_supplierTransaction_data SET UserId = '${userId}',
											                                                            rmSupplierId = '${rmSupplierId}',
                                                                                                        receivedBy = '${receivedBy}',
                                                                                                        pendingAmount = '${remainingAmount}',
                                                                                                        paidAmount = ${paidAmount},
                                                                                                        transactionNote = NULLIF('${transactionNote}','null')
                                                                                                  WHERE supplierTransactionId = '${supplierTransactionId}'`;
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

// Export Cash Transaction List

const exportExcelSheetForRmCashTransactionList = (req, res) => {
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
            sql_queries_getdetails = `SELECT CONCAT(user_details.userFirstName,' ',user_details.userLastName) AS paidBy, factory_supplier_data.supplierNickName AS receviedBy, totalPrice AS paidAmount,  DATE_FORMAT(rmStockInDate,'%d-%M-%Y') AS transactionDate, DATE_FORMAT(rmStockInCreationDate,'%h:%i %p') AS transactionTime 
                                        FROM factory_rmStockIn_data
                                        INNER JOIN user_details ON user_details.userId = factory_rmStockIn_data.userId
                                        INNER JOIN factory_supplier_data ON factory_supplier_data.rmSupplierId = factory_rmStockIn_data.rmSupplierId
                                        WHERE factory_rmStockIn_data.rmStockInPaymentMethod = 'cash' AND factory_rmStockIn_data.rmStockInDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')
                                        ORDER BY factory_rmStockIn_data.rmStockInCreationDate DESC`;
        } else {
            sql_queries_getdetails = `SELECT CONCAT(user_details.userFirstName,' ',user_details.userLastName) AS paidBy, factory_supplier_data.supplierNickName AS receviedBy, totalPrice AS paidAmount,  DATE_FORMAT(rmStockInDate,'%d-%M-%Y') AS transactionDate, DATE_FORMAT(rmStockInCreationDate,'%h:%i %p') AS transactionTime 
                                        FROM factory_rmStockIn_data
                                        INNER JOIN user_details ON user_details.userId = factory_rmStockIn_data.userId
                                        INNER JOIN factory_supplier_data ON factory_supplier_data.rmSupplierId = factory_rmStockIn_data.rmSupplierId
                                        WHERE factory_rmStockIn_data.rmStockInPaymentMethod = 'cash' AND factory_rmStockIn_data.rmStockInDate BETWEEN STR_TO_DATE('${firstDay}','%b %d %Y') AND STR_TO_DATE('${lastDay}','%b %d %Y')
                                        ORDER BY factory_rmStockIn_data.rmStockInCreationDate DESC`;
        }
        pool.query(sql_queries_getdetails, async (err, rows) => {
            if (err) return res.status(404).send(err);
            console.log(":::", rows)
            const workbook = new excelJS.Workbook();  // Create a new workbook
            const worksheet = workbook.addWorksheet("Cash Transaction"); // New Worksheet

            if (req.query.startDate && req.query.endDate) {
                worksheet.mergeCells('A1', 'F1');
                worksheet.getCell('A1').value = `Cash Transaction : ${data.startDate} To ${data.endDate}`;
            } else {
                worksheet.mergeCells('A1', 'F1');
                worksheet.getCell('A1').value = `Cash Transaction : ${firstDay} To ${lastDay}`;
            }

            /*Column headers*/
            worksheet.getRow(2).values = ['S no.', 'Paid BY', 'Recevied By', 'Paid Amount', 'Date', 'Time'];

            // Column for data in excel. key must match data key
            worksheet.columns = [
                { key: "s_no", width: 10, },
                { key: "paidBy", width: 30 },
                { key: "receviedBy", width: 30 },
                { key: "paidAmount", width: 20 },
                { key: "transactionDate", width: 25 },
                { key: "transactionTime", width: 10 }
            ];
            //Looping through User data
            const arr = rows
            console.log(">>>", arr);
            let counter = 1;
            arr.forEach((user) => {
                user.s_no = counter;
                worksheet.addRow(user); // Add data in worksheet
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
            worksheet.getRow(arr.length + 3).values = ['Total:', '', '', { formula: `SUM(D3:D${arr.length + 2})` }];
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
                var fileName = new Date().toString().slice(4, 15) + ".xlsx";
                console.log(">>>", fileName);
                // res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
                // res.addHeader(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename="+ fileName)
                res.contentType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
                res.type = 'blob';
                res.send(data)
                // res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
                // res.setHeader("Content-Disposition", "attachment; filename=" + "Report.xlsx");
                // workbook.xlsx.write(res)
                // .then((data)=>{
                //     res.end();
                //         console.log('File write done........');
                //     });
            } catch (err) {
                throw new Error(err);
            }
        })
    } else {
        return res.status(401).send('Pleasr Login Firest.....!');
    }
};

// Export Debit Transaction List

const exportExcelSheetForRmDeditTransaction = (req, res) => {
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
            sql_queries_getdetails = `SELECT CONCAT(user_details.userFirstName,' ',user_details.userLastName) AS paidBy, factory_supplier_data.supplierNickName AS receviedBy, totalPrice AS paidAmount,  DATE_FORMAT(rmStockInDate,'%d-%M-%Y') AS transactionDate, DATE_FORMAT(rmStockInCreationDate,'%h:%i %p') AS transactionTime 
                                          FROM factory_rmStockIn_data
                                          INNER JOIN user_details ON user_details.userId = factory_rmStockIn_data.userId
                                          INNER JOIN factory_supplier_data ON factory_supplier_data.rmSupplierId = factory_rmStockIn_data.rmSupplierId
                                          WHERE factory_rmStockIn_data.rmStockInPaymentMethod = 'debit' AND factory_rmStockIn_data.rmStockInDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')
                                          ORDER BY factory_rmStockIn_data.rmStockInCreationDate DESC`;

        } else {
            sql_queries_getdetails = `SELECT CONCAT(user_details.userFirstName,' ',user_details.userLastName) AS paidBy, factory_supplier_data.supplierNickName AS receviedBy, totalPrice AS paidAmount,  DATE_FORMAT(rmStockInDate,'%d-%M-%Y') AS transactionDate, DATE_FORMAT(rmStockInCreationDate,'%h:%i %p') AS transactionTime 
                                          FROM factory_rmStockIn_data
                                          INNER JOIN user_details ON user_details.userId = factory_rmStockIn_data.userId
                                          INNER JOIN factory_supplier_data ON factory_supplier_data.rmSupplierId = factory_rmStockIn_data.rmSupplierId
                                          WHERE factory_rmStockIn_data.rmStockInPaymentMethod = 'debit' AND factory_rmStockIn_data.rmStockInDate BETWEEN STR_TO_DATE('${firstDay}','%b %d %Y') AND STR_TO_DATE('${lastDay}','%b %d %Y')
                                          ORDER BY factory_rmStockIn_data.rmStockInCreationDate DESC`;
        }
        console.log('find me', sql_queries_getdetails)
        pool.query(sql_queries_getdetails, async (err, rows) => {
            if (err) return res.status(404).send(err);
            console.log(":::", rows)
            const workbook = new excelJS.Workbook();  // Create a new workbook
            const worksheet = workbook.addWorksheet("Debit List"); // New Worksheet

            if (req.query.startDate && req.query.endDate) {
                worksheet.mergeCells('A1', 'F1');
                worksheet.getCell('A1').value = `Debit Transaction : ${data.startDate} To ${data.endDate}`;
            } else {
                worksheet.mergeCells('A1', 'F1');
                worksheet.getCell('A1').value = `Debit Transaction : ${firstDay} To ${lastDay}`;
            }


            /*Column headers*/
            worksheet.getRow(2).values = ['S no.', 'Recevied By', 'Supplier', 'Debit Amount', 'Date', 'Time'];

            // Column for data in excel. key must match data key
            worksheet.columns = [
                { key: "s_no", width: 10, },
                { key: "receviedBy", width: 30 },
                { key: "paidBy", width: 30 },
                { key: "paidAmount", width: 20 },
                { key: "transactionDate", width: 25 },
                { key: "transactionTime", width: 10 }
            ];
            //Looping through User data
            const arr = rows
            console.log(">>>", arr);
            let counter = 1;
            arr.forEach((user) => {
                user.s_no = counter;
                worksheet.addRow(user); // Add data in worksheet
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
            worksheet.getRow(arr.length + 3).values = ['Total:', '', '', { formula: `SUM(D3:D${arr.length + 2})` }];
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
                var fileName = new Date().toString().slice(4, 15) + ".xlsx";
                console.log(">>>", fileName);
                // res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
                // res.addHeader(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename="+ fileName)
                res.contentType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
                res.type = 'blob';
                res.send(data)
                // res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
                // res.setHeader("Content-Disposition", "attachment; filename=" + "Report.xlsx");
                // workbook.xlsx.write(res)
                // .then((data)=>{
                //     res.end();
                //         console.log('File write done........');
                //     });
            } catch (err) {
                throw new Error(err);
            }
        })
    } else {
        return res.status(401).send('Pleasr Login Firest.....!');
    }
};

// Export Debit Transaction List

const exportExcelSheetForRmDebitTransactionList = (req, res) => {
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
            rmSupplierId: req.query.rmSupplierId
        }
        const sql_common_qurey = `SELECT RIGHT(supplierTransactionId,9), CONCAT(user_details.userFirstName,' ',user_details.userLastName) AS paidBy, factory_supplier_data.supplierNickName, receivedBy, pendingAmount, paidAmount, transactionNote, DATE_FORMAT(transactionDate,'%d-%M-%Y') AS transactionDate, DATE_FORMAT(supplierTransactionCreationDate,'%h:%i %p') AS transactionTime 
                                      FROM factory_supplierTransaction_data
                                      INNER JOIN user_details ON user_details.userId = factory_supplierTransaction_data.UserId
                                      INNER JOIN factory_supplier_data ON factory_supplier_data.rmSupplierId = factory_supplierTransaction_data.rmSupplierId`;
        if (req.query.rmSupplierId && req.query.startDate && req.query.endDate) {
            sql_queries_getdetails = `${sql_common_qurey}
                                    WHERE factory_supplierTransaction_data.rmSupplierId = '${data.rmSupplierId}' AND factory_supplierTransaction_data.transactionDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y') 
                                    ORDER BY factory_supplierTransaction_data.supplierTransactionCreationDate DESC`;
        } else if (req.query.startDate && req.query.endDate) {
            sql_queries_getdetails = `${sql_common_qurey}
                                    WHERE factory_supplierTransaction_data.transactionDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y') 
                                    ORDER BY factory_supplierTransaction_data.supplierTransactionCreationDate DESC`;
        } else if (req.query.rmSupplierId) {
            sql_queries_getdetails = `${sql_common_qurey}
                                    WHERE factory_supplierTransaction_data.rmSupplierId = '${data.rmSupplierId}' AND factory_supplierTransaction_data.transactionDate BETWEEN STR_TO_DATE('${firstDay}','%b %d %Y') AND STR_TO_DATE('${lastDay}','%b %d %Y')
                                    ORDER BY factory_supplierTransaction_data.supplierTransactionCreationDate DESC`;
        } else {
            sql_queries_getdetails = `${sql_common_qurey}
                                    WHERE factory_supplierTransaction_data.transactionDate BETWEEN STR_TO_DATE('${firstDay}','%b %d %Y') AND STR_TO_DATE('${lastDay}','%b %d %Y')
                                    ORDER BY factory_supplierTransaction_data.supplierTransactionCreationDate DESC`;
        }
        pool.query(sql_queries_getdetails, async (err, rows) => {
            if (err) return res.status(404).send(err);
            const workbook = new excelJS.Workbook();  // Create a new workbook
            const worksheet = workbook.addWorksheet("Transaction"); // New Worksheet

            if (req.query.startDate && req.query.endDate) {
                worksheet.mergeCells('A1', 'I1');
                worksheet.getCell('A1').value = `Transaction : ${data.startDate} To ${data.endDate}`;
            } else {
                worksheet.mergeCells('A1', 'I1');
                worksheet.getCell('A1').value = `Transaction : ${firstDay} To ${lastDay}`;
            }

            /*Column headers*/
            worksheet.getRow(2).values = ['S no.', 'Paid By', 'Recevied By', 'Supplier', 'Panding Amount', 'Paid Amount', 'Note', 'Date', 'Time'];

            // Column for data in excel. key must match data key
            worksheet.columns = [
                { key: "s_no", width: 10, },
                { key: "paidBy", width: 30 },
                { key: "receivedBy", width: 30 },
                { key: "supplierNickName", width: 30 },
                { key: "pendingAmount", width: 20 },
                { key: "paidAmount", width: 20 },
                { key: "transactionNote", width: 40 },
                { key: "transactionDate", width: 20 },
                { key: "transactionTime", width: 10 },
            ]
            //Looping through User data
            const arr = rows
            console.log(">>>", arr);
            let counter = 1;
            arr.forEach((user) => {
                user.s_no = counter;
                worksheet.addRow(user); // Add data in worksheet
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
                cell.height = 40
            })
            worksheet.eachRow((row) => {
                row.eachCell((cell) => {
                    cell.alignment = { horizontal: 'center', vertical: 'middle' };
                    row.height = 20
                });
            });
            try {
                const data = await workbook.xlsx.writeBuffer()
                var fileName = new Date().toString().slice(4, 15) + ".xlsx";
                console.log(">>>", fileName);
                // res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
                // res.addHeader(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename="+ fileName)
                res.contentType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
                res.type = 'blob';
                res.send(data)
                // res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
                // res.setHeader("Content-Disposition", "attachment; filename=" + "Report.xlsx");
                // workbook.xlsx.write(res)
                // .then((data)=>{
                //     res.end();
                //         console.log('File write done........');
                //     });
            } catch (err) {
                throw new Error(err);
            }
        })
    } else {
        return res.status(401).send('Pleasr Login Firest.....!');
    }
};

// Export PDF of Transaction Invoice

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
        firstPage.drawText(details.invoiceNumber, {
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

        firstPage.drawText(details.receivedBy, {
            x: 50,
            y: 505,
            size: 9,
            font: helveticaFont
        })

        firstPage.drawText(details.paidBy, {
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

const exportRmSupplierTransactionInvoiceData = async (req, res) => {
    try {
        const transactionId = req.query.transactionId;
        const sql_queries_getInvoiceDetails = `SELECT 
                                                    RIGHT(supplierTransactionId,9) AS invoiceNumber,
                                                    CONCAT(user_details.userFirstName,' ',user_details.userLastName) AS paidBy, 
                                                    sd.suppliertName, 
                                                    sd.supplierFirmName, 
                                                    sd.supplierPhoneNumber,
                                                    receivedBy, 
                                                    pendingAmount, 
                                                    paidAmount, 
                                                    (pendingAmount - paidAmount) AS remainingAmount, 
                                                    transactionNote, 
                                                    DATE_FORMAT(transactionDate,'%d %M %Y, %W') AS transactionDate, 
                                                    DATE_FORMAT(supplierTransactionCreationDate,'%h:%i %p') AS transactionTime 
                                                FROM 
                                                    factory_supplierTransaction_data AS istd
                                                INNER JOIN user_details ON user_details.userId = istd.UserId
                                                INNER JOIN 
                                                (
                                                	SELECT 
                                                   		rmSupplierId,
                                                		supplierNickName AS suppliertName,
                                                		supplierFirmName,
                                                		supplierPhoneNumber
                                                    FROM 
                                                        factory_supplier_data
                                                ) AS sd ON istd.rmSupplierId = sd.rmSupplierId
                                                WHERE istd.supplierTransactionId = '${transactionId}'`;
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

// Export PDF Function

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

// Export PDF Cash Transaction List

const exportPdfForRmCashTransactionList = (req, res) => {
    try {
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
            sql_queries_getdetails = `SELECT 
                                        CONCAT(user_details.userFirstName,' ',user_details.userLastName) AS "Paid By", 
                                        factory_supplier_data.supplierNickName AS "Received By", 
                                        totalPrice AS "Paid Amount",  
                                        DATE_FORMAT(rmStockInDate,'%d-%M-%Y') AS "Date", 
                                        DATE_FORMAT(rmStockInCreationDate,'%h:%i %p') AS "Time" 
                                      FROM factory_rmStockIn_data
                                      INNER JOIN user_details ON user_details.userId = factory_rmStockIn_data.userId
                                      INNER JOIN factory_supplier_data ON factory_supplier_data.rmSupplierId = factory_rmStockIn_data.rmSupplierId
                                      WHERE factory_rmStockIn_data.rmStockInPaymentMethod = 'cash' AND factory_rmStockIn_data.rmStockInDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')
                                      ORDER BY factory_rmStockIn_data.rmStockInCreationDate DESC`;
        } else {
            sql_queries_getdetails = `SELECT 
                                        CONCAT(user_details.userFirstName,' ',user_details.userLastName) AS "Paid By", 
                                        factory_supplier_data.supplierNickName AS "Received By", 
                                        totalPrice AS "Paid Amount",  
                                        DATE_FORMAT(rmStockInDate,'%d-%M-%Y') AS "Date", 
                                        DATE_FORMAT(rmStockInCreationDate,'%h:%i %p') AS "Time" 
                                      FROM factory_rmStockIn_data
                                      INNER JOIN user_details ON user_details.userId = factory_rmStockIn_data.userId
                                      INNER JOIN factory_supplier_data ON factory_supplier_data.rmSupplierId = factory_rmStockIn_data.rmSupplierId
                                      WHERE factory_rmStockIn_data.rmStockInPaymentMethod = 'cash' AND factory_rmStockIn_data.rmStockInDate BETWEEN STR_TO_DATE('${firstDay}','%b %d %Y') AND STR_TO_DATE('${lastDay}','%b %d %Y')
                                      ORDER BY factory_rmStockIn_data.rmStockInCreationDate DESC`;
        }
        pool.query(sql_queries_getdetails, (err, rows) => {
            if (err) {
                console.error("An error occurd in SQL Queery", err);
                return res.status(500).send('Database Error');
            } else if (rows && rows.length <= 0) {
                return res.status(400).send('No Data Found');
            }
            const abc = Object.values(JSON.parse(JSON.stringify(rows)));
            const sumPayAmount = abc.reduce((total, item) => total + (item['Paid Amount'] || 0), 0);;
            const sumFooterArray = ['Total', '', '', parseFloat(sumPayAmount).toLocaleString('en-IN')];
            if (req.query.startDate && req.query.endDate) {
                tableHeading = `Cash Transaction From ${data.startDate} To ${data.endDate}`;
            } else {
                tableHeading = `Cash Transaction From ${firstDay} To ${lastDay}`;
            }

            createPDF(res, abc, sumFooterArray, tableHeading)
                .then(() => {
                    console.log('PDF created successfully');
                    res.status(200);
                })
                .catch((err) => {
                    console.log(err);
                    res.status(500).send('Error creating PDF');
                });
        });
    } catch (error) {
        console.error('An error occurd', error);
        res.status(500).send('Internal Server Error');
    }
}

// Export PDF Debit Transaction List

const exportPdfForRmDeditTransaction = (req, res) => {
    try {
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
            sql_queries_getdetails = `SELECT 
                                            CONCAT(user_details.userFirstName,' ',user_details.userLastName) AS "Paid By", 
                                            factory_supplier_data.supplierNickName AS "Received By",
                                            totalPrice AS "Paid Amount",  
                                            DATE_FORMAT(rmStockInDate,'%d-%M-%Y') AS "Date", 
                                            DATE_FORMAT(rmStockInCreationDate,'%h:%i %p') AS "Time" 
                                          FROM factory_rmStockIn_data
                                          INNER JOIN user_details ON user_details.userId = factory_rmStockIn_data.userId
                                          INNER JOIN factory_supplier_data ON factory_supplier_data.rmSupplierId = factory_rmStockIn_data.rmSupplierId
                                          WHERE factory_rmStockIn_data.rmStockInPaymentMethod = 'debit' AND factory_rmStockIn_data.rmStockInDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')
                                          ORDER BY factory_rmStockIn_data.rmStockInCreationDate DESC`;

        } else {
            sql_queries_getdetails = `SELECT 
                                            CONCAT(user_details.userFirstName,' ',user_details.userLastName) AS "Paid By", 
                                            factory_supplier_data.supplierNickName AS "Received By", 
                                            totalPrice AS "Paid Amount",  
                                            DATE_FORMAT(rmStockInDate,'%d-%M-%Y') AS "Date", 
                                            DATE_FORMAT(rmStockInCreationDate,'%h:%i %p') AS "Time" 
                                          FROM factory_rmStockIn_data
                                          INNER JOIN user_details ON user_details.userId = factory_rmStockIn_data.userId
                                          INNER JOIN factory_supplier_data ON factory_supplier_data.rmSupplierId = factory_rmStockIn_data.rmSupplierId
                                          WHERE factory_rmStockIn_data.rmStockInPaymentMethod = 'debit' AND factory_rmStockIn_data.rmStockInDate BETWEEN STR_TO_DATE('${firstDay}','%b %d %Y') AND STR_TO_DATE('${lastDay}','%b %d %Y')
                                          ORDER BY factory_rmStockIn_data.rmStockInCreationDate DESC`;
        }
        pool.query(sql_queries_getdetails, (err, rows) => {
            if (err) {
                console.error("An error occurd in SQL Queery", err);
                return res.status(500).send('Database Error');
            } else if (rows && rows.length <= 0) {
                return res.status(400).send('No Data Found');
            }
            const abc = Object.values(JSON.parse(JSON.stringify(rows)));
            const sumPayAmount = abc.reduce((total, item) => total + (item['Paid Amount'] || 0), 0);;
            const sumFooterArray = ['Total', '', '', parseFloat(sumPayAmount).toLocaleString('en-IN')];
            if (req.query.startDate && req.query.endDate) {
                tableHeading = `Debit Transaction From ${data.startDate} To ${data.endDate}`;
            } else {
                tableHeading = `Debit Transaction From ${firstDay} To ${lastDay}`;
            }

            createPDF(res, abc, sumFooterArray, tableHeading)
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
        res.status(500).send('Internal Server Error');
    }
}

// Export PDF Transaction List

const exportPdfForRmDebitTransactionList = (req, res) => {
    try {
        var date = new Date(), y = date.getFullYear(), m = (date.getMonth());
        var firstDay = new Date(y, m, 1).toString().slice(4, 15);
        var lastDay = new Date(y, m + 1, 0).toString().slice(4, 15);

        console.log("1111>>>>", firstDay);
        console.log("1111>>>>", lastDay);

        const data = {
            startDate: (req.query.startDate ? req.query.startDate : '').slice(4, 15),
            endDate: (req.query.endDate ? req.query.endDate : '').slice(4, 15),
            rmSupplierId: req.query.rmSupplierId
        }
        const sql_common_qurey = `SELECT 
                                    RIGHT(supplierTransactionId,9) AS "Transaction ID", 
                                    CONCAT(user_details.userFirstName,' ',user_details.userLastName) AS "Paid By", 
                                    factory_supplier_data.supplierNickName AS "Supplier Name", 
                                    receivedBy AS "Received By", 
                                    pendingAmount AS "Pending Amount", 
                                    paidAmount AS "Paid Amount", 
                                    transactionNote AS "Note", 
                                    DATE_FORMAT(transactionDate,'%d-%M-%Y') AS "Date", 
                                    DATE_FORMAT(supplierTransactionCreationDate,'%h:%i %p') AS "TIme" 
                                  FROM factory_supplierTransaction_data
                                  INNER JOIN user_details ON user_details.userId = factory_supplierTransaction_data.UserId
                                  INNER JOIN factory_supplier_data ON factory_supplier_data.rmSupplierId = factory_supplierTransaction_data.rmSupplierId`;
        if (req.query.rmSupplierId && req.query.startDate && req.query.endDate) {
            sql_queries_getdetails = `${sql_common_qurey}
                                        WHERE factory_supplierTransaction_data.rmSupplierId = '${data.rmSupplierId}' AND factory_supplierTransaction_data.transactionDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y') 
                                        ORDER BY factory_supplierTransaction_data.supplierTransactionCreationDate DESC`;
        } else if (req.query.startDate && req.query.endDate) {
            sql_queries_getdetails = `${sql_common_qurey}
                                        WHERE factory_supplierTransaction_data.transactionDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y') 
                                        ORDER BY factory_supplierTransaction_data.supplierTransactionCreationDate DESC`;
        } else if (req.query.rmSupplierId) {
            sql_queries_getdetails = `${sql_common_qurey}
                                        WHERE factory_supplierTransaction_data.rmSupplierId = '${data.rmSupplierId}' AND factory_supplierTransaction_data.transactionDate BETWEEN STR_TO_DATE('${firstDay}','%b %d %Y') AND STR_TO_DATE('${lastDay}','%b %d %Y')
                                        ORDER BY factory_supplierTransaction_data.supplierTransactionCreationDate DESC`;
        } else {
            sql_queries_getdetails = `${sql_common_qurey}
                                        WHERE factory_supplierTransaction_data.transactionDate BETWEEN STR_TO_DATE('${firstDay}','%b %d %Y') AND STR_TO_DATE('${lastDay}','%b %d %Y')
                                        ORDER BY factory_supplierTransaction_data.supplierTransactionCreationDate DESC`;
        }
        pool.query(sql_queries_getdetails, (err, rows) => {
            if (err) {
                console.error("An error occurd in SQL Queery", err);
                return res.status(500).send('Database Error');
            } else if (rows && rows.length <= 0) {
                return res.status(400).send('No Data Found');
            }
            const abc = Object.values(JSON.parse(JSON.stringify(rows)));
            const sumPayAmount = abc.reduce((total, item) => total + (item['Paid Amount'] || 0), 0);;
            const sumFooterArray = ['Total', '', '', '', '', '', parseFloat(sumPayAmount).toLocaleString('en-IN')];
            if (req.query.supplierId && req.query.startDate && req.query.endDate) {
                tableHeading = `Transaction List From ${data.startDate} To ${data.endDate}`;
            } else if (req.query.startDate && req.query.endDate) {
                tableHeading = `Transaction List From ${data.startDate} To ${data.endDate}`;
            } else if (req.query.supplierId) {
                tableHeading = `Transaction List From ${firstDay} To ${lastDay}`;
            } else {
                tableHeading = `Transaction List From ${firstDay} To ${lastDay}`;
            }
            createPDF(res, abc, sumFooterArray, tableHeading)
                .then(() => {
                    console.log('PDF created successfully');
                    res.status(200);
                })
                .catch((err) => {
                    console.log(err);
                    res.status(500).send('Error creating PDF');
                });
        });
    } catch (error) {
        console.error('An error occurd', error);
        res.status(500).send('Internal Server Error');
    }
}


module.exports = {
    getRmCashTransactionCounter,
    getRmDebitTransactionCounter,
    getRmDebitTransactionList,
    getRmCashTransactionList,
    addFacttorySupplierTransactionDetails,
    removeFactorySupplierTransactionDetails,
    fillFactorySupplieTransactionrDetails,
    updateFactorySupplierTransactionDetails,
    exportExcelSheetForRmCashTransactionList,
    exportExcelSheetForRmDeditTransaction,
    exportExcelSheetForRmDebitTransactionList,
    exportRmSupplierTransactionInvoiceData,
    exportPdfForRmCashTransactionList,
    exportPdfForRmDeditTransaction,
    exportPdfForRmDebitTransactionList
}