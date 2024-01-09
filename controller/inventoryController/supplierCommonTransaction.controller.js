const pool = require('../../database');
const jwt = require("jsonwebtoken");
const excelJS = require("exceljs");
const { PDFDocument, StandardFonts, rgb } = require("pdf-lib");
const { writeFileSync, readFileSync } = require("fs");
const fs = require('fs');
const { Readable } = require('stream')

// Cash Transaction Count API

const getOwnerCashTransactionCounter = (req, res) => {
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
            sql_querry_getCashCount = `SELECT COALESCE(ROUND(SUM(totalPrice)),0) AS totalExpense FROM inventory_stockIn_data WHERE stockInDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y');
                                       SELECT COALESCE(ROUND(SUM(totalPrice)),0) AS totalExpenseOfCash FROM inventory_stockIn_data WHERE stockInPaymentMethod = 'cash' AND stockInDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')`;
        } else {
            sql_querry_getCashCount = `SELECT COALESCE(ROUND(SUM(totalPrice)),0) AS totalExpense FROM inventory_stockIn_data WHERE stockInDate BETWEEN STR_TO_DATE('${firstDay}','%b %d %Y') AND STR_TO_DATE('${lastDay}','%b %d %Y');
                                       SELECT COALESCE(ROUND(SUM(totalPrice)),0) AS totalExpenseOfCash FROM inventory_stockIn_data WHERE stockInPaymentMethod = 'cash' AND stockInDate BETWEEN STR_TO_DATE('${firstDay}','%b %d %Y') AND STR_TO_DATE('${lastDay}','%b %d %Y')`;
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
    } catch (error) {
        console.error('An error occurd', error);
        res.status(500).json('Internal Server Error');
    }
}

// Debit Transaction Count API

const getOwnerDebitTransactionCounter = (req, res) => {
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
        const sql_querry_remailAmount = `SELECT SUM(COALESCE(sisd.total_price, 0) - COALESCE(sosd.total_paid, 0)) AS remainingAmount FROM inventory_supplier_data AS sd
                            LEFT JOIN
                                        (
                                            SELECT
                                                inventory_stockIn_data.supplierId,
                                                ROUND(SUM(inventory_stockIn_data.totalPrice)) AS total_price
                                            FROM
                                                inventory_stockIn_data
                                            WHERE inventory_stockIn_data.stockInPaymentMethod = 'debit'
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
                                            GROUP BY
                                                inventory_supplierTransaction_data.supplierId
                                        ) AS sosd ON sd.supplierId = sosd.supplierId;`
        if (req.query.startDate && req.query.endDate) {
            sql_querry_getDebitCount = `SELECT COALESCE(ROUND(SUM(totalPrice)),0) AS totalExpense FROM inventory_stockIn_data WHERE stockInDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y');
                                        SELECT COALESCE(ROUND(SUM(totalPrice)),0) AS totalExpenseOfDebit FROM inventory_stockIn_data WHERE stockInPaymentMethod = 'debit' AND stockInDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y');
                                        SELECT COALESCE(ROUND(SUM(paidAmount)),0) AS totalPaid FROM inventory_supplierTransaction_data WHERE transactionDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y');
                                        ${sql_querry_remailAmount}`;
        } else {
            sql_querry_getDebitCount = `SELECT COALESCE(ROUND(SUM(totalPrice)),0) AS totalExpense FROM inventory_stockIn_data WHERE stockInDate BETWEEN STR_TO_DATE('${firstDay}','%b %d %Y') AND STR_TO_DATE('${lastDay}','%b %d %Y');
                                        SELECT COALESCE(ROUND(SUM(totalPrice)),0) AS totalExpenseOfDebit FROM inventory_stockIn_data WHERE stockInPaymentMethod = 'debit' AND stockInDate BETWEEN STR_TO_DATE('${firstDay}','%b %d %Y') AND STR_TO_DATE('${lastDay}','%b %d %Y');
                                        SELECT COALESCE(ROUND(SUM(paidAmount)),0) AS totalPaid FROM inventory_supplierTransaction_data WHERE transactionDate BETWEEN STR_TO_DATE('${firstDay}','%b %d %Y') AND STR_TO_DATE('${lastDay}','%b %d %Y');
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
    } catch (error) {
        console.error('An error occurd', error);
        res.status(500).json('Internal Server Error');
    }
}

// Debit Transaction List

const getOwnerDebitTransactionList = async (req, res) => {
    try {
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
            sql_querry_getCountdetails = `SELECT count(*) as numRows FROM inventory_supplierTransaction_data WHERE inventory_supplierTransaction_data.supplierId = '${data.supplierId}' AND inventory_supplierTransaction_data.transactionDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y') `;
        } else if (req.query.startDate && req.query.endDate) {
            sql_querry_getCountdetails = `SELECT count(*) as numRows FROM inventory_supplierTransaction_data WHERE  inventory_supplierTransaction_data.transactionDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')`;
        } else if (req.query.supplierId) {
            sql_querry_getCountdetails = `SELECT count(*) as numRows FROM inventory_supplierTransaction_data WHERE inventory_supplierTransaction_data.supplierId = '${data.supplierId}' AND inventory_supplierTransaction_data.transactionDate BETWEEN STR_TO_DATE('${firstDay}','%b %d %Y') AND STR_TO_DATE('${lastDay}','%b %d %Y')`;
        } else if (req.query.searchInvoiceNumber) {
            sql_querry_getCountdetails = `SELECT count(*) as numRows FROM inventory_supplierTransaction_data WHERE supplierTransactionId LIKE '%` + data.searchInvoiceNumber + `%'`;
        } else {
            sql_querry_getCountdetails = `SELECT count(*) as numRows FROM inventory_supplierTransaction_data WHERE  inventory_supplierTransaction_data.transactionDate BETWEEN STR_TO_DATE('${firstDay}','%b %d %Y') AND STR_TO_DATE('${lastDay}','%b %d %Y')`;
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
                                                WHERE inventory_supplierTransaction_data.supplierId = '${data.supplierId}' AND inventory_supplierTransaction_data.transactionDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y') 
                                                ORDER BY inventory_supplierTransaction_data.supplierTransactionCreationDate DESC LIMIT ${limit}`;
                } else if (req.query.startDate && req.query.endDate) {
                    sql_queries_getdetails = `${sql_common_qurey}
                                                WHERE inventory_supplierTransaction_data.transactionDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y') 
                                                ORDER BY inventory_supplierTransaction_data.supplierTransactionCreationDate DESC LIMIT ${limit}`;
                } else if (req.query.supplierId) {
                    sql_queries_getdetails = `${sql_common_qurey}
                                                WHERE inventory_supplierTransaction_data.supplierId = '${data.supplierId}' AND inventory_supplierTransaction_data.transactionDate BETWEEN STR_TO_DATE('${firstDay}','%b %d %Y') AND STR_TO_DATE('${lastDay}','%b %d %Y')
                                                ORDER BY inventory_supplierTransaction_data.supplierTransactionCreationDate DESC LIMIT ${limit}`;
                } else if (req.query.searchInvoiceNumber) {
                    sql_queries_getdetails = `${sql_common_qurey}
                                                WHERE supplierTransactionId LIKE '%` + data.searchInvoiceNumber + `%'
                                                ORDER BY inventory_supplierTransaction_data.supplierTransactionCreationDate DESC LIMIT ${limit}`;
                } else {
                    sql_queries_getdetails = `${sql_common_qurey}
                                                WHERE  inventory_supplierTransaction_data.transactionDate BETWEEN STR_TO_DATE('${firstDay}','%b %d %Y') AND STR_TO_DATE('${lastDay}','%b %d %Y')
                                                ORDER BY inventory_supplierTransaction_data.supplierTransactionCreationDate DESC LIMIT ${limit}`;
                }
                console.log('bbbbbbb', sql_queries_getdetails);
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
    } catch (error) {
        console.error('An error occurd', error);
        res.status(500).json('Internal Server Error');
    }
}

// Export Debit Transaction List

const exportExcelSheetForOwnerDebitTransactionList = (req, res) => {

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
                                    WHERE inventory_supplierTransaction_data.supplierId = '${data.supplierId}' AND inventory_supplierTransaction_data.transactionDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y') 
                                    ORDER BY inventory_supplierTransaction_data.supplierTransactionCreationDate DESC`;
    } else if (req.query.startDate && req.query.endDate) {
        sql_queries_getdetails = `${sql_common_qurey}
                                    WHERE  inventory_supplierTransaction_data.transactionDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y') 
                                    ORDER BY inventory_supplierTransaction_data.supplierTransactionCreationDate DESC`;
    } else if (req.query.supplierId) {
        sql_queries_getdetails = `${sql_common_qurey}
                                    WHERE inventory_supplierTransaction_data.supplierId = '${data.supplierId}' AND inventory_supplierTransaction_data.transactionDate BETWEEN STR_TO_DATE('${firstDay}','%b %d %Y') AND STR_TO_DATE('${lastDay}','%b %d %Y')
                                    ORDER BY inventory_supplierTransaction_data.supplierTransactionCreationDate DESC`;
    } else {
        sql_queries_getdetails = `${sql_common_qurey}
                                    WHERE  inventory_supplierTransaction_data.transactionDate BETWEEN STR_TO_DATE('${firstDay}','%b %d %Y') AND STR_TO_DATE('${lastDay}','%b %d %Y')
                                    ORDER BY inventory_supplierTransaction_data.supplierTransactionCreationDate DESC`;
    }
    console.log('find me', sql_queries_getdetails)
    pool.query(sql_queries_getdetails, async (err, rows) => {
        if (err) return res.status(404).send(err);
        console.log(":::", rows)
        const workbook = new excelJS.Workbook();  // Create a new workbook
        const worksheet = workbook.addWorksheet("StockOut List"); // New Worksheet

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
};

// cash Transaction List

const getOwnerCashTransactionList = async (req, res) => {
    try {
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
            sql_querry_getCountdetails = `SELECT count(*) as numRows FROM inventory_stockIn_data WHERE inventory_stockIn_data.stockInPaymentMethod = '${data.payMode}' AND inventory_stockIn_data.stockInDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')`;
        } else {
            sql_querry_getCountdetails = `SELECT count(*) as numRows FROM inventory_stockIn_data WHERE inventory_stockIn_data.stockInPaymentMethod = '${data.payMode}' AND inventory_stockIn_data.stockInDate BETWEEN STR_TO_DATE('${firstDay}','%b %d %Y') AND STR_TO_DATE('${lastDay}','%b %d %Y')`;
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
                                                WHERE inventory_stockIn_data.stockInPaymentMethod = '${data.payMode}' AND inventory_stockIn_data.stockInDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')
                                                ORDER BY inventory_stockIn_data.stockInCreationDate DESC LIMIT ${limit}`;
                } else {
                    sql_queries_getdetails = `SELECT CONCAT(user_details.userFirstName,' ',user_details.userLastName) AS paidBy, inventory_supplier_data.supplierNickName AS receviedBy, totalPrice AS paidAmount,  DATE_FORMAT(stockInDate,'%d-%M-%Y') AS transactionDate, DATE_FORMAT(stockInCreationDate,'%h:%i %p') AS transactionTime 
                                                FROM inventory_stockIn_data
                                                INNER JOIN user_details ON user_details.userId = inventory_stockIn_data.userId
                                                INNER JOIN inventory_supplier_data ON inventory_supplier_data.supplierId = inventory_stockIn_data.supplierId
                                                WHERE inventory_stockIn_data.stockInPaymentMethod = '${data.payMode}' AND inventory_stockIn_data.stockInDate BETWEEN STR_TO_DATE('${firstDay}','%b %d %Y') AND STR_TO_DATE('${lastDay}','%b %d %Y')
                                                ORDER BY inventory_stockIn_data.stockInCreationDate DESC LIMIT ${limit}`;
                }
                console.log('bbbbbbb', sql_queries_getdetails);
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
    } catch (error) {
        console.error('An error occurd', error);
        res.status(500).json('Internal Server Error');
    }
}

// Export Cash Transaction List

const exportExcelSheetForOwnerCashTransactionList = (req, res) => {

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
                                  WHERE inventory_stockIn_data.stockInPaymentMethod = 'cash' AND inventory_stockIn_data.stockInDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')
                                  ORDER BY inventory_stockIn_data.stockInCreationDate DESC`;

    } else {
        sql_queries_getdetails = `SELECT CONCAT(user_details.userFirstName,' ',user_details.userLastName) AS paidBy, inventory_supplier_data.supplierNickName AS receviedBy, totalPrice AS paidAmount,  DATE_FORMAT(stockInDate,'%d-%M-%Y') AS transactionDate, DATE_FORMAT(stockInCreationDate,'%h:%i %p') AS transactionTime 
                                  FROM inventory_stockIn_data
                                  INNER JOIN user_details ON user_details.userId = inventory_stockIn_data.userId
                                  INNER JOIN inventory_supplier_data ON inventory_supplier_data.supplierId = inventory_stockIn_data.supplierId
                                  WHERE inventory_stockIn_data.stockInPaymentMethod = 'cash' AND inventory_stockIn_data.stockInDate BETWEEN STR_TO_DATE('${firstDay}','%b %d %Y') AND STR_TO_DATE('${lastDay}','%b %d %Y')
                                  ORDER BY inventory_stockIn_data.stockInCreationDate DESC`;
    }

    console.log('find me', sql_queries_getdetails)
    pool.query(sql_queries_getdetails, async (err, rows) => {
        if (err) return res.status(404).send(err);
        console.log(":::", rows)
        const workbook = new excelJS.Workbook();  // Create a new workbook
        const worksheet = workbook.addWorksheet("StockIn List"); // New Worksheet

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
};

const exportExcelSheetForOwnerDeditTransaction = (req, res) => {

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
                                  WHERE inventory_stockIn_data.stockInPaymentMethod = 'debit' AND inventory_stockIn_data.stockInDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')
                                  ORDER BY inventory_stockIn_data.stockInCreationDate DESC`;

    } else {
        sql_queries_getdetails = `SELECT CONCAT(user_details.userFirstName,' ',user_details.userLastName) AS paidBy, inventory_supplier_data.supplierNickName AS receviedBy, totalPrice AS paidAmount,  DATE_FORMAT(stockInDate,'%d-%M-%Y') AS transactionDate, DATE_FORMAT(stockInCreationDate,'%h:%i %p') AS transactionTime 
                                  FROM inventory_stockIn_data
                                  INNER JOIN user_details ON user_details.userId = inventory_stockIn_data.userId
                                  INNER JOIN inventory_supplier_data ON inventory_supplier_data.supplierId = inventory_stockIn_data.supplierId
                                  WHERE inventory_stockIn_data.stockInPaymentMethod = 'debit' AND inventory_stockIn_data.stockInDate BETWEEN STR_TO_DATE('${firstDay}','%b %d %Y') AND STR_TO_DATE('${lastDay}','%b %d %Y')
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
};

// Export PDF of Transaction Invoice

async function createPDF(res, data) {
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

const exportTransactionInvoiceData = async (req, res) => {
    try {
        console.log('hyyy');
        const transactionId = req.query.transactionId;
        const sql_queries_getInvoiceDetails = `SELECT RIGHT(supplierTransactionId,9) AS invoiceNumber,CONCAT(user_details.userFirstName,' ',user_details.userLastName) AS paidBy, sd.suppliertName, sd.supplierFirmName, sd.supplierPhoneNumber,receivedBy, pendingAmount, paidAmount, (pendingAmount - paidAmount) AS remainingAmount, transactionNote, DATE_FORMAT(transactionDate,'%d %M %Y, %W') AS transactionDate, DATE_FORMAT(supplierTransactionCreationDate,'%h:%i %p') AS transactionTime FROM inventory_supplierTransaction_data AS istd
                                                INNER JOIN user_details ON user_details.userId = istd.UserId
                                                INNER JOIN 
                                                (
                                                	SELECT 
                                                   		supplierId,
                                                		supplierNickName AS suppliertName,
                                                		supplierFirmName,
                                                		supplierPhoneNumber
                                                    FROM 
                                                        inventory_supplier_data
                                                ) AS sd ON istd.supplierId = sd.supplierId
                                                WHERE istd.supplierTransactionId = '${transactionId}'`;
        pool.query(sql_queries_getInvoiceDetails, (err, data) => {
            if (err) {
                console.error("An error occurd in SQL Queery", err);
                return res.status(500).send('Database Error');
            }
            createPDF(res, data)
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
    getOwnerDebitTransactionList,
    getOwnerCashTransactionList,
    getOwnerCashTransactionCounter,
    getOwnerDebitTransactionCounter,
    exportExcelSheetForOwnerDebitTransactionList,
    exportExcelSheetForOwnerDeditTransaction,
    exportExcelSheetForOwnerCashTransactionList,
    exportTransactionInvoiceData
}