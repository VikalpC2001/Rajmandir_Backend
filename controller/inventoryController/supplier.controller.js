const pool = require('../../database');
const excelJS = require("exceljs");
const jwt = require("jsonwebtoken");
const { processDatas } = require("../inventoryController/conversation.controller");

// Get Count List Supplier Wise

const getSupplierCounterDetailsById = (req, res) => {
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
                                                WHERE sd.supplierId = '${data.supplierId}';`;
                if (req.query.startDate && req.query.endDate) {
                    sql_querry_getSupplierCount = `SELECT COALESCE(ROUND(SUM(totalPrice)),0) AS totalBusiness FROM inventory_stockIn_data WHERE inventory_stockIn_data.branchId = '${branchId}' AND supplierId = '${data.supplierId}' AND stockInDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y');
                                                   SELECT COALESCE(ROUND(SUM(totalPrice)),0) AS totalBusinessOfDebit FROM inventory_stockIn_data WHERE inventory_stockIn_data.branchId = '${branchId}' AND supplierId = '${data.supplierId}' AND stockInPaymentMethod = 'debit' AND stockInDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y');
                                                   SELECT COALESCE(ROUND(SUM(totalPrice)),0) AS totalBusinessOfCash FROM inventory_stockIn_data WHERE inventory_stockIn_data.branchId = '${branchId}' AND supplierId = '${data.supplierId}' AND stockInPaymentMethod = 'cash' AND stockInDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y');
                                                   SELECT COALESCE(ROUND(SUM(paidAmount)),0) AS totalPaidtoSupplier FROM inventory_supplierTransaction_data WHERE inventory_supplierTransaction_data.branchId = '${branchId}' AND supplierId = '${data.supplierId}' AND transactionDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y');
                                                   SELECT COUNT(productId) AS numbreOfProduct FROM inventory_supplierProducts_data WHERE supplierId = '${data.supplierId}';
                                                   ${sql_querry_remainAmount}`;
                } else {
                    sql_querry_getSupplierCount = `SELECT COALESCE(ROUND(SUM(totalPrice)),0) AS totalBusiness FROM inventory_stockIn_data WHERE inventory_stockIn_data.branchId = '${branchId}' AND supplierId = '${data.supplierId}' AND stockInDate BETWEEN STR_TO_DATE('${firstDay}','%b %d %Y') AND STR_TO_DATE('${lastDay}','%b %d %Y');
                                                   SELECT COALESCE(ROUND(SUM(totalPrice)),0) AS totalBusinessOfDebit FROM inventory_stockIn_data WHERE inventory_stockIn_data.branchId = '${branchId}' AND supplierId = '${data.supplierId}' AND stockInPaymentMethod = 'debit' AND stockInDate BETWEEN STR_TO_DATE('${firstDay}','%b %d %Y') AND STR_TO_DATE('${lastDay}','%b %d %Y');
                                                   SELECT COALESCE(ROUND(SUM(totalPrice)),0) AS totalBusinessOfCash FROM inventory_stockIn_data WHERE inventory_stockIn_data.branchId = '${branchId}' AND supplierId = '${data.supplierId}' AND stockInPaymentMethod = 'cash' AND stockInDate BETWEEN STR_TO_DATE('${firstDay}','%b %d %Y') AND STR_TO_DATE('${lastDay}','%b %d %Y');
                                                   SELECT COALESCE(ROUND(SUM(paidAmount)),0) AS totalPaidtoSupplier FROM inventory_supplierTransaction_data WHERE inventory_supplierTransaction_data.branchId = '${branchId}' AND supplierId = '${data.supplierId}' AND transactionDate BETWEEN STR_TO_DATE('${firstDay}','%b %d %Y') AND STR_TO_DATE('${lastDay}','%b %d %Y');
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

// Get Product Details By Supplier Id

const getProductDetailsBySupplierId = async (req, res) => {
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

                const data = {
                    startDate: (req.query.startDate ? req.query.startDate : '').slice(4, 15),
                    endDate: (req.query.endDate ? req.query.endDate : '').slice(4, 15),
                    supplierId: req.query.supplierId
                }
                if (req.query.startDate && req.query.endDate) {
                    sql_querry_getProductBysupplier = `SELECT sp.productId, UPPER(pd.productName) AS productName, COALESCE(si.total_quantity, 0) AS remainingStock, COALESCE(si.total_price, 0) AS productPrice, pd.unit AS minProductUnit 
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
                                                                       ROUND(SUM(inventory_stockIn_data.productQty),2) AS total_quantity,
                                                                       ROUND(SUM(inventory_stockIn_data.totalPrice),2) AS total_price
                                                                   FROM
                                                                       inventory_stockIn_data
                                                                   WHERE inventory_stockIn_data.branchId = '${branchId}' AND inventory_stockIn_data.supplierId = '${data.supplierId}' AND inventory_stockIn_data.stockInDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')
                                                                   GROUP BY
                                                                       inventory_stockIn_data.productId
                                                               ) AS si ON sp.productId = si.productId
                                                       WHERE sp.supplierId = '${data.supplierId}'
                                                       ORDER BY remainingStock DESC
                                                       LIMIT 6`;
                } else {
                    sql_querry_getProductBysupplier = `SELECT sp.productId, pd.productName, COALESCE(si.total_quantity, 0) AS remainingStock, COALESCE(si.total_price, 0) AS productPrice, pd.unit AS minProductUnit 
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
                                                                   ROUND(SUM(inventory_stockIn_data.productQty),2) AS total_quantity,
                                                                   ROUND(SUM(inventory_stockIn_data.totalPrice),2) AS total_price
                                                               FROM
                                                                   inventory_stockIn_data
                                                               WHERE inventory_stockIn_data.branchId = '${branchId}' AND inventory_stockIn_data.supplierId = '${data.supplierId}' AND inventory_stockIn_data.stockInDate BETWEEN STR_TO_DATE('${firstDay}','%b %d %Y') AND STR_TO_DATE('${lastDay}','%b %d %Y')
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
                            console.log('json 1', datas);
                            console.log('json 2', data);
                            const rows = datas ? datas.map((element, index) => data[index] && data[index].convertedQuantity ? { ...element, remainingStock: data[index].convertedQuantity } : { ...element, remainingStock: element.remainingStock + ' ' + element.minProductUnit },
                                // console.log(data[index] && data[index].convertedQuantity)
                            ) : []
                            return res.status(200).send(rows);
                        }).catch(error => {
                            console.error('Error in processing datas:', error);
                            return res.status(500).send('Internal Error');
                        });
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

// Get All Product Details By Supplier Id

const getAllProductDetailsBySupplierId = async (req, res) => {
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
                                                                            inventory_stockIn_data.branchId = '${branchId}' AND inventory_stockIn_data.supplierId = '${data.supplierId}' AND inventory_stockIn_data.stockInDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')
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
                                                                            inventory_stockIn_data.branchId = '${branchId}' AND inventory_stockIn_data.supplierId = '${data.supplierId}' AND inventory_stockIn_data.stockInDate BETWEEN STR_TO_DATE('${firstDay}','%b %d %Y') AND STR_TO_DATE('${lastDay}','%b %d %Y')
                                                                        GROUP BY
                                                                            inventory_stockIn_data.productId
                                                                    ) AS si
                                                                  ON
                                                                    sp.productId = si.productId
                                                                    WHERE sp.supplierId = '${data.supplierId}'
                                                                    ORDER BY pd.productName
                                                                    LIMIT ${limit}`;
                        }
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

//Get Supplier Data API

const getSupplierdata = (req, res) => {
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
                const searchWord = req.query.searchWord;
                if (req.query.searchWord) {
                    sql_querry_getdetails = `SELECT count(*) as numRows FROM inventory_supplier_data WHERE supplierFirmName LIKE '%` + searchWord + `%' OR supplierNickName LIKE'%` + searchWord + `%'`;
                } else {
                    sql_querry_getdetails = `SELECT count(*) as numRows FROM inventory_supplier_data`;
                }
                pool.query(sql_querry_getdetails, (err, rows, fields) => {
                    if (err) {
                        console.error("An error occurd in SQL Queery", err);
                        return res.status(500).send('Database Error');
                    } else {
                        const numRows = rows[0].numRows;
                        const numPages = Math.ceil(numRows / numPerPage);
                        if (req.query.searchWord) {
                            sql_querry_getSupplierData = `SELECT sd.supplierId, supplierFirstName AS supplierName, sd.supplierFirmName, sd.supplierNickName, sd.supplierPhoneNumber, GROUP_CONCAT(inventory_product_data.productName SEPARATOR ', ') as productList,
                                                          COALESCE(sisd.total_price, 0) - COALESCE(sosd.total_paid, 0) AS remainingAmount FROM inventory_supplier_data AS sd
                                                          INNER JOIN inventory_supplierProducts_data ON inventory_supplierProducts_data.supplierId = sd.supplierId
                                                          INNER JOIN inventory_product_data ON inventory_product_data.productId = inventory_supplierProducts_data.productId
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
                                                          WHERE sd.supplierFirmName LIKE '%` + searchWord + `%' OR sd.supplierNickName LIKE '%` + searchWord + `%'
                                                          GROUP BY inventory_supplierProducts_data.supplierId
                                                          ORDER BY sd.supplierFirmName LIMIT  ${limit}`;
                        } else {
                            sql_querry_getSupplierData = `SELECT sd.supplierId, supplierFirstName AS supplierName, sd.supplierFirmName, sd.supplierNickName, sd.supplierPhoneNumber, GROUP_CONCAT(inventory_product_data.productName SEPARATOR ', ') as productList,
                                                          COALESCE(sisd.total_price, 0) - COALESCE(sosd.total_paid, 0) AS remainingAmount FROM inventory_supplier_data AS sd
                                                          INNER JOIN inventory_supplierProducts_data ON inventory_supplierProducts_data.supplierId = sd.supplierId
                                                          INNER JOIN inventory_product_data ON inventory_product_data.productId = inventory_supplierProducts_data.productId
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
                                                          GROUP BY inventory_supplierProducts_data.supplierId 
                                                          ORDER BY sd.supplierFirmName LIMIT ${limit} `;
                        }
                        console.log('>>>', sql_querry_getSupplierData);
                        pool.query(sql_querry_getSupplierData, (err, rows, fields) => {
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
                return res.status(401).send('BranchId Not Found');
            }
        } else {
            return res.status(401).send('Pleasr Login Firest.....!');
        }
    } catch (error) {
        console.error('An error occurd', error);
        res.status(500).send('Internal Server Error');
    }
}

// Get SupplierId wise Details

const getSupplierDetailsById = async (req, res) => {
    try {
        const supplierId = req.query.supplierId
        sql_query_getDetailsById = `SELECT sd.supplierId, supplierFirstName AS supplierName, supplierFirmName AS firmName, supplierFirmAddress AS firmAddress,  GROUP_CONCAT(inventory_product_data.productName SEPARATOR ', ') as products,supplierNickName AS nickName, supplierPhoneNumber AS phoneNumber, supplierEmailId AS emailId 
                                    FROM inventory_supplier_data AS sd
                                    INNER JOIN inventory_supplierProducts_data ON inventory_supplierProducts_data.supplierId = sd.supplierId
                                    INNER JOIN inventory_product_data ON inventory_product_data.productId = inventory_supplierProducts_data.productId
                                    WHERE sd.supplierId = '${supplierId}'`;
        pool.query(sql_query_getDetailsById, (err, data) => {
            if (err) {
                console.error("An error occurd in SQL Queery", err);
                return res.status(500).send('Database Error');
            }
            return res.status(200).send(data[0]);
        })

    } catch (error) {
        console.error('An error occurd', error);
        res.status(500).send('Internal Server Error');
    }
}

// Add Supplier API

const addSupplierDetails = async (req, res) => {
    try {

        const uid1 = new Date();
        const supplierId = String("supplier_" + uid1.getTime());
        console.log("...", supplierId.toString());

        const data = {
            supplierFirstName: req.body.supplierFirstName ? req.body.supplierFirstName.trim() : null,
            supplierLastName: req.body.supplierLastName ? req.body.supplierLastName.trim() : null,
            supplierFirmName: req.body.supplierFirmName.trim(),
            supplierFirmAddress: req.body.supplierFirmAddress ? req.body.supplierFirmAddress.trim() : null,
            supplierNickName: req.body.supplierNickName.trim(),
            supplierPhoneNumber: req.body.supplierPhoneNumber.trim(),
            supplierEmailId: req.body.supplierEmailId ? req.body.supplierEmailId.trim() : null,
            productId: req.body.productId ? req.body.productId : null
        }

        const supllierProducts = () => {
            if (data.productId == null || data.productId == '') {
                return res.status(400).send("Please Select Product");
            } else {
                var string = ''
                data.productId.forEach((data, index) => {
                    if (index == 0)
                        string = "(" + "'" + supplierId + "'" + "," + string + "'" + data + "'" + ")";
                    else
                        string = string + ",(" + "'" + supplierId + "'" + "," + "'" + data + "'" + ")";
                });
                return string;
            }
        }
        if (!data.supplierNickName || !data.supplierFirmName || !data.supplierPhoneNumber || !data.productId) {
            return res.status(400).send("Please Fill all the feilds");
        } else {
            req.body.supplierNickName = pool.query(`SELECT supplierNickName FROM inventory_supplier_data WHERE supplierNickName = '${data.supplierNickName}'`, function (err, row) {
                if (err) {
                    console.error("An error occurd in SQL Queery", err);
                    return res.status(500).send('Database Error');
                } else if (row && row.length) {
                    return res.status(400).send('Supplier is Already In Use');
                } else {
                    sql_querry_addSupplier = `INSERT INTO inventory_supplier_data (supplierId, supplierFirstName, supplierLastName, supplierFirmName, supplierFirmAddress, supplierNickName, supplierPhoneNumber, supplierEmailId)
                                              VALUES ('${supplierId}',NULLIF('${data.supplierFirstName}','null'),NULLIF('${data.supplierLastName}','null'),'${data.supplierFirmName}',NULLIF('${data.supplierFirmAddress}','null'),'${data.supplierNickName}','${data.supplierPhoneNumber}',NULLIF('${data.supplierEmailId}','null'))`;
                    pool.query(sql_querry_addSupplier, (err, data) => {
                        if (err) {
                            console.error("An error occurd in SQL Queery", err);
                            return res.status(500).send('Database Error');
                        }
                        sql_queries_addsupllierProducts = `INSERT INTO inventory_supplierProducts_data (supplierId, productId) VALUES ${supllierProducts()}`;
                        pool.query(sql_queries_addsupllierProducts, (err, data) => {
                            if (err) {
                                console.error("An error occurd in SQL Queery", err);
                                return res.status(500).send('Database Error');
                            }
                            return res.status(200).send("Supplier Added Successfully");
                        })
                    })
                }
            })
        }
    } catch (error) {
        console.error('An error occurd', error);
        res.status(500).send('Internal Server Error');
    }
}

// Remove Supplier API

const removeSupplierDetails = async (req, res) => {

    try {
        const supplierId = req.query.supplierId
        req.query.userId = pool.query(`SELECT supplierId FROM inventory_supplier_data WHERE supplierId = '${supplierId}'`, (err, row) => {
            if (err) {
                console.error("An error occurd in SQL Queery", err);
                return res.status(500).send('Database Error');
            }
            if (row && row.length) {
                const sql_querry_removedetails = `DELETE FROM inventory_supplier_data WHERE supplierId = '${supplierId}'`;
                pool.query(sql_querry_removedetails, (err, data) => {
                    if (err) {
                        console.error("An error occurd in SQL Queery", err);
                        return res.status(500).send('Database Error');
                    }
                    return res.status(200).send("supplierId Deleted Successfully");
                })
            } else {
                return res.send('supplierId Not Found');
            }
        })
    } catch (error) {
        console.error('An error occurd', error);
        res.status(500).send('Internal Server Error');
    }
}

// Fill Supplier For Update 

const fillSupplierDetails = (req, res) => {
    try {
        const supplierId = req.query.supplierId
        sql_querry_fillUser = `SELECT supplierId, supplierFirstName, supplierLastName, supplierFirmName, supplierFirmAddress, supplierNickName, supplierPhoneNumber, supplierEmailId FROM inventory_supplier_data WHERE supplierId =  '${supplierId}';
                               SELECT inventory_supplierProducts_data.productId, UPPER(inventory_product_data.productName) productName FROM inventory_supplierProducts_data 
                                INNER JOIN inventory_product_data ON inventory_product_data.productId = inventory_supplierProducts_data.productId
                                WHERE supplierId =  '${supplierId}';
                                SELECT GROUP_CONCAT(productId SEPARATOR ',') as productList FROM inventory_supplierProducts_data WHERE supplierId = '${supplierId}' GROUP BY supplierId;`;
        pool.query(sql_querry_fillUser, (err, data) => {
            if (err) {
                console.error("An error occurd in SQL Queery", err);
                return res.status(500).send('Database Error');
            }
            const supplierData = data[0][0]
            var a = data[2][0].productList;
            b = a.split(",");
            console.log(b);
            const allData = {
                ...supplierData,
                supplierProductData: data[1],
                productId: b
            }
            return res.status(200).send(allData);
        })
    } catch (error) {
        console.error('An error occurd', error);
        res.status(500).json('Internal Server Error');
    }
}

// Update Supplier API

const updateSupplierDetails = async (req, res) => {
    try {
        const supplierId = req.body.supplierId;
        const data = {
            supplierFirstName: req.body.supplierFirstName ? req.body.supplierFirstName.trim() : null,
            supplierLastName: req.body.supplierLastName ? req.body.supplierLastName.trim() : null,
            supplierFirmName: req.body.supplierFirmName.trim(),
            supplierFirmAddress: req.body.supplierFirmAddress ? req.body.supplierFirmAddress.trim() : null,
            supplierNickName: req.body.supplierNickName.trim(),
            supplierPhoneNumber: req.body.supplierPhoneNumber.trim(),
            supplierEmailId: req.body.supplierEmailId ? req.body.supplierEmailId.trim() : null,
            productId: req.body.productId
        }
        if (!data.supplierNickName || !data.supplierFirmName || !data.supplierPhoneNumber || !data.productId) {
            return res.status(400).send("Please Fill all the feilds");
        }
        const supllierProducts = () => {
            var string = ''
            data.productId.forEach((data, index) => {
                if (index == 0)
                    string = "(" + "'" + supplierId + "'" + "," + string + "'" + data + "'" + ")";
                else
                    string = string + ",(" + "'" + supplierId + "'" + "," + "'" + data + "'" + ")";
            });
            return string;
        }
        const sql_querry_updatedetails = `UPDATE inventory_supplier_data SET supplierFirstName = NULLIF('${data.supplierFirstName}','null'), 
                                                                             supplierLastName = NULLIF('${data.supplierLastName}','null'),
                                                                             supplierFirmName = NULLIF('${data.supplierFirmName}','null'),
                                                                             supplierFirmAddress = '${data.supplierFirmAddress}',
                                                                             supplierNickName = '${data.supplierNickName}',
                                                                             supplierPhoneNumber = '${data.supplierPhoneNumber}',
                                                                             supplierEmailId = NULLIF('${data.supplierEmailId}','null')
                                                                       WHERE supplierId = '${supplierId}'`;
        pool.query(sql_querry_updatedetails, (err, data) => {
            if (err) {
                console.error("An error occurd in SQL Queery", err);
                return res.status(500).send('Database Error');
            }
            sql_querry_deleteSupplierProducts = `DELETE FROM inventory_supplierProducts_data WHERE supplierId = '${supplierId}'`;
            pool.query(sql_querry_deleteSupplierProducts, (err, data) => {
                if (err) {
                    console.error("An error occurd in SQL Queery", err);
                    return res.status(500).send('Database Error');
                }
                sql_queries_addsupllierProducts = `INSERT INTO inventory_supplierProducts_data (supplierId, productId) VALUES ${supllierProducts()}`;
                pool.query(sql_queries_addsupllierProducts, (err, data) => {
                    if (err) {
                        console.error("An error occurd in SQL Queery", err);
                        return res.status(500).send('Database Error');
                    }
                    return res.status(200).send("Supplier Updated Successfully");
                })
            })
        })
    } catch (error) {
        console.error('An error occurd', error);
        res.status(500).send('Internal Server Error');
    }
}

const exportExcelSheetForAllProductBySupplierId = (req, res) => {

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
                                CONCAT(COALESCE(si.total_quantity, 0),' ',pd.unit) AS productQuantity,
                                COALESCE(si.total_expense, 0) AS totalExpense,
                                CONCAT(COALESCE(siLu.productQty, 0),' ',pd.unit) AS lastStockIN,
                                COALESCE(siLu.productPrice, 0) AS lastUpdatedPrice,
                                COALESCE(DATE_FORMAT(siLu.stockInDate,'%d-%M-%Y'), 'No Update') AS lastStockedInAt
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
            { key: "productQuantity", width: 20 },
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
    })
};

// GET Supplier All Branch Data

const getSupplierAllBranchData = (req, res) => {
    try {
        const page = req.query.page;
        const numPerPage = req.query.numPerPage;
        const skip = (page - 1) * numPerPage;
        const limit = skip + ',' + numPerPage;
        const searchWord = req.query.searchWord;
        if (req.query.searchWord) {
            sql_querry_getdetails = `SELECT count(*) as numRows FROM inventory_supplier_data WHERE supplierFirmName LIKE '%` + searchWord + `%' OR supplierNickName LIKE'%` + searchWord + `%'`;
        } else {
            sql_querry_getdetails = `SELECT count(*) as numRows FROM inventory_supplier_data`;
        }
        pool.query(sql_querry_getdetails, (err, rows, fields) => {
            if (err) {
                console.error("An error occurd in SQL Queery", err);
                return res.status(500).send('Database Error');
            } else {
                const numRows = rows[0].numRows;
                const numPages = Math.ceil(numRows / numPerPage);
                if (req.query.searchWord) {
                    sql_querry_getSupplierData = `SELECT sd.supplierId, supplierFirstName AS supplierName, sd.supplierFirmName, sd.supplierNickName, sd.supplierPhoneNumber, GROUP_CONCAT(inventory_product_data.productName SEPARATOR ', ') as productList,
                                                    COALESCE(sisd.total_price, 0) - COALESCE(sosd.total_paid, 0) AS remainingAmount FROM inventory_supplier_data AS sd
                                                    INNER JOIN inventory_supplierProducts_data ON inventory_supplierProducts_data.supplierId = sd.supplierId
                                                    INNER JOIN inventory_product_data ON inventory_product_data.productId = inventory_supplierProducts_data.productId
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
                                                    WHERE sd.supplierFirmName LIKE '%` + searchWord + `%' OR sd.supplierNickName LIKE '%` + searchWord + `%'
                                                    GROUP BY inventory_supplierProducts_data.supplierId
                                                    ORDER BY sd.supplierFirmName LIMIT  ${limit}`;
                } else {
                    sql_querry_getSupplierData = `SELECT sd.supplierId, supplierFirstName AS supplierName, sd.supplierFirmName, sd.supplierNickName, sd.supplierPhoneNumber, GROUP_CONCAT(inventory_product_data.productName SEPARATOR ', ') as productList,
                                                    COALESCE(sisd.total_price, 0) - COALESCE(sosd.total_paid, 0) AS remainingAmount FROM inventory_supplier_data AS sd
                                                    INNER JOIN inventory_supplierProducts_data ON inventory_supplierProducts_data.supplierId = sd.supplierId
                                                    INNER JOIN inventory_product_data ON inventory_product_data.productId = inventory_supplierProducts_data.productId
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
                                                    GROUP BY inventory_supplierProducts_data.supplierId 
                                                    ORDER BY sd.supplierFirmName LIMIT ${limit} `;
                }
                console.log('>>>', sql_querry_getSupplierData);
                pool.query(sql_querry_getSupplierData, (err, rows, fields) => {
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
    } catch (error) {
        console.error('An error occurd', error);
        res.status(500).send('Internal Server Error');
    }
}

module.exports = {
    getSupplierdata,
    getSupplierAllBranchData,
    getSupplierDetailsById,
    addSupplierDetails,
    removeSupplierDetails,
    fillSupplierDetails,
    updateSupplierDetails,
    getSupplierCounterDetailsById,
    getProductDetailsBySupplierId,
    getAllProductDetailsBySupplierId,
    exportExcelSheetForAllProductBySupplierId
}

