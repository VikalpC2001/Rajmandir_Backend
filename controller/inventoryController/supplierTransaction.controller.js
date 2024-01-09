const pool = require('../../database');
const jwt = require("jsonwebtoken");
const excelJS = require("exceljs");
const { PDFDocument, StandardFonts, rgb } = require("pdf-lib");
const { writeFileSync, readFileSync } = require("fs");
const fs = require('fs');
const { Readable } = require('stream')

// Cash Transaction Count API

const getCashTransactionCounter = (req, res) => {
    try {
        let token;
        token = req.headers.authorization ? req.headers.authorization.split(" ")[1] : null;
        if (token) {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const branchId = decoded && decoded.id && decoded.id.branchId ? decoded.id.branchId : null;
            if (branchId) {
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
                    sql_querry_getCashCount = `SELECT COALESCE(ROUND(SUM(totalPrice)),0) AS totalExpense FROM inventory_stockIn_data WHERE inventory_stockIn_data.branchId = '${branchId}' AND stockInDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y');
                                               SELECT COALESCE(ROUND(SUM(totalPrice)),0) AS totalExpenseOfCash FROM inventory_stockIn_data WHERE inventory_stockIn_data.branchId = '${branchId}' AND stockInPaymentMethod = 'cash' AND stockInDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')`;
                } else {
                    sql_querry_getCashCount = `SELECT COALESCE(ROUND(SUM(totalPrice)),0) AS totalExpense FROM inventory_stockIn_data WHERE inventory_stockIn_data.branchId = '${branchId}' AND stockInDate BETWEEN STR_TO_DATE('${firstDay}','%b %d %Y') AND STR_TO_DATE('${lastDay}','%b %d %Y');
                                               SELECT COALESCE(ROUND(SUM(totalPrice)),0) AS totalExpenseOfCash FROM inventory_stockIn_data WHERE inventory_stockIn_data.branchId = '${branchId}' AND stockInPaymentMethod = 'cash' AND stockInDate BETWEEN STR_TO_DATE('${firstDay}','%b %d %Y') AND STR_TO_DATE('${lastDay}','%b %d %Y')`;
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
                return res.status(401).send('BranchId Not Found');
            }
        } else {
            return res.status(401).send('Pleasr Login Firest.....!');
        }
    } catch (error) {
        console.error('An error occurd', error);
        res.status(500).json('Internal Server Error');
    }
}

// Debit Transaction Count API

const getDebitTransactionCounter = (req, res) => {
    try {
        let token;
        token = req.headers.authorization ? req.headers.authorization.split(" ")[1] : null;
        if (token) {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const branchId = decoded && decoded.id && decoded.id.branchId ? decoded.id.branchId : null;
            if (branchId) {
                var date = new Date(), y = date.getFullYear(), m = (date.getMonth());
                var firstDay = new Date(y, m, 1).toString().slice(4, 15);
                var lastDay = new Date(y, m + 1, 0).toString().slice(4, 15);

                console.log("1111>>>>", firstDay);
                console.log("1111>>>>", lastDay);

                const data = {
                    startDate: (req.query.startDate ? req.query.startDate : '').slice(4, 15),
                    endDate: (req.query.endDate ? req.query.endDate : '').slice(4, 15),
                }
                const sql_querry_remailAmount = `SELECT SUM(COALESCE(sisd.total_price, 0) - COALESCE(sosd.total_paid, 0)) AS remainingAmount FROM inventory_supplier_data AS sd
                                                 LEFT JOIN
                                                             (
                                                                 SELECT
                                                                     inventory_stockIn_data.supplierId,
                                                                     ROUND(SUM(inventory_stockIn_data.totalPrice)) AS total_price
                                                                 FROM
                                                                     inventory_stockIn_data
                                                                 WHERE inventory_stockIn_data.branchId = '${branchId}' AND inventory_stockIn_data.stockInPaymentMethod = 'debit'
                                                                 GROUP BY
                                                                     inventory_stockIn_data.supplierId
                                                             ) AS sisd ON sd.supplierId = sisd.supplierId
                                                 LEFT JOIN
                                                             (
                                                                 SELECT
                                                                     inventory_supplierTransaction_data.supplierId,
                                                                     ROUND(SUM(inventory_supplierTransaction_data.paidAmount)) AS total_paid
                                                                 FROM
                                                                     inventory_supplierTransaction_data
                                                                 WHERE inventory_supplierTransaction_data.branchId = '${branchId}'
                                                                 GROUP BY
                                                                     inventory_supplierTransaction_data.supplierId
                                                             ) AS sosd ON sd.supplierId = sosd.supplierId;`
                if (req.query.startDate && req.query.endDate) {
                    sql_querry_getDebitCount = `SELECT COALESCE(ROUND(SUM(totalPrice)),0) AS totalExpense FROM inventory_stockIn_data WHERE inventory_stockIn_data.branchId = '${branchId}' AND stockInDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y');
                                                SELECT COALESCE(ROUND(SUM(totalPrice)),0) AS totalExpenseOfDebit FROM inventory_stockIn_data WHERE inventory_stockIn_data.branchId = '${branchId}' AND stockInPaymentMethod = 'debit' AND stockInDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y');
                                                SELECT COALESCE(ROUND(SUM(paidAmount)),0) AS totalPaid FROM inventory_supplierTransaction_data WHERE inventory_supplierTransaction_data.branchId = '${branchId}' AND transactionDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y');
                                                ${sql_querry_remailAmount}`;
                } else {
                    sql_querry_getDebitCount = `SELECT COALESCE(ROUND(SUM(totalPrice)),0) AS totalExpense FROM inventory_stockIn_data WHERE inventory_stockIn_data.branchId = '${branchId}' AND stockInDate BETWEEN STR_TO_DATE('${firstDay}','%b %d %Y') AND STR_TO_DATE('${lastDay}','%b %d %Y');
                                                SELECT COALESCE(ROUND(SUM(totalPrice)),0) AS totalExpenseOfDebit FROM inventory_stockIn_data WHERE inventory_stockIn_data.branchId = '${branchId}' AND stockInPaymentMethod = 'debit' AND stockInDate BETWEEN STR_TO_DATE('${firstDay}','%b %d %Y') AND STR_TO_DATE('${lastDay}','%b %d %Y');
                                                SELECT COALESCE(ROUND(SUM(paidAmount)),0) AS totalPaid FROM inventory_supplierTransaction_data WHERE inventory_supplierTransaction_data.branchId = '${branchId}' AND transactionDate BETWEEN STR_TO_DATE('${firstDay}','%b %d %Y') AND STR_TO_DATE('${lastDay}','%b %d %Y');
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
                return res.status(401).send('BranchId Not Found');
            }
        } else {
            return res.status(401).send('Pleasr Login Firest.....!');
        }
    } catch (error) {
        console.error('An error occurd', error);
        res.status(500).json('Internal Server Error');
    }
}

// Debit Transaction List

const getDebitTransactionList = async (req, res) => {
    try {
        let token;
        token = req.headers.authorization ? req.headers.authorization.split(" ")[1] : null;
        if (token) {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const branchId = decoded && decoded.id && decoded.id.branchId ? decoded.id.branchId : null;
            if (branchId) {
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
                    supplierId: req.query.supplierId,
                    searchInvoiceNumber: req.query.searchInvoiceNumber
                }
                if (req.query.supplierId && req.query.startDate && req.query.endDate) {
                    sql_querry_getCountdetails = `SELECT count(*) as numRows FROM inventory_supplierTransaction_data WHERE inventory_supplierTransaction_data.branchId = '${branchId}' AND inventory_supplierTransaction_data.supplierId = '${data.supplierId}' AND inventory_supplierTransaction_data.transactionDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y') `;
                } else if (req.query.startDate && req.query.endDate) {
                    sql_querry_getCountdetails = `SELECT count(*) as numRows FROM inventory_supplierTransaction_data WHERE inventory_supplierTransaction_data.branchId = '${branchId}' AND  inventory_supplierTransaction_data.transactionDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')`;
                } else if (req.query.supplierId) {
                    sql_querry_getCountdetails = `SELECT count(*) as numRows FROM inventory_supplierTransaction_data WHERE inventory_supplierTransaction_data.branchId = '${branchId}' AND inventory_supplierTransaction_data.supplierId = '${data.supplierId}' AND inventory_supplierTransaction_data.transactionDate BETWEEN STR_TO_DATE('${firstDay}','%b %d %Y') AND STR_TO_DATE('${lastDay}','%b %d %Y')`;
                } else if (req.query.searchInvoiceNumber) {
                    sql_querry_getCountdetails = `SELECT count(*) as numRows FROM inventory_supplierTransaction_data WHERE inventory_supplierTransaction_data.branchId = '${branchId}' AND supplierTransactionId LIKE '%` + data.searchInvoiceNumber + `%'`;
                } else {
                    sql_querry_getCountdetails = `SELECT count(*) as numRows FROM inventory_supplierTransaction_data WHERE inventory_supplierTransaction_data.branchId = '${branchId}' AND  inventory_supplierTransaction_data.transactionDate BETWEEN STR_TO_DATE('${firstDay}','%b %d %Y') AND STR_TO_DATE('${lastDay}','%b %d %Y')`;
                }
                console.log('><>?//', sql_querry_getCountdetails);
                pool.query(sql_querry_getCountdetails, (err, rows, fields) => {
                    if (err) {
                        console.error("An error occurd in SQL Queery", err);
                        return res.status(500).send('Database Error');
                    } else {
                        const numRows = rows[0].numRows;
                        const numPages = Math.ceil(numRows / numPerPage);
                        const sql_common_qurey = `SELECT supplierTransactionId,RIGHT(supplierTransactionId,9) AS invoiceNumber, CONCAT(user_details.userFirstName,' ',user_details.userLastName) AS paidBy, inventory_supplier_data.supplierNickName, receivedBy, pendingAmount, paidAmount, transactionNote, DATE_FORMAT(transactionDate,'%d-%M-%Y') AS transactionDate, DATE_FORMAT(supplierTransactionCreationDate,'%h:%i %p') AS transactionTime 
                                                  FROM inventory_supplierTransaction_data
                                                  LEFT JOIN user_details ON user_details.userId = inventory_supplierTransaction_data.UserId
                                                  LEFT JOIN inventory_supplier_data ON inventory_supplier_data.supplierId = inventory_supplierTransaction_data.supplierId`;
                        if (req.query.supplierId && req.query.startDate && req.query.endDate) {
                            sql_queries_getdetails = `${sql_common_qurey}
                                                        WHERE inventory_supplierTransaction_data.branchId = '${branchId}' AND inventory_supplierTransaction_data.supplierId = '${data.supplierId}' AND inventory_supplierTransaction_data.transactionDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y') 
                                                        ORDER BY inventory_supplierTransaction_data.supplierTransactionCreationDate DESC LIMIT ${limit}`;
                        } else if (req.query.startDate && req.query.endDate) {
                            sql_queries_getdetails = `${sql_common_qurey}
                                                        WHERE inventory_supplierTransaction_data.branchId = '${branchId}' AND inventory_supplierTransaction_data.transactionDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y') 
                                                        ORDER BY inventory_supplierTransaction_data.supplierTransactionCreationDate DESC LIMIT ${limit}`;
                        } else if (req.query.supplierId) {
                            sql_queries_getdetails = `${sql_common_qurey}
                                                        WHERE inventory_supplierTransaction_data.branchId = '${branchId}' AND inventory_supplierTransaction_data.supplierId = '${data.supplierId}' AND inventory_supplierTransaction_data.transactionDate BETWEEN STR_TO_DATE('${firstDay}','%b %d %Y') AND STR_TO_DATE('${lastDay}','%b %d %Y')
                                                        ORDER BY inventory_supplierTransaction_data.supplierTransactionCreationDate DESC LIMIT ${limit}`;
                        } else if (req.query.searchInvoiceNumber) {
                            sql_queries_getdetails = `${sql_common_qurey}
                                                        WHERE inventory_supplierTransaction_data.branchId = '${branchId}' AND supplierTransactionId LIKE '%` + data.searchInvoiceNumber + `%'
                                                        ORDER BY inventory_supplierTransaction_data.supplierTransactionCreationDate DESC LIMIT ${limit}`;
                        } else {
                            sql_queries_getdetails = `${sql_common_qurey}
                                                        WHERE inventory_supplierTransaction_data.branchId = '${branchId}' AND inventory_supplierTransaction_data.transactionDate BETWEEN STR_TO_DATE('${firstDay}','%b %d %Y') AND STR_TO_DATE('${lastDay}','%b %d %Y')
                                                        ORDER BY inventory_supplierTransaction_data.supplierTransactionCreationDate DESC LIMIT ${limit}`;
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
                return res.status(401).send('BranchId Not Found');
            }
        } else {
            return res.status(401).send('Pleasr Login Firest.....!');
        }
    } catch (error) {
        console.error('An error occurd', error);
        res.status(500).json('Internal Server Error');
    }
}

// cash Transaction List

const getCashTransactionList = async (req, res) => {
    try {
        let token;
        token = req.headers.authorization ? req.headers.authorization.split(" ")[1] : null;
        if (token) {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const branchId = decoded && decoded.id && decoded.id.branchId ? decoded.id.branchId : null;
            if (branchId) {
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
                    sql_querry_getCountdetails = `SELECT count(*) as numRows FROM inventory_stockIn_data WHERE inventory_stockIn_data.branchId = '${branchId}' AND inventory_stockIn_data.stockInPaymentMethod = '${data.payMode}' AND inventory_stockIn_data.stockInDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')`;
                } else {
                    sql_querry_getCountdetails = `SELECT count(*) as numRows FROM inventory_stockIn_data WHERE inventory_stockIn_data.branchId = '${branchId}' AND inventory_stockIn_data.stockInPaymentMethod = '${data.payMode}' AND inventory_stockIn_data.stockInDate BETWEEN STR_TO_DATE('${firstDay}','%b %d %Y') AND STR_TO_DATE('${lastDay}','%b %d %Y')`;
                }
                pool.query(sql_querry_getCountdetails, (err, rows, fields) => {
                    if (err) {
                        console.error("An error occurd in SQL Queery", err);
                        return res.status(500).send('Database Error');
                    } else {
                        const numRows = rows[0].numRows;
                        const numPages = Math.ceil(numRows / numPerPage);
                        if (req.query.startDate && req.query.endDate) {
                            sql_queries_getdetails = `SELECT CONCAT(user_details.userFirstName,' ',user_details.userLastName) AS paidBy, inventory_supplier_data.supplierNickName AS receviedBy, totalPrice AS paidAmount,  DATE_FORMAT(stockInDate,'%d-%M-%Y') AS transactionDate, DATE_FORMAT(stockInCreationDate,'%h:%i %p') AS transactionTime 
                                                      FROM inventory_stockIn_data
                                                      INNER JOIN user_details ON user_details.userId = inventory_stockIn_data.userId
                                                      INNER JOIN inventory_supplier_data ON inventory_supplier_data.supplierId = inventory_stockIn_data.supplierId
                                                      WHERE inventory_stockIn_data.branchId = '${branchId}' AND inventory_stockIn_data.stockInPaymentMethod = '${data.payMode}' AND inventory_stockIn_data.stockInDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')
                                                      ORDER BY inventory_stockIn_data.stockInCreationDate DESC LIMIT ${limit}`;
                        } else {
                            sql_queries_getdetails = `SELECT CONCAT(user_details.userFirstName,' ',user_details.userLastName) AS paidBy, inventory_supplier_data.supplierNickName AS receviedBy, totalPrice AS paidAmount,  DATE_FORMAT(stockInDate,'%d-%M-%Y') AS transactionDate, DATE_FORMAT(stockInCreationDate,'%h:%i %p') AS transactionTime 
                                                      FROM inventory_stockIn_data
                                                      INNER JOIN user_details ON user_details.userId = inventory_stockIn_data.userId
                                                      INNER JOIN inventory_supplier_data ON inventory_supplier_data.supplierId = inventory_stockIn_data.supplierId
                                                      WHERE inventory_stockIn_data.branchId = '${branchId}' AND inventory_stockIn_data.stockInPaymentMethod = '${data.payMode}' AND inventory_stockIn_data.stockInDate BETWEEN STR_TO_DATE('${firstDay}','%b %d %Y') AND STR_TO_DATE('${lastDay}','%b %d %Y')
                                                      ORDER BY inventory_stockIn_data.stockInCreationDate DESC LIMIT ${limit}`;
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
                return res.status(401).send('BranchId Not Found');
            }
        } else {
            return res.status(401).send('Pleasr Login Firest.....!');
        }
    } catch (error) {
        console.error('An error occurd', error);
        res.status(500).json('Internal Server Error');
    }
}

// Add Supplier Transaction API

const addSupplierTransactionDetails = async (req, res) => {
    try {

        let token;
        token = req.headers.authorization.split(" ")[1];
        if (token) {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const userId = decoded.id.id;
            const tokenBranchId = decoded && decoded.id && decoded.id.branchId ? decoded.id.branchId : null;
            const uid1 = new Date();
            const supplierTransactionId = String("Transaction_" + uid1.getTime());
            console.log("...", supplierTransactionId);

            const supplierId = req.body.supplierId;
            const branchId = req && req.body.branchId ? req.body.branchId : tokenBranchId;
            const receivedBy = req.body.receivedBy.trim();
            const paidAmount = req.body.paidAmount;
            const transactionNote = req.body.transactionNote ? req.body.transactionNote.trim() : null;
            const transactionDate = creationDate = new Date().toString().slice(4, 15);

            if (!supplierId || !receivedBy || !paidAmount || !branchId) {
                return res.status(400).send("Please Fill all the feilds");
            }
            const get_remaining_amount = `SELECT COALESCE(sisd.total_price, 0) - COALESCE(sosd.total_paid, 0) AS remainingAmount FROM inventory_supplier_data AS sd
                                         LEFT JOIN
                                                     (
                                                         SELECT
                                                             inventory_stockIn_data.supplierId,
                                                             ROUND(SUM(inventory_stockIn_data.totalPrice)) AS total_price
                                                         FROM
                                                             inventory_stockIn_data
                                                         WHERE inventory_stockIn_data.branchId = '${branchId}' AND inventory_stockIn_data.stockInPaymentMethod = 'debit'
                                                         GROUP BY
                                                             inventory_stockIn_data.supplierId
                                                     ) AS sisd ON sd.supplierId = sisd.supplierId
                                         LEFT JOIN
                                                     (
                                                         SELECT
                                                             inventory_supplierTransaction_data.supplierId,
                                                             ROUND(SUM(inventory_supplierTransaction_data.paidAmount)) AS total_paid
                                                         FROM
                                                             inventory_supplierTransaction_data
                                                         WHERE inventory_supplierTransaction_data.branchId = '${branchId}'
                                                         GROUP BY
                                                             inventory_supplierTransaction_data.supplierId
                                                     ) AS sosd ON sd.supplierId = sosd.supplierId
                                                     WHERE sd.supplierId = '${supplierId}'`;
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
                    const sql_querry_addTransaction = `INSERT INTO inventory_supplierTransaction_data (supplierTransactionId, branchId, UserId, supplierId, receivedBy, pendingAmount, paidAmount, transactionNote, transactionDate)  
                                                       VALUES ('${supplierTransactionId}', '${branchId}', '${userId}', '${supplierId}', '${receivedBy}', ${remainingAmount}, ${paidAmount}, NULLIF('${transactionNote}','null'), STR_TO_DATE('${transactionDate}','%b %d %Y'))`;
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

const removeSupplierTransactionDetails = async (req, res) => {

    try {
        const supplierTransactionId = req.query.supplierTransactionId
        req.query.supplierTransactionId = pool.query(`SELECT supplierTransactionId FROM inventory_supplierTransaction_data WHERE supplierTransactionId = '${supplierTransactionId}'`, (err, row) => {
            if (err) {
                console.error("An error occurd in SQL Queery", err);
                return res.status(500).send('Database Error');
            }
            if (row && row.length) {
                const sql_querry_removedetails = `DELETE FROM inventory_supplierTransaction_data WHERE supplierTransactionId = '${supplierTransactionId}'`;
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

const fillSupplieTransactionrDetails = (req, res) => {
    try {
        const supplierTransactionId = req.query.supplierTransactionId
        sql_querry_fillUser = `SELECT supplierTransactionId, supplierId, receivedBy, pendingAmount, paidAmount, transactionNote FROM inventory_supplierTransaction_data WHERE supplierTransactionId = '${supplierTransactionId}'`;
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

const updateSupplierTransactionDetails = async (req, res) => {
    try {

        let token;
        token = req.headers.authorization.split(" ")[1];
        if (token) {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const userId = decoded.id.id;
            const tokenBranchId = decoded && decoded.id && decoded.id.branchId ? decoded.id.branchId : null;
            const supplierTransactionId = req.body.supplierTransactionId;
            const branchId = req && req.body.branchId ? req.body.branchId : tokenBranchId;
            const supplierId = req.body.supplierId;
            const receivedBy = req.body.receivedBy.trim();
            const paidAmount = req.body.paidAmount;
            const transactionNote = req.body.transactionNote ? req.body.transactionNote.trim() : null;

            if (!supplierId || !receivedBy || !paidAmount) {
                return res.status(400).send("Please Fill all the feilds");
            }
            const get_remaining_amount = `SELECT pendingAmount AS remainingAmount FROM inventory_supplierTransaction_data WHERE supplierTransactionId = '${supplierTransactionId}'`;
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
                    const sql_querry_updateTransaction = `UPDATE inventory_supplierTransaction_data SET UserId = '${userId}',
                                                                                                        branchId = '${branchId}',
											                                                            supplierId = '${supplierId}',
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

const exportExcelSheetForCashTransactionList = (req, res) => {
    let token;
    token = req.headers.authorization ? req.headers.authorization.split(" ")[1] : null;
    if (token) {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const branchId = decoded && decoded.id && decoded.id.branchId ? decoded.id.branchId : null;
        if (branchId) {
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
                sql_queries_getdetails = `SELECT CONCAT(user_details.userFirstName,' ',user_details.userLastName) AS paidBy, inventory_supplier_data.supplierNickName AS receviedBy, totalPrice AS paidAmount,  DATE_FORMAT(stockInDate,'%d-%M-%Y') AS transactionDate, DATE_FORMAT(stockInCreationDate,'%h:%i %p') AS transactionTime 
                                  FROM inventory_stockIn_data
                                  INNER JOIN user_details ON user_details.userId = inventory_stockIn_data.userId
                                  INNER JOIN inventory_supplier_data ON inventory_supplier_data.supplierId = inventory_stockIn_data.supplierId
                                  WHERE inventory_stockIn_data.branchId = '${branchId}' AND inventory_stockIn_data.stockInPaymentMethod = 'cash' AND inventory_stockIn_data.stockInDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')
                                  ORDER BY inventory_stockIn_data.stockInCreationDate DESC`;
            } else {
                sql_queries_getdetails = `SELECT CONCAT(user_details.userFirstName,' ',user_details.userLastName) AS paidBy, inventory_supplier_data.supplierNickName AS receviedBy, totalPrice AS paidAmount,  DATE_FORMAT(stockInDate,'%d-%M-%Y') AS transactionDate, DATE_FORMAT(stockInCreationDate,'%h:%i %p') AS transactionTime 
                                  FROM inventory_stockIn_data
                                  INNER JOIN user_details ON user_details.userId = inventory_stockIn_data.userId
                                  INNER JOIN inventory_supplier_data ON inventory_supplier_data.supplierId = inventory_stockIn_data.supplierId
                                  WHERE inventory_stockIn_data.branchId = '${branchId}' AND inventory_stockIn_data.stockInPaymentMethod = 'cash' AND inventory_stockIn_data.stockInDate BETWEEN STR_TO_DATE('${firstDay}','%b %d %Y') AND STR_TO_DATE('${lastDay}','%b %d %Y')
                                  ORDER BY inventory_stockIn_data.stockInCreationDate DESC`;
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
            return res.status(401).send('BranchId Not Found');
        }
    } else {
        return res.status(401).send('Pleasr Login Firest.....!');
    }
};

// Export Debit Transaction List

const exportExcelSheetForDeditTransaction = (req, res) => {
    let token;
    token = req.headers.authorization ? req.headers.authorization.split(" ")[1] : null;
    if (token) {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const branchId = decoded && decoded.id && decoded.id.branchId ? decoded.id.branchId : null;
        if (branchId) {
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
                sql_queries_getdetails = `SELECT CONCAT(user_details.userFirstName,' ',user_details.userLastName) AS paidBy, inventory_supplier_data.supplierNickName AS receviedBy, totalPrice AS paidAmount,  DATE_FORMAT(stockInDate,'%d-%M-%Y') AS transactionDate, DATE_FORMAT(stockInCreationDate,'%h:%i %p') AS transactionTime 
                                          FROM inventory_stockIn_data
                                          INNER JOIN user_details ON user_details.userId = inventory_stockIn_data.userId
                                          INNER JOIN inventory_supplier_data ON inventory_supplier_data.supplierId = inventory_stockIn_data.supplierId
                                          WHERE inventory_stockIn_data.branchId = '${branchId}' AND inventory_stockIn_data.stockInPaymentMethod = 'debit' AND inventory_stockIn_data.stockInDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')
                                          ORDER BY inventory_stockIn_data.stockInCreationDate DESC`;

            } else {
                sql_queries_getdetails = `SELECT CONCAT(user_details.userFirstName,' ',user_details.userLastName) AS paidBy, inventory_supplier_data.supplierNickName AS receviedBy, totalPrice AS paidAmount,  DATE_FORMAT(stockInDate,'%d-%M-%Y') AS transactionDate, DATE_FORMAT(stockInCreationDate,'%h:%i %p') AS transactionTime 
                                          FROM inventory_stockIn_data
                                          INNER JOIN user_details ON user_details.userId = inventory_stockIn_data.userId
                                          INNER JOIN inventory_supplier_data ON inventory_supplier_data.supplierId = inventory_stockIn_data.supplierId
                                          WHERE inventory_stockIn_data.branchId = '${branchId}' AND inventory_stockIn_data.stockInPaymentMethod = 'debit' AND inventory_stockIn_data.stockInDate BETWEEN STR_TO_DATE('${firstDay}','%b %d %Y') AND STR_TO_DATE('${lastDay}','%b %d %Y')
                                          ORDER BY inventory_stockIn_data.stockInCreationDate DESC`;
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
            return res.status(401).send('BranchId Not Found');
        }
    } else {
        return res.status(401).send('Pleasr Login Firest.....!');
    }
};

// Export Debit Transaction List

const exportExcelSheetForDebitTransactionList = (req, res) => {
    let token;
    token = req.headers.authorization ? req.headers.authorization.split(" ")[1] : null;
    if (token) {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const branchId = decoded && decoded.id && decoded.id.branchId ? decoded.id.branchId : null;
        if (branchId) {
            var date = new Date(), y = date.getFullYear(), m = (date.getMonth());
            var firstDay = new Date(y, m, 1).toString().slice(4, 15);
            var lastDay = new Date(y, m + 1, 0).toString().slice(4, 15);

            console.log("1111>>>>", firstDay);
            console.log("1111>>>>", lastDay);

            const data = {
                startDate: (req.query.startDate ? req.query.startDate : '').slice(4, 15),
                endDate: (req.query.endDate ? req.query.endDate : '').slice(4, 15),
                supplierId: req.query.supplierId
            }
            const sql_common_qurey = `SELECT supplierTransactionId, CONCAT(user_details.userFirstName,' ',user_details.userLastName) AS paidBy, inventory_supplier_data.supplierNickName, receivedBy, pendingAmount, paidAmount, transactionNote, DATE_FORMAT(transactionDate,'%d-%M-%Y') AS transactionDate, DATE_FORMAT(supplierTransactionCreationDate,'%h:%i %p') AS transactionTime 
                                      FROM inventory_supplierTransaction_data
                                      INNER JOIN user_details ON user_details.userId = inventory_supplierTransaction_data.UserId
                                      INNER JOIN inventory_supplier_data ON inventory_supplier_data.supplierId = inventory_supplierTransaction_data.supplierId`;
            if (req.query.supplierId && req.query.startDate && req.query.endDate) {
                sql_queries_getdetails = `${sql_common_qurey}
                                    WHERE inventory_supplierTransaction_data.branchId = '${branchId}' AND inventory_supplierTransaction_data.supplierId = '${data.supplierId}' AND inventory_supplierTransaction_data.transactionDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y') 
                                    ORDER BY inventory_supplierTransaction_data.supplierTransactionCreationDate DESC`;
            } else if (req.query.startDate && req.query.endDate) {
                sql_queries_getdetails = `${sql_common_qurey}
                                    WHERE inventory_supplierTransaction_data.branchId = '${branchId}' AND inventory_supplierTransaction_data.transactionDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y') 
                                    ORDER BY inventory_supplierTransaction_data.supplierTransactionCreationDate DESC`;
            } else if (req.query.supplierId) {
                sql_queries_getdetails = `${sql_common_qurey}
                                    WHERE inventory_supplierTransaction_data.branchId = '${branchId}' AND inventory_supplierTransaction_data.supplierId = '${data.supplierId}' AND inventory_supplierTransaction_data.transactionDate BETWEEN STR_TO_DATE('${firstDay}','%b %d %Y') AND STR_TO_DATE('${lastDay}','%b %d %Y')
                                    ORDER BY inventory_supplierTransaction_data.supplierTransactionCreationDate DESC`;
            } else {
                sql_queries_getdetails = `${sql_common_qurey}
                                    WHERE inventory_supplierTransaction_data.branchId = '${branchId}' AND inventory_supplierTransaction_data.transactionDate BETWEEN STR_TO_DATE('${firstDay}','%b %d %Y') AND STR_TO_DATE('${lastDay}','%b %d %Y')
                                    ORDER BY inventory_supplierTransaction_data.supplierTransactionCreationDate DESC`;
            }
            pool.query(sql_queries_getdetails, async (err, rows) => {
                if (err) return res.status(404).send(err);
                const workbook = new excelJS.Workbook();  // Create a new workbook
                const worksheet = workbook.addWorksheet("Debit Transaction"); // New Worksheet

                if (req.query.startDate && req.query.endDate) {
                    worksheet.mergeCells('A1', 'I1');
                    worksheet.getCell('A1').value = `Debit Transaction : ${data.startDate} To ${data.endDate}`;
                } else {
                    worksheet.mergeCells('A1', 'I1');
                    worksheet.getCell('A1').value = `Debit Transaction : ${firstDay} To ${lastDay}`;
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
            return res.status(401).send('BranchId Not Found');
        }
    } else {
        return res.status(401).send('Pleasr Login Firest.....!');
    }
};

module.exports = {
    addSupplierTransactionDetails,
    updateSupplierTransactionDetails,
    removeSupplierTransactionDetails,
    fillSupplieTransactionrDetails,
    getDebitTransactionList,
    getCashTransactionList,
    exportExcelSheetForDebitTransactionList,
    exportExcelSheetForCashTransactionList,
    exportExcelSheetForDeditTransaction,
    getCashTransactionCounter,
    getDebitTransactionCounter
}