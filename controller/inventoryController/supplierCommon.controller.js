const pool = require('../../database');
const excelJS = require("exceljs");
const jwt = require("jsonwebtoken");
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
            sql_querry_getProductBysupplier = `SELECT sp.productId, UPPER(pd.productName) AS productName, COALESCE(si.total_quantity, 0) AS productQuantity , pd.unit AS productUnit 
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
                                            ORDER BY productQuantity DESC
                                            LIMIT 6`;
        } else {
            sql_querry_getProductBysupplier = `SELECT sp.productId, pd.productName, COALESCE(si.total_quantity, 0) AS productQuantity , pd.unit AS productUnit 
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
                                            ORDER BY productQuantity DESC
                                            LIMIT 6`;
        }
        pool.query(sql_querry_getProductBysupplier, (err, data) => {
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
                                    console.log('json 1', datas);
                                    console.log('json 2', data);
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
                                          CONCAT(DATE_FORMAT(stockInDate, '%d-%m-%Y'),' ',DATE_FORMAT(stockInCreationDate, '%h:%i %p')) AS stockInDate
                                      FROM
                                          inventory_stockIn_data
                                      INNER JOIN user_details ON user_details.userId = inventory_stockIn_data.userId
                                      INNER JOIN inventory_product_data ON inventory_product_data.productId = inventory_stockIn_data.productId
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

module.exports = {
    getOwnerProductDetailsBySupplierId,
    getOwnerSupplierCounterDetailsById,
    getOwnerAllProductDetailsBySupplierId,
    getOwnerStockInList
}

