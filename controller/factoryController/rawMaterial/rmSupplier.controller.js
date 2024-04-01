const pool = require('../../../database');
const excelJS = require("exceljs");
const jwt = require("jsonwebtoken");
const { processDatas } = require("./rmConversation.controller");
const { jsPDF } = require('jspdf');
require('jspdf-autotable');

// Get Count List Supplier Wise

const getFactorySupplierCounterDetailsById = (req, res) => {
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
                rmSupplierId: req.query.rmSupplierId
            }
            const sql_querry_remainAmount = `SELECT SUM(COALESCE(sisd.total_price, 0) - COALESCE(sosd.total_paid, 0)) AS remainingAmountOfSupplier FROM factory_supplier_data AS sd
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
                                                WHERE sd.rmSupplierId = '${data.rmSupplierId}';`;
            if (req.query.startDate && req.query.endDate) {
                sql_querry_getSupplierCount = `SELECT COALESCE(ROUND(SUM(totalPrice)),0) AS totalBusiness FROM factory_rmStockIn_data WHERE rmSupplierId = '${data.rmSupplierId}' AND rmStockInDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y');
                                                   SELECT COALESCE(ROUND(SUM(totalPrice)),0) AS totalBusinessOfDebit FROM factory_rmStockIn_data WHERE rmSupplierId = '${data.rmSupplierId}' AND rmStockInPaymentMethod = 'debit' AND rmStockInDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y');
                                                   SELECT COALESCE(ROUND(SUM(totalPrice)),0) AS totalBusinessOfCash FROM factory_rmStockIn_data WHERE rmSupplierId = '${data.rmSupplierId}' AND rmStockInPaymentMethod = 'cash' AND rmStockInDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y');
                                                   SELECT COALESCE(ROUND(SUM(paidAmount)),0) AS totalPaidtoSupplier FROM factory_supplierTransaction_data WHERE rmSupplierId = '${data.rmSupplierId}' AND transactionDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y');
                                                   SELECT COUNT(rawMaterialId) AS numbreOfProduct FROM factory_supplierProducts_data WHERE rmSupplierId = '${data.rmSupplierId}';
                                                   ${sql_querry_remainAmount}`;
            } else {
                sql_querry_getSupplierCount = `SELECT COALESCE(ROUND(SUM(totalPrice)),0) AS totalBusiness FROM factory_rmStockIn_data WHERE rmSupplierId = '${data.rmSupplierId}' AND rmStockInDate BETWEEN STR_TO_DATE('${firstDay}','%b %d %Y') AND STR_TO_DATE('${lastDay}','%b %d %Y');
                                                   SELECT COALESCE(ROUND(SUM(totalPrice)),0) AS totalBusinessOfDebit FROM factory_rmStockIn_data WHERE rmSupplierId = '${data.rmSupplierId}' AND rmStockInPaymentMethod = 'debit' AND rmStockInDate BETWEEN STR_TO_DATE('${firstDay}','%b %d %Y') AND STR_TO_DATE('${lastDay}','%b %d %Y');
                                                   SELECT COALESCE(ROUND(SUM(totalPrice)),0) AS totalBusinessOfCash FROM factory_rmStockIn_data WHERE rmSupplierId = '${data.rmSupplierId}' AND rmStockInPaymentMethod = 'cash' AND rmStockInDate BETWEEN STR_TO_DATE('${firstDay}','%b %d %Y') AND STR_TO_DATE('${lastDay}','%b %d %Y');
                                                   SELECT COALESCE(ROUND(SUM(paidAmount)),0) AS totalPaidtoSupplier FROM factory_supplierTransaction_data WHERE rmSupplierId = '${data.rmSupplierId}' AND transactionDate BETWEEN STR_TO_DATE('${firstDay}','%b %d %Y') AND STR_TO_DATE('${lastDay}','%b %d %Y');
                                                   SELECT COUNT(rawMaterialId) AS numbreOfProduct FROM factory_supplierProducts_data WHERE rmSupplierId = '${data.rmSupplierId}';
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
            return res.status(401).send('Pleasr Login Firest.....!');
        }
    } catch (error) {
        console.error('An error occurd', error);
        res.status(500).json('Internal Server Error');
    }
}
// Get Product Details By Supplier Id

const getRawMaterialsBySupplierId = async (req, res) => {
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
                rmSupplierId: req.query.rmSupplierId
            }
            if (req.query.startDate && req.query.endDate) {
                sql_querry_getProductBysupplier = `SELECT sp.rawMaterialId, UPPER(pd.rawMaterialName) AS rawMaterialName, COALESCE(si.total_quantity, 0) AS remainingStock, COALESCE(si.total_price, 0) AS rawMaterialPrice, pd.unit AS minRawMaterialUnit 
                                                       FROM factory_supplierProducts_data AS sp
                                                           INNER JOIN
                                                               (
                                                                   SELECT 
                                                                    factory_rawMaterial_data.rawMaterialId,
                                                                    factory_rawMaterial_data.rawMaterialName, 
                                                                    factory_rawMaterial_data.minRawMaterialUnit AS unit
                                                                   FROM factory_rawMaterial_data
                                                               )AS pd On sp.rawMaterialId = pd.rawMaterialId
                                                           LEFT JOIN
                                                               (
                                                                   SELECT
                                                                       factory_rmStockIn_data.rawMaterialId,
                                                                       ROUND(SUM(factory_rmStockIn_data.rawMaterialQty),2) AS total_quantity,
                                                                       ROUND(SUM(factory_rmStockIn_data.totalPrice),2) AS total_price
                                                                   FROM
                                                                       factory_rmStockIn_data
                                                                   WHERE factory_rmStockIn_data.rmSupplierId = '${data.rmSupplierId}' AND factory_rmStockIn_data.rmStockInDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')
                                                                   GROUP BY
                                                                       factory_rmStockIn_data.rawMaterialId
                                                               ) AS si ON sp.rawMaterialId = si.rawMaterialId
                                                       WHERE sp.rmSupplierId = '${data.rmSupplierId}'
                                                       ORDER BY remainingStock DESC
                                                       LIMIT 6`;
            } else {
                sql_querry_getProductBysupplier = `SELECT sp.rawMaterialId, pd.rawMaterialName, COALESCE(si.total_quantity, 0) AS remainingStock, COALESCE(si.total_price, 0) AS rawMaterialPrice, pd.unit AS minRawMaterialUnit 
                                                       FROM factory_supplierProducts_data AS sp
                                                       INNER JOIN
                                                           (
                                                               SELECT 
                                                                       factory_rawMaterial_data.rawMaterialId,
                                                                       factory_rawMaterial_data.rawMaterialName, 
                                                                       factory_rawMaterial_data.minRawMaterialUnit AS unit
                                                               FROM factory_rawMaterial_data
                                                           )AS pd On sp.rawMaterialId = pd.rawMaterialId
                                                       LEFT JOIN
                                                           (
                                                               SELECT
                                                                   factory_rmStockIn_data.rawMaterialId,
                                                                   ROUND(SUM(factory_rmStockIn_data.rawMaterialQty),2) AS total_quantity,
                                                                   ROUND(SUM(factory_rmStockIn_data.totalPrice),2) AS total_price
                                                               FROM
                                                                   factory_rmStockIn_data
                                                               WHERE factory_rmStockIn_data.rmSupplierId = '${data.rmSupplierId}' AND factory_rmStockIn_data.rmStockInDate BETWEEN STR_TO_DATE('${firstDay}','%b %d %Y') AND STR_TO_DATE('${lastDay}','%b %d %Y')
                                                               GROUP BY
                                                                   factory_rmStockIn_data.rawMaterialId
                                                           ) AS si ON sp.rawMaterialId = si.rawMaterialId
                                                   WHERE sp.rmSupplierId = '${data.rmSupplierId}'
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
                        const rows = datas ? datas.map((element, index) => data[index] && data[index].convertedQuantity ? { ...element, remainingStock: data[index].convertedQuantity } : { ...element, remainingStock: element.remainingStock + ' ' + element.minRawMaterialUnit },
                            // console.log(data[index] && data[index].convertedQuantity)
                        ) : []
                        return res.status(200).send(rows);
                    }).catch(error => {
                        console.error('Error in processing datas:', error);
                        return res.status(500).send('Internal Error');
                    });
            })

        } else {
            return res.status(401).send('Pleasr Login Firest.....!');
        }
    } catch (error) {
        console.error('An error occurd', error);
        res.status(500).json('Internal Server Error');
    }
}

// Get All Product Details By Supplier Id

const getAllRawMaterialsBySupplierId = async (req, res) => {
    try {
        let token;
        token = req.headers.authorization ? req.headers.authorization.split(" ")[1] : null;
        if (token) {
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
                rmSupplierId: req.query.rmSupplierId
            }
            sql_querry_getAllProductBysupplierPagination = `SELECT COUNT(rawMaterialId) AS numRows FROM factory_supplierProducts_data WHERE rmSupplierId = '${data.rmSupplierId}'`;
            pool.query(sql_querry_getAllProductBysupplierPagination, (err, rows, fields) => {
                if (err) {
                    console.error("An error occurd in SQL Queery", err);
                    return res.status(500).send('Database Error');
                } else {
                    const numRows = rows[0].numRows;
                    const numPages = Math.ceil(numRows / numPerPage);
                    const commaonQuery = `SELECT
                                              sp.rawMaterialId,
                                                  pd.rawMaterialName,
                                                  COALESCE(si.total_quantity, 0) AS remainingStock,
                                                  COALESCE(si.total_expense, 0) AS totalExpense,
                                                  COALESCE(siLu.rawMaterialQty, 0) AS lastStockIN,
                                                  COALESCE(siLu.rawMaterialPrice, 0) AS lastUpdatedPrice,
                                                  COALESCE(DATE_FORMAT(siLu.rmStockInDate,'%d-%m-%Y'), 'No Update') AS lastStockdInAt,
                                                  pd.unit AS minRawMaterialUnit
                                              FROM
                                                  factory_supplierProducts_data AS sp
                                              INNER JOIN(
                                                  SELECT
                                                      factory_rawMaterial_data.rawMaterialId,
                                                  factory_rawMaterial_data.rawMaterialName,
                                                  factory_rawMaterial_data.minRawMaterialUnit AS unit
                                                  FROM
                                                      factory_rawMaterial_data
                                              ) AS pd
                                              ON
                                              sp.rawMaterialId = pd.rawMaterialId
                                              LEFT JOIN(
                                                  SELECT
                                                      rawMaterialId,
                                                      rmStockInDate,
                                                      CONCAT(rmStockInDisplayQty,' ',rmStockInDisplayUnit) AS rawMaterialQty,
                                                      totalPrice AS rawMaterialPrice
                                                  FROM
                                                      factory_rmStockIn_data
                                                  WHERE
                                                      (rawMaterialId, rmStockInCreationDate) IN(
                                                          SELECT
                                                          rawMaterialId,
                                                          MAX(rmStockInCreationDate)
                                                      FROM
                                                          factory_rmStockIn_data
                                                      WHERE
                                                          factory_rmStockIn_data.rmSupplierId = '${data.rmSupplierId}'
                                                      GROUP BY
                                                          rawMaterialId
                                                      )
                                              ) AS siLu
                                              ON
                                              sp.rawMaterialId = siLu.rawMaterialId`;
                    if (req.query.startDate && req.query.endDate) {
                        sql_querry_getAllProductBysupplier = `${commaonQuery}
                                                                    LEFT JOIN(
                                                                        SELECT
                                                                            factory_rmStockIn_data.rawMaterialId,
                                                                        ROUND(SUM(
                                                                            factory_rmStockIn_data.rawMaterialQty
                                                                        ),2) AS total_quantity,
                                                                        ROUND(SUM(
                                                                            factory_rmStockIn_data.totalPrice
                                                                        )) AS total_expense
                                                                        FROM
                                                                            factory_rmStockIn_data
                                                                        WHERE
                                                                            factory_rmStockIn_data.rmSupplierId = '${data.rmSupplierId}' AND factory_rmStockIn_data.rmStockInDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')
                                                                        GROUP BY
                                                                            factory_rmStockIn_data.rawMaterialId
                                                                    ) AS si
                                                                    ON
                                                                    sp.rawMaterialId = si.rawMaterialId
                                                                    WHERE sp.rmSupplierId = '${data.rmSupplierId}'
                                                                    ORDER BY pd.rawMaterialName 
                                                                    LIMIT ${limit}`;
                    } else {
                        sql_querry_getAllProductBysupplier = `${commaonQuery}
                                                                    LEFT JOIN(
                                                                        SELECT
                                                                            factory_rmStockIn_data.rawMaterialId,
                                                                        ROUND(SUM(
                                                                            factory_rmStockIn_data.rawMaterialQty
                                                                        ),2) AS total_quantity,
                                                                        ROUND(SUM(
                                                                            factory_rmStockIn_data.totalPrice
                                                                        )) AS total_expense
                                                                        FROM
                                                                            factory_rmStockIn_data
                                                                        WHERE
                                                                            factory_rmStockIn_data.rmSupplierId = '${data.rmSupplierId}' AND factory_rmStockIn_data.rmStockInDate BETWEEN STR_TO_DATE('${firstDay}','%b %d %Y') AND STR_TO_DATE('${lastDay}','%b %d %Y')
                                                                        GROUP BY
                                                                            factory_rmStockIn_data.rawMaterialId
                                                                    ) AS si
                                                                  ON
                                                                    sp.rawMaterialId = si.rawMaterialId
                                                                    WHERE sp.rmSupplierId = '${data.rmSupplierId}'
                                                                    ORDER BY pd.rawMaterialName
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
                                        const rows = datas ? datas.map((element, index) => data[index] && data[index].convertedQuantity ? { ...element, remainingStock: data[index].convertedQuantity } : { ...element, remainingStock: element.remainingStock + ' ' + element.minRawMaterialUnit },
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
            return res.status(401).send('Pleasr Login Firest.....!');
        }
    } catch (error) {
        console.error('An error occurd', error);
        res.status(500).json('Internal Server Error');
    }
}

//Get Supplier Data API

const getFactorySupplierdata = (req, res) => {
    try {
        let token;
        token = req.headers.authorization ? req.headers.authorization.split(" ")[1] : null;
        if (token) {
            const page = req.query.page;
            const numPerPage = req.query.numPerPage;
            const skip = (page - 1) * numPerPage;
            const limit = skip + ',' + numPerPage;
            const searchWord = req.query.searchWord;
            if (req.query.searchWord) {
                sql_querry_getdetails = `SELECT count(*) as numRows FROM factory_supplier_data WHERE supplierFirmName LIKE '%` + searchWord + `%' OR supplierNickName LIKE'%` + searchWord + `%'`;
            } else {
                sql_querry_getdetails = `SELECT count(*) as numRows FROM factory_supplier_data`;
            }
            pool.query(sql_querry_getdetails, (err, rows, fields) => {
                if (err) {
                    console.error("An error occurd in SQL Queery", err);
                    return res.status(500).send('Database Error');
                } else {
                    const numRows = rows[0].numRows;
                    const numPages = Math.ceil(numRows / numPerPage);
                    if (req.query.searchWord) {
                        sql_querry_getSupplierData = `SELECT sd.rmSupplierId, sd.supplierFirstName AS supplierName, sd.supplierFirmName, sd.supplierNickName, sd.supplierPhoneNumber, GROUP_CONCAT(factory_rawMaterial_data.rawMaterialName SEPARATOR ', ') as rawMaterialList,
                                                          COALESCE(sisd.total_price, 0) - COALESCE(sosd.total_paid, 0) AS remainingAmount FROM factory_supplier_data AS sd
                                                          INNER JOIN factory_supplierProducts_data ON factory_supplierProducts_data.rmSupplierId = sd.rmSupplierId
                                                          INNER JOIN factory_rawMaterial_data ON factory_rawMaterial_data.rawMaterialId = factory_supplierProducts_data.rawMaterialId
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
                                                          WHERE sd.supplierFirmName LIKE '%` + searchWord + `%' OR sd.supplierNickName LIKE '%` + searchWord + `%'
                                                          GROUP BY factory_supplierProducts_data.rmSupplierId
                                                          ORDER BY sd.supplierFirmName LIMIT  ${limit}`;
                    } else {
                        sql_querry_getSupplierData = `SELECT sd.rmSupplierId, sd.supplierFirstName AS supplierName, sd.supplierFirmName, sd.supplierNickName, sd.supplierPhoneNumber, GROUP_CONCAT(factory_rawMaterial_data.rawMaterialName SEPARATOR ', ') as rawMaterialList,
                                                          COALESCE(sisd.total_price, 0) - COALESCE(sosd.total_paid, 0) AS remainingAmount FROM factory_supplier_data AS sd
                                                          INNER JOIN factory_supplierProducts_data ON factory_supplierProducts_data.rmSupplierId = sd.rmSupplierId
                                                          INNER JOIN factory_rawMaterial_data ON factory_rawMaterial_data.rawMaterialId = factory_supplierProducts_data.rawMaterialId
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
                                                          GROUP BY factory_supplierProducts_data.rmSupplierId 
                                                          ORDER BY sd.supplierFirmName LIMIT ${limit} `;
                    }
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
            return res.status(401).send('Pleasr Login Firest.....!');
        }
    } catch (error) {
        console.error('An error occurd', error);
        res.status(500).send('Internal Server Error');
    }
}

// Get SupplierId wise Details

const getFactorySupplierDetailsById = async (req, res) => {
    try {
        const rmSupplierId = req.query.rmSupplierId
        sql_query_getDetailsById = `SELECT sd.rmSupplierId, supplierFirstName AS supplierName, supplierFirmName AS firmName, supplierFirmAddress AS firmAddress,  GROUP_CONCAT(factory_rawMaterial_data.rawMaterialName SEPARATOR ', ') as products,supplierNickName AS nickName, supplierPhoneNumber AS phoneNumber, supplierEmailId AS emailId 
                                    FROM factory_supplier_data AS sd
                                    INNER JOIN factory_supplierProducts_data ON factory_supplierProducts_data.rmSupplierId = sd.rmSupplierId
                                    INNER JOIN factory_rawMaterial_data ON factory_rawMaterial_data.rawMaterialId = factory_supplierProducts_data.rawMaterialId
                                    WHERE sd.rmSupplierId = '${rmSupplierId}'`;
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

const addFactorySupplierDetails = async (req, res) => {
    try {

        const uid1 = new Date();
        const rmSupplierId = String("supplier_" + uid1.getTime());
        console.log("...", rmSupplierId.toString());

        const data = {
            supplierFirstName: req.body.supplierFirstName ? req.body.supplierFirstName.trim() : null,
            supplierLastName: req.body.supplierLastName ? req.body.supplierLastName.trim() : null,
            supplierFirmName: req.body.supplierFirmName.trim(),
            supplierFirmAddress: req.body.supplierFirmAddress ? req.body.supplierFirmAddress.trim() : null,
            supplierNickName: req.body.supplierNickName.trim(),
            supplierPhoneNumber: req.body.supplierPhoneNumber.trim(),
            supplierEmailId: req.body.supplierEmailId ? req.body.supplierEmailId.trim() : null,
            rawMaterialId: req.body.rawMaterialId ? req.body.rawMaterialId : null
        }

        const supllierProducts = () => {
            if (data.rawMaterialId == null || data.rawMaterialId == '') {
                return res.status(400).send("Please Select Product");
            } else {
                var string = ''
                data.rawMaterialId.forEach((data, index) => {
                    if (index == 0)
                        string = "(" + "'" + rmSupplierId + "'" + "," + string + "'" + data + "'" + ")";
                    else
                        string = string + ",(" + "'" + rmSupplierId + "'" + "," + "'" + data + "'" + ")";
                });
                return string;
            }
        }
        if (!data.supplierNickName || !data.supplierFirmName || !data.supplierPhoneNumber || !data.rawMaterialId) {
            return res.status(400).send("Please Fill all the feilds");
        } else {
            req.body.supplierNickName = pool.query(`SELECT supplierNickName FROM factory_supplier_data WHERE supplierNickName = '${data.supplierNickName}'`, function (err, row) {
                if (err) {
                    console.error("An error occurd in SQL Queery", err);
                    return res.status(500).send('Database Error');
                } else if (row && row.length) {
                    return res.status(400).send('Supplier is Already In Use');
                } else {
                    sql_querry_addSupplier = `INSERT INTO factory_supplier_data (rmSupplierId, supplierFirstName, supplierLastName, supplierFirmName, supplierFirmAddress, supplierNickName, supplierPhoneNumber, supplierEmailId)
                                              VALUES ('${rmSupplierId}',NULLIF('${data.supplierFirstName}','null'),NULLIF('${data.supplierLastName}','null'),'${data.supplierFirmName}',NULLIF('${data.supplierFirmAddress}','null'),'${data.supplierNickName}','${data.supplierPhoneNumber}',NULLIF('${data.supplierEmailId}','null'))`;
                    pool.query(sql_querry_addSupplier, (err, data) => {
                        if (err) {
                            console.error("An error occurd in SQL Queery", err);
                            return res.status(500).send('Database Error');
                        }
                        sql_queries_addsupllierProducts = `INSERT INTO factory_supplierProducts_data (rmSupplierId, rawMaterialId) VALUES ${supllierProducts()}`;
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

const removeFactorySupplierDetails = async (req, res) => {
    try {
        let token;
        token = req.headers ? req.headers.authorization.split(" ")[1] : null;
        if (token) {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const rights = decoded.id.rights;
            if (rights == 1) {
                const rmSupplierId = req.query.rmSupplierId
                req.query.userId = pool.query(`SELECT rmSupplierId FROM factory_supplier_data WHERE rmSupplierId = '${rmSupplierId}'`, (err, row) => {
                    if (err) {
                        console.error("An error occurd in SQL Queery", err);
                        return res.status(500).send('Database Error');
                    }
                    if (row && row.length) {
                        const sql_querry_removedetails = `DELETE FROM factory_supplier_data WHERE rmSupplierId = '${rmSupplierId}'`;
                        pool.query(sql_querry_removedetails, (err, data) => {
                            if (err) {
                                console.error("An error occurd in SQL Queery", err);
                                return res.status(500).send('Database Error');
                            }
                            return res.status(200).send("rmSupplierId Deleted Successfully");
                        })
                    } else {
                        return res.send('rmSupplierId Not Found');
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

// Fill Supplier For Update 

const fillFactorySupplierDetails = (req, res) => {
    try {
        const rmSupplierId = req.query.rmSupplierId
        sql_querry_fillUser = `SELECT rmSupplierId, supplierFirstName, supplierLastName, supplierFirmName, supplierFirmAddress, supplierNickName, supplierPhoneNumber, supplierEmailId FROM factory_supplier_data WHERE rmSupplierId =  '${rmSupplierId}';
                               SELECT factory_supplierProducts_data.rawMaterialId, UPPER(factory_rawMaterial_data.rawMaterialName) rawMaterialName FROM factory_supplierProducts_data 
                                INNER JOIN factory_rawMaterial_data ON factory_rawMaterial_data.rawMaterialId = factory_supplierProducts_data.rawMaterialId
                                WHERE rmSupplierId =  '${rmSupplierId}';
                                SELECT GROUP_CONCAT(rawMaterialId SEPARATOR ',') as rawMaterialList FROM factory_supplierProducts_data WHERE rmSupplierId = '${rmSupplierId}' GROUP BY rmSupplierId;`;
        pool.query(sql_querry_fillUser, (err, data) => {
            if (err) {
                console.error("An error occurd in SQL Queery", err);
                return res.status(500).send('Database Error');
            }
            const supplierData = data[0][0]
            var a = data[2][0].rawMaterialList;
            b = a.split(",");
            console.log(b);
            const allData = {
                ...supplierData,
                supplierProductData: data[1],
                rawMaterialId: b
            }
            return res.status(200).send(allData);
        })
    } catch (error) {
        console.error('An error occurd', error);
        res.status(500).json('Internal Server Error');
    }
}

// Update Supplier API

const updateFactorySupplierDetails = async (req, res) => {
    try {
        const rmSupplierId = req.body.rmSupplierId;
        const data = {
            supplierFirstName: req.body.supplierFirstName ? req.body.supplierFirstName.trim() : null,
            supplierLastName: req.body.supplierLastName ? req.body.supplierLastName.trim() : null,
            supplierFirmName: req.body.supplierFirmName.trim(),
            supplierFirmAddress: req.body.supplierFirmAddress ? req.body.supplierFirmAddress.trim() : null,
            supplierNickName: req.body.supplierNickName.trim(),
            supplierPhoneNumber: req.body.supplierPhoneNumber.trim(),
            supplierEmailId: req.body.supplierEmailId ? req.body.supplierEmailId.trim() : null,
            rawMaterialId: req.body.rawMaterialId
        }
        if (!data.supplierNickName || !data.supplierFirmName || !data.supplierPhoneNumber || !data.rawMaterialId) {
            return res.status(400).send("Please Fill all the feilds");
        }
        const supllierProducts = () => {
            var string = ''
            data.rawMaterialId.forEach((data, index) => {
                if (index == 0)
                    string = "(" + "'" + rmSupplierId + "'" + "," + string + "'" + data + "'" + ")";
                else
                    string = string + ",(" + "'" + rmSupplierId + "'" + "," + "'" + data + "'" + ")";
            });
            return string;
        }
        const sql_querry_updatedetails = `UPDATE factory_supplier_data SET supplierFirstName = NULLIF('${data.supplierFirstName}','null'), 
                                                                             supplierLastName = NULLIF('${data.supplierLastName}','null'),
                                                                             supplierFirmName = NULLIF('${data.supplierFirmName}','null'),
                                                                             supplierFirmAddress = '${data.supplierFirmAddress}',
                                                                             supplierNickName = '${data.supplierNickName}',
                                                                             supplierPhoneNumber = '${data.supplierPhoneNumber}',
                                                                             supplierEmailId = NULLIF('${data.supplierEmailId}','null')
                                                                       WHERE rmSupplierId = '${rmSupplierId}'`;
        pool.query(sql_querry_updatedetails, (err, data) => {
            if (err) {
                console.error("An error occurd in SQL Queery", err);
                return res.status(500).send('Database Error');
            }
            sql_querry_deleteSupplierProducts = `DELETE FROM factory_supplierProducts_data WHERE rmSupplierId = '${rmSupplierId}'`;
            pool.query(sql_querry_deleteSupplierProducts, (err, data) => {
                if (err) {
                    console.error("An error occurd in SQL Queery", err);
                    return res.status(500).send('Database Error');
                }
                sql_queries_addsupllierProducts = `INSERT INTO factory_supplierProducts_data (rmSupplierId, rawMaterialId) VALUES ${supllierProducts()}`;
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

const exportExcelSheetForAllRawMaterialsBySupplierId = (req, res) => {
    let token;
    token = req.headers.authorization ? req.headers.authorization.split(" ")[1] : null;
    if (token) {
        var date = new Date(), y = date.getFullYear(), m = (date.getMonth());
        var firstDay = new Date(y, m, 1).toString().slice(4, 15);
        var lastDay = new Date(y, m + 1, 0).toString().slice(4, 15);

        const data = {
            startDate: (req.query.startDate ? req.query.startDate : '').slice(4, 15),
            endDate: (req.query.endDate ? req.query.endDate : '').slice(4, 15),
            rmSupplierId: req.query.rmSupplierId,
        }
        const commaonQuery = `SELECT
                                        sp.rawMaterialId,
                                        pd.rawMaterialName,
                                        COALESCE(si.total_quantity, 0) AS remainingStock,
                                        COALESCE(si.total_expense, 0) AS totalExpense,
                                        COALESCE(siLu.rawMaterialQty, 0) AS lastStockIN,
                                        COALESCE(siLu.rawMaterialPrice, 0) AS lastUpdatedPrice,
                                        COALESCE(DATE_FORMAT(siLu.rmStockInDate,'%d-%m-%Y'), 'No Update') AS lastStockdInAt,
                                        pd.unit AS minRawMaterialUnit
                                    FROM
                                        factory_supplierProducts_data AS sp
                                    INNER JOIN(
                                        SELECT
                                            factory_rawMaterial_data.rawMaterialId,
                                        factory_rawMaterial_data.rawMaterialName,
                                        factory_rawMaterial_data.minRawMaterialUnit AS unit
                                        FROM
                                            factory_rawMaterial_data
                                    ) AS pd
                                    ON
                                    sp.rawMaterialId = pd.rawMaterialId
                                    LEFT JOIN(
                                        SELECT
                                            rawMaterialId,
                                            rmStockInDate,
                                            rawMaterialQty,
                                            rawMaterialPrice
                                        FROM
                                            factory_rmStockIn_data
                                        WHERE
                                            (rawMaterialId, rmStockInCreationDate) IN(
                                                SELECT
                                                rawMaterialId,
                                                MAX(rmStockInCreationDate)
                                            FROM
                                                factory_rmStockIn_data
                                            WHERE
                                                factory_rmStockIn_data.rmSupplierId = '${data.rmSupplierId}'
                                            GROUP BY
                                                rawMaterialId
                                            )
                                    ) AS siLu
                                    ON
                                    sp.rawMaterialId = siLu.rawMaterialId`;
        if (req.query.startDate && req.query.endDate) {
            sql_querry_getAllProductBysupplier = `${commaonQuery}
                                                        LEFT JOIN(
                                                            SELECT
                                                                factory_rmStockIn_data.rawMaterialId,
                                                            ROUND(SUM(
                                                                factory_rmStockIn_data.rawMaterialQty
                                                            ),2) AS total_quantity,
                                                            ROUND(SUM(
                                                                factory_rmStockIn_data.totalPrice
                                                            )) AS total_expense
                                                            FROM
                                                                factory_rmStockIn_data
                                                            WHERE
                                                                factory_rmStockIn_data.rmSupplierId = '${data.rmSupplierId}' AND factory_rmStockIn_data.rmStockInDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')
                                                            GROUP BY
                                                                factory_rmStockIn_data.rawMaterialId
                                                        ) AS si
                                                        ON
                                                        sp.rawMaterialId = si.rawMaterialId
                                                        WHERE sp.rmSupplierId = '${data.rmSupplierId}'
                                                        ORDER BY pd.rawMaterialName`;
        } else {
            sql_querry_getAllProductBysupplier = `${commaonQuery}
                                                        LEFT JOIN(
                                                              SELECT
                                                                  factory_rmStockIn_data.rawMaterialId,
                                                              ROUND(SUM(
                                                                  factory_rmStockIn_data.rawMaterialQty
                                                              ),2) AS total_quantity,
                                                              ROUND(SUM(
                                                                  factory_rmStockIn_data.totalPrice
                                                              )) AS total_expense
                                                              FROM
                                                                factory_rmStockIn_data
                                                              WHERE
                                                                factory_rmStockIn_data.rmSupplierId = '${data.rmSupplierId}' AND factory_rmStockIn_data.rmStockInDate BETWEEN STR_TO_DATE('${firstDay}','%b %d %Y') AND STR_TO_DATE('${lastDay}','%b %d %Y')
                                                              GROUP BY
                                                                  factory_rmStockIn_data.rawMaterialId
                                                          ) AS si
                                                        ON
                                                          sp.rawMaterialId = si.rawMaterialId
                                                          WHERE sp.rmSupplierId = '${data.rmSupplierId}'
                                                          ORDER BY pd.rawMaterialName`;
        }
        pool.query(sql_querry_getAllProductBysupplier, async (err, rows) => {
            if (err) return res.status(404).send(err);
            const datas = Object.values(JSON.parse(JSON.stringify(rows)));
            await processDatas(datas)
                .then(async (data) => {
                    const rows = datas ? datas.map((element, index) => data[index] && data[index].convertedQuantity ? { ...element, remainingStock: data[index].convertedQuantity } : { ...element, remainingStock: element.remainingStock + ' ' + element.minRawMaterialUnit },
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
                        { key: "rawMaterialName", width: 30 },
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
    } else {
        return res.status(401).send('Pleasr Login Firest.....!');
    }
};

// GET Supplier All Branch Data

const getFactorySupplierAllData = (req, res) => {
    try {
        const page = req.query.page;
        const numPerPage = req.query.numPerPage;
        const skip = (page - 1) * numPerPage;
        const limit = skip + ',' + numPerPage;
        const searchWord = req.query.searchWord;
        if (req.query.searchWord) {
            sql_querry_getdetails = `SELECT count(*) as numRows FROM factory_supplierProducts_data WHERE supplierFirmName LIKE '%` + searchWord + `%' OR supplierNickName LIKE'%` + searchWord + `%'`;
        } else {
            sql_querry_getdetails = `SELECT count(*) as numRows FROM factory_supplierProducts_data`;
        }
        pool.query(sql_querry_getdetails, (err, rows, fields) => {
            if (err) {
                console.error("An error occurd in SQL Queery", err);
                return res.status(500).send('Database Error');
            } else {
                const numRows = rows[0].numRows;
                const numPages = Math.ceil(numRows / numPerPage);
                if (req.query.searchWord) {
                    sql_querry_getSupplierData = `SELECT sd.rmSupplierId, supplierFirstName AS supplierName, sd.supplierFirmName, sd.supplierNickName, sd.supplierPhoneNumber, GROUP_CONCAT(factory_rawMaterial_data.rawMaterialName SEPARATOR ', ') as rawMaterialList,
                                                    COALESCE(sisd.total_price, 0) - COALESCE(sosd.total_paid, 0) AS remainingAmount FROM factory_supplier_data AS sd
                                                    INNER JOIN factory_supplierProducts_data ON factory_supplierProducts_data.rmSupplierId = sd.rmSupplierId
                                                    INNER JOIN factory_rawMaterial_data ON factory_rawMaterial_data.rawMaterialId = factory_supplierProducts_data.rawMaterialId
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
                                                    WHERE sd.supplierFirmName LIKE '%` + searchWord + `%' OR sd.supplierNickName LIKE '%` + searchWord + `%'
                                                    GROUP BY factory_supplierProducts_data.rmSupplierId
                                                    ORDER BY sd.supplierFirmName LIMIT  ${limit}`;
                } else {
                    sql_querry_getSupplierData = `SELECT sd.rmSupplierId, supplierFirstName AS supplierName, sd.supplierFirmName, sd.supplierNickName, sd.supplierPhoneNumber, GROUP_CONCAT(factory_rawMaterial_data.rawMaterialName SEPARATOR ', ') as rawMaterialList,
                                                    COALESCE(sisd.total_price, 0) - COALESCE(sosd.total_paid, 0) AS remainingAmount FROM factory_supplier_data AS sd
                                                    INNER JOIN factory_supplierProducts_data ON factory_supplierProducts_data.rmSupplierId = sd.rmSupplierId
                                                    INNER JOIN factory_rawMaterial_data ON factory_rawMaterial_data.rawMaterialId = factory_supplierProducts_data.rawMaterialId
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
                                                    GROUP BY factory_supplierProducts_data.rmSupplierId 
                                                    ORDER BY sd.supplierFirmName LIMIT ${limit} `;
                }
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

const exportPdfForAllRawMaterialsBySupplierId = (req, res) => {
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
                rmSupplierId: req.query.rmSupplierId,
            }
            const commaonQuery = `SELECT
                                        sp.rawMaterialId,
                                        pd.rawMaterialName,
                                        COALESCE(si.total_quantity, 0) AS remainingStock,
                                        COALESCE(si.total_expense, 0) AS totalExpense,
                                        COALESCE(siLu.rawMaterialQty, 0) AS lastStockIN,
                                        COALESCE(siLu.rawMaterialPrice, 0) AS lastUpdatedPrice,
                                        COALESCE(DATE_FORMAT(siLu.rmStockInDate,'%d-%m-%Y'), 'No Update') AS lastStockdInAt,
                                        pd.unit AS minRawMaterialUnit
                                    FROM
                                        factory_supplierProducts_data AS sp
                                    INNER JOIN(
                                        SELECT
                                            factory_rawMaterial_data.rawMaterialId,
                                        factory_rawMaterial_data.rawMaterialName,
                                        factory_rawMaterial_data.minRawMaterialUnit AS unit
                                        FROM
                                            factory_rawMaterial_data
                                    ) AS pd
                                    ON
                                    sp.rawMaterialId = pd.rawMaterialId
                                    LEFT JOIN(
                                        SELECT
                                            rawMaterialId,
                                            rmStockInDate,
                                            rawMaterialQty,
                                            rawMaterialPrice
                                        FROM
                                            factory_rmStockIn_data
                                        WHERE
                                            (rawMaterialId, rmStockInCreationDate) IN(
                                                SELECT
                                                rawMaterialId,
                                                MAX(rmStockInCreationDate)
                                            FROM
                                                factory_rmStockIn_data
                                            WHERE
                                                factory_rmStockIn_data.rmSupplierId = '${data.rmSupplierId}'
                                            GROUP BY
                                                rawMaterialId
                                            )
                                    ) AS siLu
                                    ON
                                    sp.rawMaterialId = siLu.rawMaterialId`;
            if (req.query.startDate && req.query.endDate) {
                sql_querry_getAllProductBysupplier = `${commaonQuery}
                                                        LEFT JOIN(
                                                            SELECT
                                                                factory_rmStockIn_data.rawMaterialId,
                                                            ROUND(SUM(
                                                                factory_rmStockIn_data.rawMaterialQty
                                                            ),2) AS total_quantity,
                                                            ROUND(SUM(
                                                                factory_rmStockIn_data.totalPrice
                                                            )) AS total_expense
                                                            FROM
                                                                factory_rmStockIn_data
                                                            WHERE
                                                                factory_rmStockIn_data.rmSupplierId = '${data.rmSupplierId}' AND factory_rmStockIn_data.rmStockInDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')
                                                            GROUP BY
                                                                factory_rmStockIn_data.rawMaterialId
                                                        ) AS si
                                                        ON
                                                        sp.rawMaterialId = si.rawMaterialId
                                                        WHERE sp.rmSupplierId = '${data.rmSupplierId}'
                                                        ORDER BY pd.rawMaterialName`;
            } else {
                sql_querry_getAllProductBysupplier = `${commaonQuery}
                                                        LEFT JOIN(
                                                              SELECT
                                                                  factory_rmStockIn_data.rawMaterialId,
                                                              ROUND(SUM(
                                                                  factory_rmStockIn_data.rawMaterialQty
                                                              ),2) AS total_quantity,
                                                              ROUND(SUM(
                                                                  factory_rmStockIn_data.totalPrice
                                                              )) AS total_expense
                                                              FROM
                                                                factory_rmStockIn_data
                                                              WHERE
                                                                factory_rmStockIn_data.rmSupplierId = '${data.rmSupplierId}' AND factory_rmStockIn_data.rmStockInDate BETWEEN STR_TO_DATE('${firstDay}','%b %d %Y') AND STR_TO_DATE('${lastDay}','%b %d %Y')
                                                              GROUP BY
                                                                  factory_rmStockIn_data.rawMaterialId
                                                          ) AS si
                                                        ON
                                                          sp.rawMaterialId = si.rawMaterialId
                                                          WHERE sp.rmSupplierId = '${data.rmSupplierId}'
                                                          ORDER BY pd.rawMaterialName`;
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
                                    "Raw Material": e.rawMaterialName,
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

module.exports = {
    getFactorySupplierCounterDetailsById,
    getRawMaterialsBySupplierId,
    getAllRawMaterialsBySupplierId,
    getFactorySupplierdata,
    getFactorySupplierDetailsById,
    addFactorySupplierDetails,
    removeFactorySupplierDetails,
    fillFactorySupplierDetails,
    updateFactorySupplierDetails,
    exportExcelSheetForAllRawMaterialsBySupplierId,
    getFactorySupplierAllData,
    exportPdfForAllRawMaterialsBySupplierId
}

