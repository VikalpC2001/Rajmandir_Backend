const pool = require('../../database');
const excelJS = require("exceljs");
const jwt = require("jsonwebtoken");
const { jsPDF } = require('jspdf');
const { processDatas } = require('../inventoryController/conversation.controller');

// Get Count List Supplier Wise

const getOwnerSupplierCounterDetailsById = (req, res) => {
    try {
        var date = new Date(), y = date.getFullYear(), m = (date.getMonth());
        var firstDay = new Date(y, m, 1).toString().slice(4, 15);
        var lastDay = new Date(y, m + 1, 0).toString().slice(4, 15);

        const data = {
            startDate: (req.query.startDate ? req.query.startDate : '').slice(4, 15),
            endDate: (req.query.endDate ? req.query.endDate : '').slice(4, 15),
            supplierId: req.query.supplierId
        }
        const sql_querry_remainAmount = `SELECT SUM(COALESCE(sisd.total_price, 0) - COALESCE(sosd.total_paid, 0)) AS remainingAmountOfSupplier FROM inventory_supplier_data AS sd
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
                                                ) AS sosd ON sd.supplierId = sosd.supplierId
                                         WHERE sd.supplierId = '${data.supplierId}';`;
        if (req.query.startDate && req.query.endDate) {
            sql_querry_getSupplierCount = `SELECT COALESCE(ROUND(SUM(totalPrice)),0) AS totalBusiness FROM inventory_stockIn_data WHERE supplierId = '${data.supplierId}' AND stockInDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y');
                                            SELECT COALESCE(ROUND(SUM(totalPrice)),0) AS totalBusinessOfDebit FROM inventory_stockIn_data WHERE supplierId = '${data.supplierId}' AND stockInPaymentMethod = 'debit' AND stockInDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y');
                                            SELECT COALESCE(ROUND(SUM(totalPrice)),0) AS totalBusinessOfCash FROM inventory_stockIn_data WHERE supplierId = '${data.supplierId}' AND stockInPaymentMethod = 'cash' AND stockInDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y');
                                            SELECT COALESCE(ROUND(SUM(paidAmount)),0) AS totalPaidtoSupplier FROM inventory_supplierTransaction_data WHERE supplierId = '${data.supplierId}' AND transactionDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y');
                                            SELECT COUNT(productId) AS numbreOfProduct FROM inventory_supplierProducts_data WHERE supplierId = '${data.supplierId}';
                                            ${sql_querry_remainAmount}`;
        } else {
            sql_querry_getSupplierCount = `SELECT COALESCE(ROUND(SUM(totalPrice)),0) AS totalBusiness FROM inventory_stockIn_data WHERE supplierId = '${data.supplierId}' AND stockInDate BETWEEN STR_TO_DATE('${firstDay}','%b %d %Y') AND STR_TO_DATE('${lastDay}','%b %d %Y');
                                            SELECT COALESCE(ROUND(SUM(totalPrice)),0) AS totalBusinessOfDebit FROM inventory_stockIn_data WHERE supplierId = '${data.supplierId}' AND stockInPaymentMethod = 'debit' AND stockInDate BETWEEN STR_TO_DATE('${firstDay}','%b %d %Y') AND STR_TO_DATE('${lastDay}','%b %d %Y');
                                            SELECT COALESCE(ROUND(SUM(totalPrice)),0) AS totalBusinessOfCash FROM inventory_stockIn_data WHERE supplierId = '${data.supplierId}' AND stockInPaymentMethod = 'cash' AND stockInDate BETWEEN STR_TO_DATE('${firstDay}','%b %d %Y') AND STR_TO_DATE('${lastDay}','%b %d %Y');
                                            SELECT COALESCE(ROUND(SUM(paidAmount)),0) AS totalPaidtoSupplier FROM inventory_supplierTransaction_data WHERE supplierId = '${data.supplierId}' AND transactionDate BETWEEN STR_TO_DATE('${firstDay}','%b %d %Y') AND STR_TO_DATE('${lastDay}','%b %d %Y');
                                            SELECT COUNT(productId) AS numbreOfProduct FROM inventory_supplierProducts_data WHERE supplierId = '${data.supplierId}';
                                            ${sql_querry_remainAmount}`;
        }
        pool.query(sql_querry_getSupplierCount, (err, data) => {
            if (err) {
                console.error("An error occurd in SQL Queery", err);
                return res.status(500).send('Database Error');
            }
            else {
                const count = {
                    totalBusiness: data[0][0].totalBusiness,
                    totalBusinessOfDebit: data[1][0].totalBusinessOfDebit,
                    totalBusinessOfCash: data[2][0].totalBusinessOfCash,
                    totalPaid: data[3][0].totalPaidtoSupplier,
                    totalProduct: data[4][0].numbreOfProduct,
                    remainingAmount: data[5][0].remainingAmountOfSupplier
                }
                return res.status(200).send(count);
            }
        })
    } catch (error) {
        console.error('An error occurd', error);
        res.status(500).json('Internal Server Error');
    }
}

// Get Product Details By Supplier Id

const getOwnerProductDetailsBySupplierId = async (req, res) => {
    try {
        var date = new Date(), y = date.getFullYear(), m = (date.getMonth());
        var firstDay = new Date(y, m, 1).toString().slice(4, 15);
        var lastDay = new Date(y, m + 1, 0).toString().slice(4, 15);

        const data = {
            startDate: (req.query.startDate ? req.query.startDate : '').slice(4, 15),
            endDate: (req.query.endDate ? req.query.endDate : '').slice(4, 15),
            supplierId: req.query.supplierId
        }
        if (req.query.startDate && req.query.endDate) {
            sql_querry_getProductBysupplier = `SELECT sp.productId, UPPER(pd.productName) AS productName, COALESCE(si.total_quantity, 0) AS remainingStock , pd.unit AS productUnit 
                                            FROM inventory_supplierProducts_data AS sp
                                                INNER JOIN
                                                    (
                                                        SELECT 
                                                                inventory_product_data.productId,
                                                                inventory_product_data.productName, 
                                                                inventory_product_data.minProductUnit AS unit
                                                        FROM inventory_product_data
                                                    )AS pd On sp.productId = pd.productId
                                                LEFT JOIN
                                                    (
                                                        SELECT
                                                            inventory_stockIn_data.productId,
                                                            ROUND(SUM(inventory_stockIn_data.productQty),2) AS total_quantity
                                                        FROM
                                                            inventory_stockIn_data
                                                        WHERE inventory_stockIn_data.supplierId = '${data.supplierId}' AND inventory_stockIn_data.stockInDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')
                                                        GROUP BY
                                                            inventory_stockIn_data.productId
                                                    ) AS si ON sp.productId = si.productId
                                            WHERE sp.supplierId = '${data.supplierId}'
                                            ORDER BY remainingStock DESC
                                            LIMIT 6`;
        } else {
            sql_querry_getProductBysupplier = `SELECT sp.productId, pd.productName, COALESCE(si.total_quantity, 0) AS remainingStock , pd.unit AS productUnit 
                                            FROM inventory_supplierProducts_data AS sp
                                                INNER JOIN
                                                    (
                                                        SELECT 
                                                                inventory_product_data.productId,
                                                                inventory_product_data.productName, 
                                                                inventory_product_data.minProductUnit AS unit
                                                        FROM inventory_product_data
                                                    )AS pd On sp.productId = pd.productId
                                                LEFT JOIN
                                                    (
                                                        SELECT
                                                            inventory_stockIn_data.productId,
                                                            ROUND(SUM(inventory_stockIn_data.productQty),2) AS total_quantity
                                                        FROM
                                                            inventory_stockIn_data
                                                        WHERE inventory_stockIn_data.supplierId = '${data.supplierId}' AND inventory_stockIn_data.stockInDate BETWEEN STR_TO_DATE('${firstDay}','%b %d %Y') AND STR_TO_DATE('${lastDay}','%b %d %Y')
                                                        GROUP BY
                                                            inventory_stockIn_data.productId
                                                    ) AS si ON sp.productId = si.productId
                                            WHERE sp.supplierId = '${data.supplierId}'
                                            ORDER BY remainingStock DESC
                                            LIMIT 6`;
        }
        pool.query(sql_querry_getProductBysupplier, (err, data) => {
            if (err) {
                console.error("An error occurd in SQL Queery", err);
                return res.status(500).send('Database Error');
            }
            const datas = Object.values(JSON.parse(JSON.stringify(data)));
            processDatas(datas)
                .then((data) => {
                    const rows = datas ? datas.map((element, index) => data[index] && data[index].convertedQuantity ? { ...element, remainingStock: data[index].convertedQuantity } : { ...element, remainingStock: element.remainingStock + ' ' + element.minProductUnit },
                        // console.log(data[index] && data[index].convertedQuantity)
                    ) : []
                    return res.status(200).send(rows);
                }).catch(error => {
                    console.error('Error in processing datas:', error);
                    return res.status(500).send('Internal Error');
                });
        })
    } catch (error) {
        console.error('An error occurd', error);
        res.status(500).json('Internal Server Error');
    }
}

// Get All Product Details By Supplier Id

const getOwnerAllProductDetailsBySupplierId = async (req, res) => {
    try {
        var date = new Date(), y = date.getFullYear(), m = (date.getMonth());
        var firstDay = new Date(y, m, 1).toString().slice(4, 15);
        var lastDay = new Date(y, m + 1, 0).toString().slice(4, 15);
        const page = req.query.page;
        const numPerPage = req.query.numPerPage;
        const skip = (page - 1) * numPerPage;
        const limit = skip + ',' + numPerPage;

        const data = {
            startDate: (req.query.startDate ? req.query.startDate : '').slice(4, 15),
            endDate: (req.query.endDate ? req.query.endDate : '').slice(4, 15),
            supplierId: req.query.supplierId
        }

        sql_querry_getAllProductBysupplierPagination = `SELECT COUNT(productId) AS numRows FROM inventory_supplierProducts_data WHERE supplierId = '${data.supplierId}'`;
        pool.query(sql_querry_getAllProductBysupplierPagination, (err, rows, fields) => {
            if (err) {
                console.error("An error occurd in SQL Queery", err);
                return res.status(500).send('Database Error');
            } else {
                const numRows = rows[0].numRows;
                const numPages = Math.ceil(numRows / numPerPage);
                const commaonQuery = `SELECT
                                        sp.productId,
                                            pd.productName,
                                            COALESCE(si.total_quantity, 0) AS productQuantity,
                                            COALESCE(si.total_expense, 0) AS totalExpense,
                                            COALESCE(siLu.productQty, 0) AS lastStockIN,
                                            COALESCE(siLu.productPrice, 0) AS lastUpdatedPrice,
                                            COALESCE(DATE_FORMAT(siLu.stockInDate,'%d-%m-%Y'), 'No Update') AS lastStockdInAt,
                                            pd.unit AS productUnit
                                        FROM
                                            inventory_supplierProducts_data AS sp
                                        INNER JOIN(
                                            SELECT
                                                inventory_product_data.productId,
                                            inventory_product_data.productName,
                                            inventory_product_data.minProductUnit AS unit
                                            FROM
                                                inventory_product_data
                                        ) AS pd
                                        ON
                                        sp.productId = pd.productId
                                        LEFT JOIN(
                                            SELECT
                                                productId,
                                                stockInDate,
                                                productQty,
                                                productPrice
                                            FROM
                                                inventory_stockIn_data
                                            WHERE
                                                (productId, stockInCreationDate) IN(
                                                    SELECT
                                                    productId,
                                                    MAX(stockInCreationDate)
                                                FROM
                                                    inventory_stockIn_data
                                                WHERE
                                                    inventory_stockIn_data.supplierId = '${data.supplierId}'
                                                GROUP BY
                                                    productId
                                                )
                                        ) AS siLu
                                        ON
                                        sp.productId = siLu.productId`;
                if (req.query.startDate && req.query.endDate) {
                    sql_querry_getAllProductBysupplier = `${commaonQuery}
                                                                LEFT JOIN(
                                                                    SELECT
                                                                        inventory_stockIn_data.productId,
                                                                    ROUND(SUM(
                                                                        inventory_stockIn_data.productQty
                                                                    ),2) AS total_quantity,
                                                                    ROUND(SUM(
                                                                        inventory_stockIn_data.totalPrice
                                                                    )) AS total_expense
                                                                    FROM
                                                                        inventory_stockIn_data
                                                                    WHERE
                                                                        inventory_stockIn_data.supplierId = '${data.supplierId}' AND inventory_stockIn_data.stockInDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')
                                                                    GROUP BY
                                                                        inventory_stockIn_data.productId
                                                                ) AS si
                                                                ON
                                                                sp.productId = si.productId
                                                                WHERE sp.supplierId = '${data.supplierId}'
                                                                ORDER BY pd.productName 
                                                                LIMIT ${limit}`;
                } else {
                    sql_querry_getAllProductBysupplier = `${commaonQuery}
                                                                LEFT JOIN(
                                                                    SELECT
                                                                        inventory_stockIn_data.productId,
                                                                    ROUND(SUM(
                                                                        inventory_stockIn_data.productQty
                                                                    ),2) AS total_quantity,
                                                                    ROUND(SUM(
                                                                        inventory_stockIn_data.totalPrice
                                                                    )) AS total_expense
                                                                    FROM
                                                                        inventory_stockIn_data
                                                                    WHERE
                                                                        inventory_stockIn_data.supplierId = '${data.supplierId}' AND inventory_stockIn_data.stockInDate BETWEEN STR_TO_DATE('${firstDay}','%b %d %Y') AND STR_TO_DATE('${lastDay}','%b %d %Y')
                                                                    GROUP BY
                                                                        inventory_stockIn_data.productId
                                                                ) AS si
                                                                ON
                                                                sp.productId = si.productId
                                                                WHERE sp.supplierId = '${data.supplierId}'
                                                                ORDER BY pd.productName
                                                                LIMIT ${limit}`;
                }
                console.log("fvikalpksamnfkn", sql_querry_getAllProductBysupplier);
                pool.query(sql_querry_getAllProductBysupplier, (err, rows, fields) => {
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
                            const datas = Object.values(JSON.parse(JSON.stringify(rows)));
                            processDatas(datas)
                                .then((data) => {
                                    const rows = datas ? datas.map((element, index) => data[index] && data[index].convertedQuantity ? { ...element, remainingStock: data[index].convertedQuantity } : { ...element, remainingStock: element.remainingStock + ' ' + element.minProductUnit },
                                        // console.log(data[index] && data[index].convertedQuantity)
                                    ) : []
                                    return res.status(200).send({ rows, numRows });
                                }).catch(error => {
                                    console.error('Error in processing datas:', error);
                                    return res.status(500).send('Internal Error');
                                });
                        }
                    }
                })
            }
        })
    } catch (error) {
        console.error('An error occurd', error);
        res.status(500).json('Internal Server Error');
    }
}

// Get Owner For StockIn List

const getOwnerStockInList = async (req, res) => {
    try {
        const page = req.query.page;
        const numPerPage = req.query.numPerPage;
        const skip = (page - 1) * numPerPage;
        const limit = skip + ',' + numPerPage;
        const data = {
            startDate: (req.query.startDate ? req.query.startDate : '').slice(4, 15),
            endDate: (req.query.endDate ? req.query.endDate : '').slice(4, 15),
            productId: req.query.productId,
            supplierId: req.query.supplierId,
            payType: req.query.payType
        }
        if (req.query.supplierId && req.query.payType && req.query.startDate && req.query.endDate) {
            sql_querry_getCountdetails = `SELECT count(*) as numRows FROM inventory_stockIn_data WHERE inventory_stockIn_data.supplierId = '${data.supplierId}' AND inventory_stockIn_data.stockInPaymentMethod = '${data.payType}' AND inventory_stockIn_data.stockInDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')`;
        } else if (req.query.supplierId && req.query.startDate && req.query.endDate) {
            sql_querry_getCountdetails = `SELECT count(*) as numRows FROM inventory_stockIn_data WHERE inventory_stockIn_data.supplierId = '${data.supplierId}' AND inventory_stockIn_data.stockInDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')`;
        } else if (req.query.productId && req.query.startDate && req.query.endDate) {
            sql_querry_getCountdetails = `SELECT count(*) as numRows FROM inventory_stockIn_data WHERE inventory_stockIn_data.productId = '${data.productId}' AND inventory_stockIn_data.stockInDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')`;
        } else if (req.query.startDate && req.query.endDate) {
            sql_querry_getCountdetails = `SELECT count(*) as numRows FROM inventory_stockIn_data WHERE inventory_stockIn_data.stockInDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')`;
        } else if (req.query.supplierId && req.query.payType) {
            sql_querry_getCountdetails = `SELECT count(*) as numRows FROM inventory_stockIn_data WHERE inventory_stockIn_data.supplierId = '${data.supplierId}' AND inventory_stockIn_data.stockInPaymentMethod = '${data.payType}'`;
        } else if (req.query.productId) {
            sql_querry_getCountdetails = `SELECT count(*) as numRows FROM inventory_stockIn_data WHERE inventory_stockIn_data.productId = '${data.productId}'`;
        } else if (req.query.supplierId) {
            sql_querry_getCountdetails = `SELECT count(*) as numRows FROM inventory_stockIn_data WHERE inventory_stockIn_data.supplierId = '${data.supplierId}'`;
        } else {
            sql_querry_getCountdetails = `SELECT count(*) as numRows FROM inventory_stockIn_data`;
        }
        pool.query(sql_querry_getCountdetails, (err, rows, fields) => {
            if (err) {
                console.error("An error occurd in SQL Queery", err);
                return res.status(500).send('Database Error');
            } else {
                const numRows = rows[0].numRows;
                const numPages = Math.ceil(numRows / numPerPage);
                const commanQuarry = `SELECT
                                          stockInId,
                                          user_details.userName AS enteredBy,
                                          CONCAT(
                                              user_details.userFirstName,
                                              ' ',
                                              user_details.userLastName
                                          ) AS userName,
                                          UPPER(inventory_product_data.productName) AS productName,
                                          CONCAT(stockInDisplayQty,' ',stockInDisplayUnit) AS Quantity,
                                          productPrice,
                                          totalPrice,
                                          billNumber,
                                          inventory_supplier_data.supplierNickName AS supplier,
                                          stockInPaymentMethod,
                                          stockInComment,
                                          productQty,
                                          remainingQty,
                                          branch_data.branchName,
                                          CONCAT(DATE_FORMAT(stockInDate, '%d-%m-%Y'),' ',DATE_FORMAT(stockInCreationDate, '%h:%i %p')) AS stockInDate
                                      FROM
                                          inventory_stockIn_data
                                      INNER JOIN user_details ON user_details.userId = inventory_stockIn_data.userId
                                      INNER JOIN inventory_product_data ON inventory_product_data.productId = inventory_stockIn_data.productId
                                      INNER JOIN branch_data ON branch_data.branchId = inventory_stockIn_data.branchId
                                      INNER JOIN inventory_supplier_data ON inventory_supplier_data.supplierId = inventory_stockIn_data.supplierId`;
                if (req.query.supplierId && req.query.payType && req.query.startDate && req.query.endDate) {
                    sql_queries_getdetails = `${commanQuarry}
                                                WHERE inventory_stockIn_data.supplierId = '${data.supplierId}' AND inventory_stockIn_data.stockInPaymentMethod = '${data.payType}' AND inventory_stockIn_data.stockInDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')
                                                ORDER BY inventory_stockIn_data.stockInDate DESC, inventory_stockIn_data.stockInCreationDate DESC`;
                } else if (req.query.supplierId && req.query.startDate && req.query.endDate) {
                    sql_queries_getdetails = `${commanQuarry}
                                                WHERE inventory_stockIn_data.supplierId = '${data.supplierId}' AND inventory_stockIn_data.stockInDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')
                                                ORDER BY inventory_stockIn_data.stockInDate DESC, inventory_stockIn_data.stockInCreationDate DESC LIMIT ${limit}`;
                } else if (req.query.productId && req.query.startDate && req.query.endDate) {
                    sql_queries_getdetails = `${commanQuarry}
                                                WHERE inventory_stockIn_data.productId = '${data.productId}' AND inventory_stockIn_data.stockInDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')
                                                ORDER BY inventory_stockIn_data.stockInDate DESC, inventory_stockIn_data.stockInCreationDate DESC LIMIT ${limit}`;
                } else if (req.query.startDate && req.query.endDate) {
                    sql_queries_getdetails = `${commanQuarry}
                                                WHERE inventory_stockIn_data.stockInDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y') 
                                                ORDER BY inventory_stockIn_data.stockInDate DESC, inventory_stockIn_data.stockInCreationDate DESC LIMIT ${limit}`;
                } else if (req.query.supplierId && req.query.payType) {
                    sql_queries_getdetails = `${commanQuarry}
                                                WHERE inventory_stockIn_data.supplierId = '${data.supplierId}' AND inventory_stockIn_data.stockInPaymentMethod = '${data.payType}'
                                                ORDER BY inventory_stockIn_data.stockInDate DESC, inventory_stockIn_data.stockInCreationDate DESC LIMIT ${limit}`;
                } else if (req.query.productId) {
                    sql_queries_getdetails = `${commanQuarry}
                                                WHERE inventory_stockIn_data.productId = '${data.productId}'
                                                ORDER BY inventory_stockIn_data.stockInDate DESC, inventory_stockIn_data.stockInCreationDate DESC LIMIT ${limit}`;
                } else if (req.query.supplierId) {
                    sql_queries_getdetails = `${commanQuarry}
                                                WHERE inventory_stockIn_data.supplierId = '${data.supplierId}'
                                                ORDER BY inventory_stockIn_data.stockInDate DESC, inventory_stockIn_data.stockInCreationDate DESC LIMIT ${limit}`;
                } else {
                    sql_queries_getdetails = `${commanQuarry}
                                                ORDER BY inventory_stockIn_data.stockInDate DESC, inventory_stockIn_data.stockInCreationDate DESC LIMIT ${limit}`;
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
    } catch (error) {
        console.error('An error occurd', error);
        res.status(500).json('Internal Server Error');
    }
}

// Export Owner All Product By Supplier Id

const exportExcelSheetForOwnerAllProductBySupplierId = (req, res) => {
    var date = new Date(), y = date.getFullYear(), m = (date.getMonth());
    var firstDay = new Date(y, m, 1).toString().slice(4, 15);
    var lastDay = new Date(y, m + 1, 0).toString().slice(4, 15);

    const data = {
        startDate: (req.query.startDate ? req.query.startDate : '').slice(4, 15),
        endDate: (req.query.endDate ? req.query.endDate : '').slice(4, 15),
        supplierId: req.query.supplierId,
    }
    const commaonQuery = `SELECT
                                        sp.productId,
                                        pd.productName,
                                        COALESCE(si.total_quantity, 0) AS remainingStock,
                                        COALESCE(si.total_expense, 0) AS totalExpense,
                                        COALESCE(siLu.productQty, 0) AS lastStockIN,
                                        COALESCE(siLu.productPrice, 0) AS lastUpdatedPrice,
                                        COALESCE(DATE_FORMAT(siLu.stockInDate,'%d-%m-%Y'), 'No Update') AS lastStockdInAt,
                                        pd.unit AS minProductUnit
                                    FROM
                                        inventory_supplierProducts_data AS sp
                                    INNER JOIN(
                                        SELECT
                                            inventory_product_data.productId,
                                        inventory_product_data.productName,
                                        inventory_product_data.minProductUnit AS unit
                                        FROM
                                            inventory_product_data
                                    ) AS pd
                                    ON
                                    sp.productId = pd.productId
                                    LEFT JOIN(
                                        SELECT
                                            productId,
                                            stockInDate,
                                            productQty,
                                            productPrice
                                        FROM
                                            inventory_stockIn_data
                                        WHERE
                                            (productId, stockInCreationDate) IN(
                                                SELECT
                                                productId,
                                                MAX(stockInCreationDate)
                                            FROM
                                                inventory_stockIn_data
                                            WHERE
                                                inventory_stockIn_data.supplierId = '${data.supplierId}'
                                            GROUP BY
                                                productId
                                            )
                                    ) AS siLu
                                    ON
                                    sp.productId = siLu.productId`;
    if (req.query.startDate && req.query.endDate) {
        sql_querry_getAllProductBysupplier = `${commaonQuery}
                                                        LEFT JOIN(
                                                            SELECT
                                                                inventory_stockIn_data.productId,
                                                            ROUND(SUM(
                                                                inventory_stockIn_data.productQty
                                                            ),2) AS total_quantity,
                                                            ROUND(SUM(
                                                                inventory_stockIn_data.totalPrice
                                                            )) AS total_expense
                                                            FROM
                                                                inventory_stockIn_data
                                                            WHERE
                                                                inventory_stockIn_data.supplierId = '${data.supplierId}' AND inventory_stockIn_data.stockInDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')
                                                            GROUP BY
                                                                inventory_stockIn_data.productId
                                                        ) AS si
                                                        ON
                                                        sp.productId = si.productId
                                                        WHERE sp.supplierId = '${data.supplierId}'
                                                        ORDER BY pd.productName`;
    } else {
        sql_querry_getAllProductBysupplier = `${commaonQuery}
                                                        LEFT JOIN(
                                                              SELECT
                                                                  inventory_stockIn_data.productId,
                                                              ROUND(SUM(
                                                                  inventory_stockIn_data.productQty
                                                              ),2) AS total_quantity,
                                                              ROUND(SUM(
                                                                  inventory_stockIn_data.totalPrice
                                                              )) AS total_expense
                                                              FROM
                                                                  inventory_stockIn_data
                                                              WHERE
                                                                  inventory_stockIn_data.supplierId = '${data.supplierId}' AND inventory_stockIn_data.stockInDate BETWEEN STR_TO_DATE('${firstDay}','%b %d %Y') AND STR_TO_DATE('${lastDay}','%b %d %Y')
                                                              GROUP BY
                                                                  inventory_stockIn_data.productId
                                                          ) AS si
                                                        ON
                                                          sp.productId = si.productId
                                                          WHERE sp.supplierId = '${data.supplierId}'
                                                          ORDER BY pd.productName`;
    }
    pool.query(sql_querry_getAllProductBysupplier, async (err, rows) => {
        if (err) return res.status(404).send(err);
        const datas = Object.values(JSON.parse(JSON.stringify(rows)));
        await processDatas(datas)
            .then(async (data) => {
                const rows = datas ? datas.map((element, index) => data[index] && data[index].convertedQuantity ? { ...element, remainingStock: data[index].convertedQuantity } : { ...element, remainingStock: element.remainingStock + ' ' + element.minProductUnit },
                ) : []
                const workbook = new excelJS.Workbook();  // Create a new workbook
                const worksheet = workbook.addWorksheet("StockIn List"); // New Worksheet

                if (req.query.startDate && req.query.endDate) {
                    worksheet.mergeCells('A1', 'G1');
                    worksheet.getCell('A1').value = `Supplier Wise Product List : ${data.startDate} To ${data.endDate}`;
                } else {
                    worksheet.mergeCells('A1', 'G1');
                    worksheet.getCell('A1').value = `Supplier Wise Product List : ${firstDay} To ${lastDay}`;
                }

                /*Column headers*/
                worksheet.getRow(2).values = ['S no.', 'Product Name', 'Quantity', 'Total Expense', 'Last StockIn', 'Last Price', 'LastIn Date'];

                // Column for data in excel. key must match data key
                worksheet.columns = [
                    { key: "s_no", width: 10, },
                    { key: "productName", width: 30 },
                    { key: "remainingStock", width: 40 },
                    { key: "totalExpense", width: 30 },
                    { key: "lastStockIN", width: 20 },
                    { key: "lastUpdatedPrice", width: 20 },
                    { key: "lastStockedInAt", width: 20 },
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
            }).catch(error => {
                console.error('Error in processing datas:', error);
                return res.status(500).send('Internal Error');
            });
    })
};

// Export Excel for StockIn

const exportExcelSheetForOwnerStockIn = (req, res) => {
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
            productId: req.query.productId,
            supplierId: req.query.supplierId,
            payType: req.query.payType
        }
        const commanQuarry = `SELECT
                                stockInId,
                                user_details.userName AS enteredBy,
                                CONCAT(
                                    user_details.userFirstName,
                                    ' ',
                                    user_details.userLastName
                                ) AS userName,
                                UPPER(inventory_product_data.productName) AS productName,
                                stockInDisplayQty AS productQty, 
                                stockInDisplayUnit AS productUnit,
                                productPrice,
                                totalPrice,
                                billNumber,
                                inventory_supplier_data.supplierNickName AS supplier,
                                stockInPaymentMethod,
                                stockInComment,
                                productQty,
                                remainingQty,
                                branch_data.branchName,
                                CONCAT(DATE_FORMAT(stockInDate, '%d-%m-%Y'),' ',DATE_FORMAT(stockInCreationDate, '%h:%i %p')) AS stockInDate
                            FROM
                                inventory_stockIn_data
                                INNER JOIN user_details ON user_details.userId = inventory_stockIn_data.userId
                                INNER JOIN inventory_product_data ON inventory_product_data.productId = inventory_stockIn_data.productId
                                INNER JOIN branch_data ON branch_data.branchId = inventory_stockIn_data.branchId
                                INNER JOIN inventory_supplier_data ON inventory_supplier_data.supplierId = inventory_stockIn_data.supplierId`;
        if (req.query.supplierId && req.query.payType && req.query.startDate && req.query.endDate) {
            sql_queries_getdetails = `${commanQuarry}
                                        WHERE inventory_stockIn_data.supplierId = '${data.supplierId}' AND inventory_stockIn_data.stockInPaymentMethod = '${data.payType}' AND inventory_stockIn_data.stockInDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')
                                        ORDER BY inventory_stockIn_data.stockInDate DESC, inventory_stockIn_data.stockInCreationDate DESC`;
        } else if (req.query.supplierId && req.query.startDate && req.query.endDate) {
            sql_queries_getdetails = `${commanQuarry}
                                        WHERE inventory_stockIn_data.supplierId = '${data.supplierId}' AND inventory_stockIn_data.stockInDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')
                                        ORDER BY inventory_stockIn_data.stockInDate DESC, inventory_stockIn_data.stockInCreationDate DESC`;
        } else if (req.query.productId && req.query.startDate && req.query.endDate) {
            sql_queries_getdetails = `${commanQuarry}
                                        WHERE inventory_stockIn_data.productId = '${data.productId}' AND inventory_stockIn_data.stockInDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')
                                        ORDER BY inventory_stockIn_data.stockInDate DESC, inventory_stockIn_data.stockInCreationDate DESC`;
        } else if (req.query.startDate && req.query.endDate) {
            sql_queries_getdetails = `${commanQuarry}
                                        WHERE inventory_stockIn_data.stockInDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y') 
                                        ORDER BY inventory_stockIn_data.stockInDate DESC, inventory_stockIn_data.stockInCreationDate DESC`;
        } else if (req.query.supplierId && req.query.payType) {
            sql_queries_getdetails = `${commanQuarry}
                                        WHERE inventory_stockIn_data.supplierId = '${data.supplierId}' AND inventory_stockIn_data.stockInPaymentMethod = '${data.payType}'
                                        ORDER BY inventory_stockIn_data.stockInDate DESC, inventory_stockIn_data.stockInCreationDate DESC`;
        } else if (req.query.productId) {
            sql_queries_getdetails = `${commanQuarry}
                                        WHERE inventory_stockIn_data.productId = '${data.productId}'
                                        ORDER BY inventory_stockIn_data.stockInDate DESC, inventory_stockIn_data.stockInCreationDate DESC`;
        } else if (req.query.supplierId) {
            sql_queries_getdetails = `${commanQuarry}
                                        WHERE inventory_stockIn_data.supplierId = '${data.supplierId}'
                                        ORDER BY inventory_stockIn_data.stockInDate DESC, inventory_stockIn_data.stockInCreationDate DESC`;
        } else {
            sql_queries_getdetails = `${commanQuarry}
                                        ORDER BY inventory_stockIn_data.stockInDate DESC, inventory_stockIn_data.stockInCreationDate DESC`;
        }
        console.log('find me', sql_queries_getdetails)
        pool.query(sql_queries_getdetails, async (err, rows) => {
            if (err) return res.status(404).send(err);
            console.log(":::", rows)
            const workbook = new excelJS.Workbook();  // Create a new workbook
            const worksheet = workbook.addWorksheet("StockIn List"); // New Worksheet

            if (req.query.startDate && req.query.endDate) {
                worksheet.mergeCells('A1', 'M1');
                worksheet.getCell('A1').value = `Stock In From ${data.startDate} To ${data.endDate}`;
            } else {
                worksheet.mergeCells('A1', 'M1');
                worksheet.getCell('A1').value = `Stock In From ${firstDay} To ${lastDay}`;
            }

            /*Column headers*/
            worksheet.getRow(2).values = ['S no.', 'Entered By', 'Product', 'Quantity', 'Unit', 'Price', 'Total', 'Bill Number', 'Supplier', 'Pay Type', 'Branch', 'Comment', 'Date'];

            // Column for data in excel. key must match data key
            worksheet.columns = [
                { key: "s_no", width: 10, },
                { key: "enteredBy", width: 20 },
                { key: "productName", width: 30 },
                { key: "productQty", width: 10 },
                { key: "productUnit", width: 10 },
                { key: "productPrice", width: 10 },
                { key: "totalPrice", width: 10 },
                { key: "billNumber", width: 30 },
                { key: "supplier", width: 20 },
                { key: "stockInPaymentMethod", width: 10 },
                { key: "branchName", width: 20 },
                { key: "stockInComment", width: 30 },
                { key: "stockInDate", width: 10 }
            ];
            //Looping through User data
            const arr = rows
            console.log(">>>", arr);
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
            if (req.query.productId || req.query.productId && req.query.startDate && req.query.endDate) {
                worksheet.getRow(arr.length + 3).values = ['Total:', '', '', { formula: `SUM(D3:D${arr.length + 2})` }, '', '', { formula: `SUM(G3:G${arr.length + 2})` }];
            } else {
                worksheet.getRow(arr.length + 3).values = ['Total:', '', '', '', '', '', { formula: `SUM(G3:G${arr.length + 2})` }];
            }
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
        return res.status(401).send("Please Login Firest.....!");
    }
};

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

const exportPdfForOwnerAllProductBySupplierId = (req, res) => {
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
                supplierId: req.query.supplierId,
            }
            const commaonQuery = `SELECT
                                pd.productName AS product,
                                COALESCE(si.total_quantity, 0) AS remainingStock,
                                COALESCE(si.total_expense, 0) AS totalExpense,
                                COALESCE(siLu.productQty, 0) AS lastStockIN,
                                COALESCE(siLu.productPrice, 0) AS lastUpdatedPrice,
                                COALESCE(DATE_FORMAT(siLu.stockInDate,'%d-%m-%Y'), 'No Update') AS lastStockdInAt,
                                pd.unit AS minProductUnit
                            FROM
                                inventory_supplierProducts_data AS sp
                            INNER JOIN(
                                SELECT
                                    inventory_product_data.productId,
                                inventory_product_data.productName,
                                inventory_product_data.minProductUnit AS unit
                                FROM
                                    inventory_product_data
                            ) AS pd
                            ON
                            sp.productId = pd.productId
                            LEFT JOIN(
                                SELECT
                                    productId,
                                    stockInDate,
                                    productQty,
                                    productPrice
                                FROM
                                    inventory_stockIn_data
                                WHERE
                                    (productId, stockInCreationDate) IN(
                                        SELECT
                                        productId,
                                        MAX(stockInCreationDate)
                                    FROM
                                        inventory_stockIn_data
                                    WHERE
                                        inventory_stockIn_data.supplierId = '${data.supplierId}'
                                    GROUP BY
                                        productId
                                    )
                            ) AS siLu
                            ON
                            sp.productId = siLu.productId`;
            if (req.query.startDate && req.query.endDate) {
                sql_querry_getAllProductBysupplier = `${commaonQuery}
                                                        LEFT JOIN(
                                                            SELECT
                                                                inventory_stockIn_data.productId,
                                                            ROUND(SUM(
                                                                inventory_stockIn_data.productQty
                                                            ),2) AS total_quantity,
                                                            ROUND(SUM(
                                                                inventory_stockIn_data.totalPrice
                                                            )) AS total_expense
                                                            FROM
                                                                inventory_stockIn_data
                                                            WHERE
                                                                inventory_stockIn_data.supplierId = '${data.supplierId}' AND inventory_stockIn_data.stockInDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')
                                                            GROUP BY
                                                                inventory_stockIn_data.productId
                                                        ) AS si
                                                        ON
                                                        sp.productId = si.productId
                                                        WHERE sp.supplierId = '${data.supplierId}'
                                                        ORDER BY pd.productName`;
            } else {
                sql_querry_getAllProductBysupplier = `${commaonQuery}
                                                        LEFT JOIN(
                                                              SELECT
                                                                  inventory_stockIn_data.productId,
                                                              ROUND(SUM(
                                                                  inventory_stockIn_data.productQty
                                                              ),2) AS total_quantity,
                                                              ROUND(SUM(
                                                                  inventory_stockIn_data.totalPrice
                                                              )) AS total_expense
                                                              FROM
                                                                  inventory_stockIn_data
                                                              WHERE
                                                                inventory_stockIn_data.supplierId = '${data.supplierId}' AND inventory_stockIn_data.stockInDate BETWEEN STR_TO_DATE('${firstDay}','%b %d %Y') AND STR_TO_DATE('${lastDay}','%b %d %Y')
                                                              GROUP BY
                                                                  inventory_stockIn_data.productId
                                                          ) AS si
                                                        ON
                                                          sp.productId = si.productId
                                                          WHERE sp.supplierId = '${data.supplierId}'
                                                          ORDER BY pd.productName`;
            }
            pool.query(sql_querry_getAllProductBysupplier, async (err, rows) => {
                if (err) {
                    console.error("An error occurd in SQL Queery", err);
                    return res.status(500).send('Database Error');
                } else if (rows && rows.length <= 0) {
                    return res.status(400).send('No Data Found');
                } else {
                    const datas = Object.values(JSON.parse(JSON.stringify(rows)));
                    await processDatas(datas)
                        .then(async (data) => {
                            const rows = datas ? datas.map((element, index) => data[index] && data[index].convertedQuantity ? { ...element, remainingStock: data[index].convertedQuantity } : { ...element, remainingStock: element.remainingStock + ' ' + element.minProductUnit },
                            ) : []
                            const abc = rows.map(e => {
                                return {
                                    "Product Name": e.product,
                                    "Remain Stock": e.remainingStock,
                                    "Expense": e.totalExpense,
                                    "Last In": e.lastStockIN,
                                    "Last Price": e.lastUpdatedPrice,
                                    "Last In Date": e.lastStockdInAt,
                                };
                            });
                            const sumPayAmount = abc.reduce((total, item) => total + (item['Expense'] || 0), 0);;
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
                        }).catch(error => {
                            console.error('Error in processing datas:', error);
                            return res.status(500).send('Internal Error');
                        });
                }
            });
        } else {
            return res.status(401).send('Pleasr Login Firest.....!');
        }
    } catch (error) {
        console.error('An error occurd', error);
        res.status(500).send('Internal Server Error');
    }
}

// Export PDF For StockIn

const exportPdfForOwnerStockIn = (req, res) => {
    try {
        let token;
        token = req.headers.authorization ? req.headers.authorization.split(" ")[1] : null;
        if (token) {
            const data = {
                startDate: (req.query.startDate ? req.query.startDate : '').slice(4, 15),
                endDate: (req.query.endDate ? req.query.endDate : '').slice(4, 15),
                productId: req.query.productId,
                supplierId: req.query.supplierId,
                payType: req.query.payType
            }
            const commanQuarry = `SELECT
                                    CONCAT(
                                        user_details.userFirstName,
                                        ' ',
                                        user_details.userLastName
                                    ) AS "Enter By",
                                    UPPER(inventory_product_data.productName) AS "Product",
                                    CONCAT(stockInDisplayQty,' ',stockInDisplayUnit) AS "Qty",
                                    ROUND(productPrice,2) AS "Price",
                                    totalPrice AS "Total",
                                    billNumber AS "Bill No.",
                                    inventory_supplier_data.supplierNickName AS "Supplier",
                                    stockInPaymentMethod AS "Pay Type",
                                    stockInComment AS "Comment",
                                    branch_data.branchName AS "Branch",
                                    CONCAT(DATE_FORMAT(stockInDate, '%d-%m-%Y'),' ',DATE_FORMAT(stockInCreationDate, '%h:%i %p')) AS stockInDate
                                  FROM
                                    inventory_stockIn_data
                                    INNER JOIN user_details ON user_details.userId = inventory_stockIn_data.userId
                                    INNER JOIN inventory_product_data ON inventory_product_data.productId = inventory_stockIn_data.productId
                                    INNER JOIN branch_data ON branch_data.branchId = inventory_stockIn_data.branchId
                                    INNER JOIN inventory_supplier_data ON inventory_supplier_data.supplierId = inventory_stockIn_data.supplierId`;
            if (req.query.supplierId && req.query.payType && req.query.startDate && req.query.endDate) {
                sql_queries_getdetails = `${commanQuarry}
                                                WHERE inventory_stockIn_data.supplierId = '${data.supplierId}' AND inventory_stockIn_data.stockInPaymentMethod = '${data.payType}' AND inventory_stockIn_data.stockInDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')
                                                ORDER BY inventory_stockIn_data.stockInDate DESC, inventory_stockIn_data.stockInCreationDate DESC`;
            } else if (req.query.supplierId && req.query.startDate && req.query.endDate) {
                sql_queries_getdetails = `${commanQuarry}
                                                WHERE inventory_stockIn_data.supplierId = '${data.supplierId}' AND inventory_stockIn_data.stockInDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')
                                                ORDER BY inventory_stockIn_data.stockInDate DESC, inventory_stockIn_data.stockInCreationDate DESC`;
            } else if (req.query.productId && req.query.startDate && req.query.endDate) {
                sql_queries_getdetails = `${commanQuarry}
                                                WHERE inventory_stockIn_data.productId = '${data.productId}' AND inventory_stockIn_data.stockInDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')
                                                ORDER BY inventory_stockIn_data.stockInDate DESC, inventory_stockIn_data.stockInCreationDate DESC`;
            } else if (req.query.startDate && req.query.endDate) {
                sql_queries_getdetails = `${commanQuarry}
                                                WHERE inventory_stockIn_data.stockInDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y') 
                                                ORDER BY inventory_stockIn_data.stockInDate DESC, inventory_stockIn_data.stockInCreationDate DESC`;
            } else if (req.query.supplierId && req.query.payType) {
                sql_queries_getdetails = `${commanQuarry}
                                                WHERE inventory_stockIn_data.supplierId = '${data.supplierId}' AND inventory_stockIn_data.stockInPaymentMethod = '${data.payType}'
                                                ORDER BY inventory_stockIn_data.stockInDate DESC, inventory_stockIn_data.stockInCreationDate DESC`;
            } else if (req.query.productId) {
                sql_queries_getdetails = `${commanQuarry}
                                                WHERE inventory_stockIn_data.productId = '${data.productId}'
                                                ORDER BY inventory_stockIn_data.stockInDate DESC, inventory_stockIn_data.stockInCreationDate DESC`;
            } else if (req.query.supplierId) {
                sql_queries_getdetails = `${commanQuarry}
                                                WHERE inventory_stockIn_data.branchId = '${branchId}' AND inventory_stockIn_data.supplierId = '${data.supplierId}'
                                                ORDER BY inventory_stockIn_data.stockInDate DESC, inventory_stockIn_data.stockInCreationDate DESC`;
            } else {
                sql_queries_getdetails = `${commanQuarry}
                                                ORDER BY inventory_stockIn_data.stockInDate DESC, inventory_stockIn_data.stockInCreationDate DESC`;
            }
            pool.query(sql_queries_getdetails, (err, rows) => {
                if (err) {
                    console.error("An error occurd in SQL Queery", err);
                    return res.status(500).send('Database Error');
                } else if (rows && rows.length <= 0) {
                    return res.status(400).send('No Data Found');
                }
                const abc = Object.values(JSON.parse(JSON.stringify(rows)));
                const sumPayAmount = abc.reduce((total, item) => total + (item['Total'] || 0), 0);;
                const sumFooterArray = ['Total', '', '', '', '', parseFloat(sumPayAmount).toLocaleString('en-IN')];
                if (req.query.startDate && req.query.endDate) {
                    tableHeading = `StockIn Data From ${data.startDate} To ${data.endDate}`;
                } else {
                    tableHeading = `All StockIn Data`;
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
        } else {
            return res.status(401).send("Please Login Firest.....!");
        }

    } catch (error) {
        console.error('An error occurd', error);
        res.status(500).send('Internal Server Error');
    }
}

module.exports = {
    getOwnerProductDetailsBySupplierId,
    getOwnerSupplierCounterDetailsById,
    getOwnerAllProductDetailsBySupplierId,
    getOwnerStockInList,
    exportExcelSheetForOwnerAllProductBySupplierId,
    exportPdfForOwnerAllProductBySupplierId,
    exportExcelSheetForOwnerStockIn,
    exportPdfForOwnerStockIn

}

