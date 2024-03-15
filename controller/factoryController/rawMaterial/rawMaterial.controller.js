const pool = require('../../../database');
const excelJS = require("exceljs");
const jwt = require("jsonwebtoken");
const { jsPDF } = require('jspdf');
require('jspdf-autotable');
const { processDatas } = require("./rmConversation.controller");
const { newConversationAsync } = require("./rmConversation.controller");
const { computeConversionFactors } = require("./rmConversation.controller");
const { raw } = require('mysql');


// Get Raw Material Counter Details

const getRowMaterialCountDetailsById = (req, res) => {
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
                rawMaterialId: req.query.rawMaterialId
            }
            const sql_querry_StatickCCount = `SELECT
                                                p.minRawMaterialQty,
                                                p.minRawMaterialUnit,
                                                COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) AS remainingStock,
                                                COALESCE(ROUND(siLu.rawMaterialPrice,2), 0) AS lastPrice,
                                                COALESCE(si.total_siPrice, 0) - COALESCE(so.total_soPrice, 0) AS remainPrice
                                              FROM
                                                factory_rawMaterial_data AS p
                                              LEFT JOIN(
                                                SELECT
                                                    factory_rmStockIn_data.rawMaterialId,
                                                    ROUND(SUM(
                                                        factory_rmStockIn_data.rawMaterialQty
                                                    ),2) AS total_quantity,
                                                    ROUND(SUM(
                                                    factory_rmStockIn_data.totalPrice
                                                    )) AS total_siPrice
                                                FROM
                                                    factory_rmStockIn_data
                                                GROUP BY
                                                    factory_rmStockIn_data.rawMaterialId
                                              ) AS si
                                              ON
                                                p.rawMaterialId = si.rawMaterialId
                                              LEFT JOIN(
                                                   SELECT
                                                      factory_rmStockOut_data.rawMaterialId,
                                                      ROUND(SUM(
                                                          factory_rmStockOut_data.rawMaterialQty
                                                      ),2) AS total_quantity,
                                                      ROUND(SUM(
                                                          factory_rmStockOut_data.rmStockOutPrice
                                                      )) AS total_soPrice
                                                  FROM
                                                      factory_rmStockOut_data
                                                  GROUP BY
                                                      factory_rmStockOut_data.rawMaterialId
                                              ) AS so
                                              ON
                                                p.rawMaterialId = so.rawMaterialId
                                              LEFT JOIN(
                                                  SELECT
                                                      rawMaterialId,
                                                      rmStockInDate,
                                                      rawMaterialQty,
                                                      rawMaterialPrice
                                                  FROM
                                                      factory_rmStockIn_data
                                                  WHERE (rawMaterialId, rmStockInCreationDate) IN(
                                                      SELECT
                                                          rawMaterialId,
                                                          MAX(rmStockInCreationDate)
                                                      FROM
                                                          factory_rmStockIn_data
                                                      GROUP BY
                                                          rawMaterialId
                                                  )
                                              ) AS siLu
                                             ON
                                                p.rawMaterialId = siLu.rawMaterialId
                                             WHERE p.rawMaterialId = '${data.rawMaterialId}'`;
            if (req.query.startDate && req.query.endDate) {
                sql_querry_getRmCount = `SELECT COALESCE(ROUND(SUM(rawMaterialQty),2),0) AS purchase, COALESCE(ROUND(SUM(totalPrice)),0) AS totalRs FROM factory_rmStockIn_data WHERE factory_rmStockIn_data.rawMaterialId = '${data.rawMaterialId}'  AND factory_rmStockIn_data.rmStockInDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y');
                                         SELECT COALESCE(ROUND(SUM(rawMaterialQty),2),0) AS used, COALESCE(ROUND(SUM(rmStockOutPrice)),0) AS totalUsedPrice FROM factory_rmStockOut_data WHERE factory_rmStockOut_data.rawMaterialId = '${data.rawMaterialId}' AND factory_rmStockOut_data.rmStockOutDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y');
                                         ${sql_querry_StatickCCount}`;
            } else {
                sql_querry_getRmCount = `SELECT COALESCE(ROUND(SUM(rawMaterialQty),2),0) AS purchase, COALESCE(ROUND(SUM(totalPrice)),0) AS totalRs FROM factory_rmStockIn_data WHERE factory_rmStockIn_data.rawMaterialId = '${data.rawMaterialId}' AND factory_rmStockIn_data.rmStockInDate BETWEEN STR_TO_DATE('${firstDay}','%b %d %Y') AND STR_TO_DATE('${lastDay}','%b %d %Y');
                                         SELECT COALESCE(ROUND(SUM(rawMaterialQty),2),0) AS used, COALESCE(ROUND(SUM(rmStockOutPrice)),0) AS totalUsedPrice FROM factory_rmStockOut_data WHERE factory_rmStockOut_data.rawMaterialId = '${data.rawMaterialId}' AND factory_rmStockOut_data.rmStockOutDate BETWEEN STR_TO_DATE('${firstDay}','%b %d %Y') AND STR_TO_DATE('${lastDay}','%b %d %Y');
                                         ${sql_querry_StatickCCount}`;
            }
            pool.query(sql_querry_getRmCount, (err, results) => {
                if (err) {
                    console.error("An error occurd in SQL Queery", err);
                    return res.status(500).send('Database Error');
                }
                else {
                    const datas = [
                        {
                            rawMaterialId: req.query.rawMaterialId,
                            remainingStock: results[0][0].purchase,
                            minRawMaterialUnit: results[2][0].minRawMaterialUnit
                        },
                        {
                            rawMaterialId: req.query.rawMaterialId,
                            remainingStock: results[1][0].used,
                            minRawMaterialUnit: results[2][0].minRawMaterialUnit
                        },
                        {
                            rawMaterialId: req.query.rawMaterialId,
                            remainingStock: results[2][0].remainingStock,
                            minRawMaterialUnit: results[2][0].minRawMaterialUnit
                        }
                    ]
                    processDatas(datas)
                        .then((data) => {
                            // const convertedQuantities = data.map(item => ({ convertedQuantity: item.convertedQuantity }));
                            const convertedQuantities = data.map((item, index) => {
                                let keyName;
                                if (index === 0) {
                                    keyName = "totalPurchase";
                                } else if (index === 1) {
                                    keyName = "totalUsed";
                                } else if (index === 2) {
                                    keyName = "remainingStock";
                                }

                                return { [keyName]: item.convertedQuantity };
                            });
                            let totalRs = results[0][0].totalRs;
                            let totalUsedPrice = results[1][0].totalUsedPrice;
                            let remainUsedPrice = results[2][0].remainingStock != 0 ? results[2][0].remainPrice : 0;
                            let lastPrice = results[2][0].lastPrice;
                            let minRawMaterialQty = results[2][0].minRawMaterialQty;

                            convertedQuantities.push(
                                { totalRs: totalRs },
                                { totalUsedPrice: totalUsedPrice },
                                { remainUsedPrice: remainUsedPrice },
                                { lastPrice: lastPrice },
                                { minRawMaterialQty: minRawMaterialQty },
                                { allUnitConversation: data[2].vikJson }
                            );
                            const combinedObject = Object.assign({}, ...convertedQuantities.map(obj => ({ ...obj })));

                            return res.status(200).send(combinedObject);
                        }).catch(error => {
                            console.error('Error in processing datas:', error);
                            return res.status(500).send('Internal Error');
                        });
                }
            })

        } else {
            return res.status(401).send("Please Login Firest.....!");
        }
    } catch (error) {
        console.error('An error occurd', error);
        res.status(500).json('Internal Server Error');
    }
}

// Get Raw Material wise Supplier Api

const getSupplierByRawMaterialId = (req, res) => {
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
                rawMaterialId: req.query.rawMaterialId
            }
            if (req.query.startDate && req.query.endDate) {
                var sql_querry_getSupplierByProductId = `SELECT
                                                                factory_supplier_data.supplierNickName,
                                                                ispd.rawMaterialId,
                                                                ipd.minRawMaterialUnit,
                                                                COALESCE(si.quantity,0) AS remainingStock,
                                                                COALESCE(si.expense,0) AS expense
                                                            FROM
                                                                factory_supplierProducts_data AS ispd
                                                            INNER JOIN factory_rawMaterial_data AS ipd ON ipd.rawMaterialId = ispd.rawMaterialId
                                                            INNER JOIN factory_supplier_data ON factory_supplier_data.rmSupplierId = ispd.rmSupplierId
                                                            LEFT JOIN
                                                                (
                                                                    SELECT
                                                                        factory_rmStockIn_data.rmSupplierId,
                                                                        ROUND(SUM(
                                                                            factory_rmStockIn_data.rawMaterialQty
                                                                        ),2) AS quantity,
                                                                        ROUND(SUM(
                                                                            factory_rmStockIn_data.totalPrice
                                                                        )) AS expense
                                                                    FROM
                                                                        factory_rmStockIn_data
                                                                    WHERE
                                                                        rawMaterialId = '${data.rawMaterialId}' AND factory_rmStockIn_data.rmStockInDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')
                                                                    GROUP BY
                                                                        factory_rmStockIn_data.rmSupplierId
                                                                ) AS si
                                                                ON
                                                                    ispd.rmSupplierId = si.rmSupplierId
                                                            WHERE ispd.rawMaterialId = '${data.rawMaterialId}'
                                                            ORDER BY si.expense DESC`;
            } else {
                var sql_querry_getSupplierByProductId = `SELECT
                                                                factory_supplier_data.supplierNickName,
                                                                ispd.rawMaterialId,
                                                                ipd.minRawMaterialUnit,
                                                                COALESCE(si.quantity,0) AS remainingStock,
                                                                COALESCE(si.expense,0) AS expense
                                                            FROM
                                                                factory_supplierProducts_data AS ispd
                                                            INNER JOIN factory_rawMaterial_data AS ipd ON ipd.rawMaterialId = ispd.rawMaterialId
                                                            INNER JOIN factory_supplier_data ON factory_supplier_data.rmSupplierId = ispd.rmSupplierId
                                                            LEFT JOIN
                                                                (
                                                                    SELECT
                                                                        factory_rmStockIn_data.rmSupplierId,
                                                                        ROUND(SUM(
                                                                            factory_rmStockIn_data.rawMaterialQty
                                                                        ),2) AS quantity,
                                                                        ROUND(SUM(
                                                                            factory_rmStockIn_data.totalPrice
                                                                        )) AS expense
                                                                    FROM
                                                                        factory_rmStockIn_data
                                                                    WHERE
                                                                        rawMaterialId = '${data.rawMaterialId}' AND factory_rmStockIn_data.rmStockInDate BETWEEN STR_TO_DATE('${firstDay}','%b %d %Y') AND STR_TO_DATE('${lastDay}','%b %d %Y')
                                                                    GROUP BY
                                                                        factory_rmStockIn_data.rmSupplierId
                                                                ) AS si
                                                                ON
                                                                    ispd.rmSupplierId = si.rmSupplierId
                                                            WHERE ispd.rawMaterialId = '${data.rawMaterialId}'
                                                            ORDER BY si.expense DESC`;
            }
            pool.query(sql_querry_getSupplierByProductId, (err, result) => {
                if (err) {
                    console.error("An error occurd in SQL Queery", err);
                    return res.status(500).send('Database Error');
                }
                const datas = Object.values(JSON.parse(JSON.stringify(result)));
                processDatas(datas)
                    .then((data) => {
                        const rows = datas ? datas.map((element, index) => data[index] && data[index].convertedQuantity ? { ...element, remainingStock: data[index].convertedQuantity } : { ...element, remainingStock: element.remainingStock + ' ' + element.minRawMaterialUnit },
                        ) : []
                        return res.status(200).send(rows);
                    }).catch(error => {
                        console.error('Error in processing datas:', error);
                        return res.status(500).send('Internal Error');
                    });
            })

        } else {
            return res.status(401).send("Please Login Firest.....!");
        }
    } catch (error) {
        console.error('An error occurd', error);
        res.status(500).json('Internal Server Error');
    }
}

// Raw Material List API

const getRawMaterialList = (req, res) => {
    try {
        let token;
        token = req.headers.authorization ? req.headers.authorization.split(" ")[1] : null;
        if (token) {
            req.query.rawMaterialStatus
            const sql_querry_getProductListwithStatus = `SELECT
                                                         p.rawMaterialId,
                                                         UPPER(p.rawMaterialName) AS rawMaterialName,
                                                         p.minRawMaterialQty,
                                                         p.minRawMaterialUnit,
                                                         COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) AS remainingStock,
                                                         COALESCE(siLu.rawMaterialPrice, 0) AS lastPrice,
                                                         COALESCE(siLu.rawMaterialQty, 0) AS lastUpdatedQty,
                                                         COALESCE(
                                                             DATE_FORMAT(siLu.rmStockInDate, '%d-%m-%Y'),
                                                             "No Update"
                                                         ) AS lastUpdatedStockInDate,
                                                         CASE WHEN COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) >= p.minRawMaterialQty THEN 'In Stock' WHEN COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) < p.minRawMaterialQty AND COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) != 0 THEN 'Under Stocked' ELSE 'Out of Stock'
                                                     END AS stockStatus
                                                     FROM
                                                         factory_rawMaterial_data AS p
                                                     LEFT JOIN(
                                                         SELECT factory_rmStockIn_data.rawMaterialId,
                                                             ROUND(SUM(
                                                                 factory_rmStockIn_data.rawMaterialQty
                                                             ),2) AS total_quantity
                                                         FROM
                                                             factory_rmStockIn_data
                                                         GROUP BY
                                                             factory_rmStockIn_data.rawMaterialId
                                                     ) AS si
                                                     ON
                                                         p.rawMaterialId = si.rawMaterialId
                                                     LEFT JOIN(
                                                         SELECT factory_rmStockOut_data.rawMaterialId,
                                                             ROUND(SUM(
                                                                 factory_rmStockOut_data.rawMaterialQty
                                                             ),2) AS total_quantity
                                                         FROM
                                                             factory_rmStockOut_data
                                                         GROUP BY
                                                             factory_rmStockOut_data.rawMaterialId
                                                     ) AS so
                                                     ON
                                                         p.rawMaterialId = so.rawMaterialId
                                                     LEFT JOIN(
                                                         SELECT rawMaterialId,
                                                                rmStockInDate,
                                                                rawMaterialQty,
                                                                rawMaterialPrice
                                                         FROM
                                                             factory_rmStockIn_data
                                                         WHERE (rawMaterialId, rmStockInCreationDate) IN(
                                                             SELECT
                                                                 rawMaterialId,
                                                                 MAX(rmStockInCreationDate)
                                                             FROM
                                                                 factory_rmStockIn_data
                                                             GROUP BY
                                                                 rawMaterialId
                                                         )
                                                     ) AS siLu
                                                     ON
                                                        p.rawMaterialId = siLu.rawMaterialId`;
            if (req.query.rawMaterialStatus == 1) {
                sql_querry_getProductList = `${sql_querry_getProductListwithStatus}
                                            WHERE COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) >= p.minRawMaterialQty 
                                            ORDER BY p.rawMaterialName`;
            } else if (req.query.rawMaterialStatus == 2) {
                sql_querry_getProductList = `${sql_querry_getProductListwithStatus}
                                            WHERE COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) < p.minRawMaterialQty AND COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) != 0 
                                            ORDER BY p.rawMaterialName`;
            } else if (req.query.rawMaterialStatus == 3) {
                sql_querry_getProductList = `${sql_querry_getProductListwithStatus}
                                            WHERE COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) = 0
                                            ORDER BY p.rawMaterialName`;
            } else {
                sql_querry_getProductList = `${sql_querry_getProductListwithStatus}
                                            ORDER BY p.rawMaterialName`;
            }
            pool.query(sql_querry_getProductList, (err, data) => {
                if (err) {
                    console.error("An error occurd in SQL Queery", err);
                    return res.status(500).send('Database Error');
                }
                else if (data == '') {
                    return res.status(400).send('No Data Available');
                } else {
                    return res.status(200).send(data);
                }
            })
        } else {
            return res.status(401).send("Please Login Firest.....!");
        }
    } catch (error) {
        console.error('An error occurd', error);
        res.status(500).json('Internal Server Error');
    }
}

// Raw Material List Counter

const getRawMaterialListCounter = (req, res) => {
    try {
        let token;
        token = req.headers.authorization ? req.headers.authorization.split(" ")[1] : null;
        if (token) {
            const rawMaterialCategoryId = req && req.query.rawMaterialCategoryId ? req.query.rawMaterialCategoryId : null;
            var sql_querry_joins = `LEFT JOIN
                                    (
                                        SELECT
                                            factory_rmStockIn_data.rawMaterialId,
                                            ROUND(SUM(factory_rmStockIn_data.rawMaterialQty),2) AS total_quantity
                                        FROM
                                            factory_rmStockIn_data
                                        GROUP BY
                                            factory_rmStockIn_data.rawMaterialId
                                    ) AS si ON p.rawMaterialId = si.rawMaterialId
                                  LEFT JOIN
                                    (
                                        SELECT
                                            factory_rmStockOut_data.rawMaterialId,
                                            ROUND(SUM(factory_rmStockOut_data.rawMaterialQty),2) AS total_quantity
                                        FROM
                                            factory_rmStockOut_data
                                        GROUP BY
                                            factory_rmStockOut_data.rawMaterialId
                                    ) AS so ON p.rawMaterialId = so.rawMaterialId`;
            if (rawMaterialCategoryId) {
                sql_querry_getProductList = `SELECT COUNT(*) AS inStockRawMaterial
                                        FROM
                                            factory_rawMaterial_data AS p
                                        ${sql_querry_joins}
                                        WHERE p.rawMaterialCategoryId = '${rawMaterialCategoryId}' AND COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) >= p.minRawMaterialQty;
                                        SELECT COUNT(*) AS underStockedRawMaterial
                                        FROM
                                            factory_rawMaterial_data AS p
                                        ${sql_querry_joins}
                                           WHERE p.rawMaterialCategoryId = '${rawMaterialCategoryId}' AND COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) < p.minRawMaterialQty AND COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) != 0;
                                           SELECT COUNT(*) AS outOfStockRawMaterial
                                        FROM
                                            factory_rawMaterial_data AS p
                                        ${sql_querry_joins}
                                        WHERE p.rawMaterialCategoryId = '${rawMaterialCategoryId}' AND p.rawMaterialCategoryId = '${rawMaterialCategoryId}' AND COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) = 0;
                                        SELECT COUNT(*) AS allRawMaterial
                                        FROM
                                            factory_rawMaterial_data AS p
                                        ${sql_querry_joins}
                                        WHERE p.rawMaterialCategoryId = '${rawMaterialCategoryId}'`;
            } else {
                sql_querry_getProductList = `SELECT COUNT(*) AS inStockRawMaterial
                                        FROM
                                            factory_rawMaterial_data AS p
                                        ${sql_querry_joins}
                                        WHERE COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) >= p.minRawMaterialQty;
                                        SELECT COUNT(*) AS underStockedRawMaterial
                                        FROM
                                            factory_rawMaterial_data AS p
                                        ${sql_querry_joins}
                                           WHERE COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) < p.minRawMaterialQty AND COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) != 0;
                                           SELECT COUNT(*) AS outOfStockRawMaterial
                                        FROM
                                            factory_rawMaterial_data AS p
                                        ${sql_querry_joins}
                                        WHERE COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) = 0;
                                        SELECT COUNT(*) AS allRawMaterial
                                        FROM
                                            factory_rawMaterial_data AS p
                                        ${sql_querry_joins}`;
            }
            pool.query(sql_querry_getProductList, (err, data) => {
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
                        instockProduct: data[0][0].inStockRawMaterial,
                        underStockedRawMaterial: data[1][0].underStockedRawMaterial,
                        outOfStock: data[2][0].outOfStockRawMaterial,
                        allRawMaterial: data[3][0].allRawMaterial
                    }
                    return res.status(200).send(count);
                }
            })
        } else {
            return res.status(401).send("Please Login Firest.....!");
        }
    } catch (error) {
        console.error('An error occurd', error);
        res.status(500).json('Internal Server Error');
    }
}

// Add Raw Material API

const addRawMaterial = async (req, res) => {
    try {
        const uid1 = new Date();
        const rawMaterialId = String("rawMaterial_" + uid1.getTime());
        const priorityArray = req.body.priorityArray;
        const data = {
            productCategoryId: req.body.productCategoryId,
            rawMaterialCategoryId: req.body.rawMaterialCategoryId,
            rawMaterialName: req.body.rawMaterialName.trim(),
            gujaratiRawMaterialName: req.body.gujaratiRawMaterialName,
            minRawMaterialQty: req.body.minRawMaterialQty,
            minRawMaterialUnit: req.body.minRawMaterialUnit.trim(),
            leadTime: req.body.leadTime ? req.body.leadTime : 0,
            isQtyNum: req.body.isQtyNum ? req.body.isQtyNum : false,
            isExpired: req.body.isExpired ? req.body.isExpired : false,
            expiredDays: req.body.expiredDays ? req.body.expiredDays : 0,
            isSupplayBranch: req.body.isSupplayBranch ? req.body.isSupplayBranch : false
        }
        if (!data.rawMaterialName || !data.rawMaterialCategoryId || !data.minRawMaterialQty || !data.minRawMaterialUnit) {
            return res.status(400).send("Please Fill All The Fields");
        } else {
            req.body.rawMaterialName = pool.query(`SELECT rawMaterialName FROM factory_rawMaterial_data WHERE rawMaterialName = '${data.rawMaterialName}'`, function (err, row) {
                if (err) {
                    console.error("An error occurd in SQL Queery", err);
                    return res.status(500).send('Database Error');
                }
                if (row && row.length) {
                    return res.status(400).send('Raw Material is Already In Use');
                } else {
                    const sql_querry_addUser = `INSERT INTO factory_rawMaterial_data(rawMaterialId, rawMaterialCategoryId, rawMaterialName, gujaratiRawMaterialName, minRawMaterialQty, minRawMaterialUnit, leadTime, isSupplyBranch, isQtyNum, isExpired, expiredDays)
                                                VALUES('${rawMaterialId}', '${data.rawMaterialCategoryId}', '${data.rawMaterialName}',  ${data.gujaratiRawMaterialName ? `'${data.gujaratiRawMaterialName}'` : null},  ${data.minRawMaterialQty}, '${data.minRawMaterialUnit}', ${data.leadTime}, ${data.isSupplayBranch}, ${data.isQtyNum}, ${data.isExpired}, ${data.isExpired ? `${data.expiredDays}` : 0});
                                                ${data.isSupplayBranch && data.isSupplayBranch == true ? `INSERT INTO inventory_product_data(productId, productCategoryId, productName, gujaratiProductName, minProductQty, minProductUnit, leadTime, isExpired, expiredDays)
                                                VALUES('${rawMaterialId}', '${data.productCategoryId}', '${data.rawMaterialName}',  ${data.gujaratiRawMaterialName ? `'${data.gujaratiRawMaterialName}'` : null},  ${data.minRawMaterialQty}, '${data.minRawMaterialUnit}', ${data.leadTime}, ${data.isExpired}, ${data.isExpired ? `${data.expiredDays}` : 0});
                                                INSERT INTO inventory_supplierProducts_data(supplierId, productId)
                                                VALUES('${process.env.RAJ_MANDIR_FACTORY_ID}','${rawMaterialId}')` : ''}`;
                    pool.query(sql_querry_addUser, (err, result) => {
                        if (err) {
                            console.error("An error occurd in SQL Queery", err);
                            return res.status(500).send('Database Error');
                        }
                        if (priorityArray.length != 0 && priorityArray) {
                            let addPriorityData = priorityArray.map((item, index) => {
                                let uniqueId = `PriorityId_${Date.now() + index}`; // Generating a unique ID using current timestamp
                                let priorityNumber = index + 1; // Define Priority Number
                                return `('${uniqueId}', '${rawMaterialId}', ${priorityNumber}, '${item.bigUnitName}', ${item.unitNumber}, '${item.smallUnitName}')`;
                            }).join(', ');

                            const sql_querry_addPriority = `INSERT INTO factory_rmUnit_preference (preferenceId, rawMaterialId, priorityNumber, bigUnitName, unitNumber, smallUnitName)
                                                            VALUES ${addPriorityData};
                                                            ${data.isSupplayBranch && data.isSupplayBranch == true ? `INSERT INTO product_unit_preference (preferenceId, productId, priorityNumber, bigUnitName, unitNumber, smallUnitName)
                                                                                                                      VALUES ${addPriorityData}` : ''}`;
                            pool.query(sql_querry_addPriority, (err, result) => {
                                if (err) {
                                    console.error("An error occurd in SQL Queery", err);
                                    return res.status(500).send('Database Error');
                                }
                                return res.status(200).send("Raw Material Added Successfully");
                            });
                        } else {
                            return res.status(200).send("Raw Material Added Successfully");
                        }
                    })
                }
            })
        }
    } catch (error) {
        console.error('An error occurd', error);
        res.status(500).send('Internal Server Error');
    }
}

// get Raw Material Details Table

const getRawMaterialTable = (req, res) => {
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

            const data = {
                startDate: (req.query.startDate ? req.query.startDate : '').slice(4, 15),
                endDate: (req.query.endDate ? req.query.endDate : '').slice(4, 15),
                rawMaterialStatus: req.query.rawMaterialStatus,
                searchRawMaterial: req.query.searchRawMaterial,
                rawMaterialCategoryId: req.query.rawMaterialCategoryId
            }
            const sql_querry_staticQuery = `SELECT
                                                p.rawMaterialId,
                                                UCASE(p.rawMaterialName) AS rawMaterialName,
                                                p.minRawMaterialQty,
                                                p.minRawMaterialUnit,
                                                CONCAT(p.leadTime,' ','Day') AS leadTime,
                                                p.isSupplyBranch,
                                                p.isExpired,
                                                CONCAT(p.expiredDays,' ','Day') AS expiredDays,
                                                COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) AS remainingStock,
                                                COALESCE(siLu.rawMaterialPrice, 0) AS lastPrice,
                                                COALESCE(siLu.rawMaterialQty, 0) AS lastUpdatedQty,
                                                COALESCE(
                                                    DATE_FORMAT(siLu.rmStockInDate, '%d-%m-%Y'),
                                                    "No Update"
                                                ) AS lastUpdatedStockInDate,
                                                CASE WHEN COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) >= p.minRawMaterialQty THEN 'In-Stock' WHEN COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) < p.minRawMaterialQty AND COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) != 0 THEN 'Low-Stock' ELSE 'Out-Stock'
                                            END AS stockStatus
                                            FROM
                                                factory_rawMaterial_data AS p
                                            LEFT JOIN(
                                                SELECT
                                                    factory_rmStockIn_data.rawMaterialId,
                                                    ROUND(SUM(
                                                        factory_rmStockIn_data.rawMaterialQty
                                                    ),2) AS total_quantity
                                                FROM
                                                    factory_rmStockIn_data
                                                GROUP BY
                                                    factory_rmStockIn_data.rawMaterialId
                                            ) AS si
                                            ON
                                                p.rawMaterialId = si.rawMaterialId
                                            LEFT JOIN(
                                                SELECT
                                                    factory_rmStockOut_data.rawMaterialId,
                                                    ROUND(SUM(
                                                        factory_rmStockOut_data.rawMaterialQty
                                                    ),2) AS total_quantity
                                                FROM
                                                    factory_rmStockOut_data
                                                GROUP BY
                                                    factory_rmStockOut_data.rawMaterialId
                                            ) AS so
                                            ON
                                                p.rawMaterialId = so.rawMaterialId
                                            LEFT JOIN(
                                                SELECT
                                                    rawMaterialId,
                                                    rmStockInDate,
                                                    rawMaterialQty,
                                                    rawMaterialPrice
                                                FROM
                                                    factory_rmStockIn_data
                                                WHERE (rawMaterialId, rmStockInCreationDate) IN(
                                                    SELECT
                                                        rawMaterialId,
                                                        MAX(rmStockInCreationDate)
                                                    FROM
                                                        factory_rmStockIn_data
                                                    GROUP BY
                                                        rawMaterialId
                                                )
                                            ) AS siLu
                                            ON
                                                p.rawMaterialId = siLu.rawMaterialId`;
            const sql_querry_getMwSiSO = `SELECT
                                                p.rawMaterialId,
                                                UCASE(p.rawMaterialName) AS rawMaterialName,
                                                p.minRawMaterialQty,
                                                p.minRawMaterialUnit,
                                                CONCAT(p.leadTime,' ','Day') AS leadTime,
                                                p.isSupplyBranch,
                                                p.isExpired,
                                                CONCAT(p.expiredDays,' ','Day') AS expiredDays,
                                                COALESCE(simw.total_quantity, 0) AS purchese,
                                                COALESCE(somw.total_quantity, 0) AS totalUsed,
                                                COALESCE(simw.totalExpense,0) AS totalExpense,
                                                COALESCE(somw.totalStockOutPrice,0) AS totalStockOutPrice,
                                                COALESCE(si.total_siPrice, 0) - COALESCE(so.total_soPrice, 0) AS remainPrice,
                                                COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) AS remainingStock,
                                                COALESCE(siLu.rawMaterialPrice, 0) AS lastPrice,
                                                COALESCE(siLu.rawMaterialQty, 0) AS lastUpdatedQty,
                                                COALESCE(
                                                    DATE_FORMAT(siLu.rmStockInDate, '%d-%m-%Y'),
                                                    "No Update"
                                                ) AS lastUpdatedStockInDate,
                                                CASE WHEN COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) >= p.minRawMaterialQty THEN 'In-Stock' WHEN COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) < p.minRawMaterialQty AND COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) != 0 THEN 'Low-Stock' ELSE 'Out-Stock'
                                            END AS stockStatus
                                            FROM
                                                factory_rawMaterial_data AS p
                                            LEFT JOIN(
                                                SELECT
                                                    factory_rmStockIn_data.rawMaterialId,
                                                    ROUND(SUM(
                                                        factory_rmStockIn_data.rawMaterialQty
                                                    ),2) AS total_quantity,
                                                    ROUND(SUM(
                                                        factory_rmStockIn_data.totalPrice
                                                    ),2) AS total_siPrice
                                                FROM
                                                    factory_rmStockIn_data
                                                GROUP BY
                                                    factory_rmStockIn_data.rawMaterialId
                                            ) AS si
                                            ON
                                                p.rawMaterialId = si.rawMaterialId
                                            LEFT JOIN(
                                                SELECT
                                                    factory_rmStockOut_data.rawMaterialId,
                                                    ROUND(SUM(
                                                        factory_rmStockOut_data.rawMaterialQty
                                                    ),2) AS total_quantity,
                                                    ROUND(SUM(
                                                        factory_rmStockOut_data.rmStockOutPrice
                                                    ),2) AS total_soPrice
                                                FROM
                                                    factory_rmStockOut_data
                                                GROUP BY
                                                    factory_rmStockOut_data.rawMaterialId
                                            ) AS so
                                            ON
                                                p.rawMaterialId = so.rawMaterialId
                                            LEFT JOIN(
                                                SELECT
                                                    rawMaterialId,
                                                    rmStockInDate,
                                                    rawMaterialQty,
                                                    rawMaterialPrice
                                                FROM
                                                    factory_rmStockIn_data
                                                WHERE (rawMaterialId, rmStockInCreationDate) IN(
                                                    SELECT
                                                        rawMaterialId,
                                                        MAX(rmStockInCreationDate) As lastDate
                                                    FROM
                                                        factory_rmStockIn_data
                                                    GROUP BY
                                                        rawMaterialId
                                                )
                                            ) AS siLu
                                            ON
                                                p.rawMaterialId = siLu.rawMaterialId`;
            const sql_querry_joins = `LEFT JOIN
                                                    (
                                                        SELECT
                                                            factory_rmStockIn_data.rawMaterialId,
                                                            ROUND(SUM(factory_rmStockIn_data.rawMaterialQty),2) AS total_quantity
                                                        FROM
                                                            factory_rmStockIn_data
                                                        GROUP BY
                                                            factory_rmStockIn_data.rawMaterialId
                                                    ) AS si ON p.rawMaterialId = si.rawMaterialId
                                          LEFT JOIN
                                                    (
                                                        SELECT
                                                            factory_rmStockOut_data.rawMaterialId,
                                                            ROUND(SUM(factory_rmStockOut_data.rawMaterialQty),2) AS total_quantity
                                                        FROM
                                                            factory_rmStockOut_data
                                                        GROUP BY
                                                            factory_rmStockOut_data.rawMaterialId
                                                    ) AS so ON p.rawMaterialId = so.rawMaterialId`;
            if (req.query.rawMaterialCategoryId) {
                if (req.query.rawMaterialStatus == 1) {
                    sql_get_pagination = `SELECT COUNT(*) AS numRows FROM factory_rawMaterial_data AS p
                                                ${sql_querry_joins}
                                                WHERE p.rawMaterialCategoryId = '${data.rawMaterialCategoryId}' AND COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) >= p.minRawMaterialQty`;
                } else if (req.query.rawMaterialStatus == 2) {
                    sql_get_pagination = `SELECT COUNT(*) AS numRows FROM factory_rawMaterial_data AS p
                                                ${sql_querry_joins}
                                                WHERE p.rawMaterialCategoryId = '${data.rawMaterialCategoryId}' AND COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) < p.minRawMaterialQty AND COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) != 0`;
                } else if (req.query.rawMaterialStatus == 3) {
                    sql_get_pagination = `SELECT COUNT(*) AS numRows FROM factory_rawMaterial_data AS p
                                                ${sql_querry_joins}
                                                WHERE p.rawMaterialCategoryId = '${data.rawMaterialCategoryId}' AND COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) = 0`;
                } else if (req.query.startDate && req.query.endDate && req.query.searchRawMaterial) {
                    sql_get_pagination = `SELECT COUNT(*) AS numRows FROM factory_rawMaterial_data AS p
                                        ${sql_querry_joins}
                                        LEFT JOIN(
                                            SELECT
                                                factory_rmStockIn_data.rawMaterialId,
                                                ROUND(SUM(
                                                    factory_rmStockIn_data.rawMaterialQty
                                                ),2) AS total_quantity,
                                                ROUND(SUM(
                                                    factory_rmStockIn_data.totalPrice
                                                )) AS totalExpense
                                            FROM
                                                factory_rmStockIn_data
                                            WHERE
                                                factory_rmStockIn_data.rmStockInDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')
                                            GROUP BY
                                                factory_rmStockIn_data.rawMaterialId
                                        ) AS simw
                                        ON
                                            p.rawMaterialId = simw.rawMaterialId
                                        LEFT JOIN(
                                            SELECT
                                                factory_rmStockOut_data.rawMaterialId,
                                                ROUND(SUM(
                                                    factory_rmStockOut_data.rawMaterialQty
                                                ),2) AS total_quantity
                                            FROM
                                                factory_rmStockOut_data
                                            WHERE
                                                factory_rmStockOut_data.rmStockOutDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')
                                            GROUP BY
                                                factory_rmStockOut_data.rawMaterialId
                                        ) AS somw
                                        ON
                                            p.rawMaterialId = somw.rawMaterialId
                                        WHERE p.rawMaterialCategoryId = '${data.rawMaterialCategoryId}' AND p.rawMaterialName LIKE '%` + data.searchRawMaterial + `%'`;
                } else if (req.query.startDate && req.query.endDate) {
                    sql_get_pagination = `SELECT COUNT(*) AS numRows FROM factory_rawMaterial_data AS p
                                        ${sql_querry_joins}
                                        LEFT JOIN(
                                            SELECT
                                                factory_rmStockIn_data.rawMaterialId,
                                                ROUND(SUM(
                                                    factory_rmStockIn_data.rawMaterialQty
                                                ),2) AS total_quantity,
                                                ROUND(SUM(
                                                    factory_rmStockIn_data.totalPrice
                                                )) AS totalExpense
                                            FROM
                                                factory_rmStockIn_data
                                            WHERE
                                                factory_rmStockIn_data.rmStockInDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')
                                            GROUP BY
                                                factory_rmStockIn_data.rawMaterialId
                                        ) AS simw
                                        ON
                                            p.rawMaterialId = simw.rawMaterialId
                                        LEFT JOIN(
                                            SELECT
                                                factory_rmStockOut_data.rawMaterialId,
                                                ROUND(SUM(
                                                    factory_rmStockOut_data.rawMaterialQty
                                                ),2) AS total_quantity
                                            FROM
                                                factory_rmStockOut_data
                                            WHERE
                                                factory_rmStockOut_data.rmStockOutDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')
                                            GROUP BY
                                                factory_rmStockOut_data.rawMaterialId
                                        ) AS somw
                                        ON
                                            p.rawMaterialId = somw.rawMaterialId
                                        WHERE p.rawMaterialCategoryId = '${data.rawMaterialCategoryId}'`;
                } else if (req.query.searchRawMaterial) {
                    sql_get_pagination = `SELECT COUNT(*) AS numRows FROM factory_rawMaterial_data AS p
                                        ${sql_querry_joins}
                                        LEFT JOIN(
                                            SELECT
                                                factory_rmStockIn_data.rawMaterialId,
                                                ROUND(SUM(
                                                    factory_rmStockIn_data.rawMaterialQty
                                                ),2) AS total_quantity,
                                                ROUND(SUM(
                                                    factory_rmStockIn_data.totalPrice
                                                )) AS totalExpense
                                            FROM
                                                factory_rmStockIn_data
                                            WHERE
                                                factory_rmStockIn_data.rmStockInDate BETWEEN STR_TO_DATE('${firstDay}','%b %d %Y') AND STR_TO_DATE('${lastDay}','%b %d %Y')
                                            GROUP BY
                                                factory_rmStockIn_data.rawMaterialId
                                        ) AS simw
                                        ON
                                            p.rawMaterialId = simw.rawMaterialId
                                        LEFT JOIN(
                                            SELECT
                                                factory_rmStockOut_data.rawMaterialId,
                                                ROUND(SUM(
                                                    factory_rmStockOut_data.rawMaterialQty
                                                ),2) AS total_quantity
                                            FROM
                                                factory_rmStockOut_data
                                            WHERE
                                                factory_rmStockOut_data.rmStockOutDate BETWEEN STR_TO_DATE('${firstDay}','%b %d %Y') AND STR_TO_DATE('${lastDay}','%b %d %Y')
                                            GROUP BY
                                                factory_rmStockOut_data.rawMaterialId
                                        ) AS somw
                                        ON
                                            p.rawMaterialId = somw.rawMaterialId
                                        WHERE p.rawMaterialCategoryId = '${data.rawMaterialCategoryId}' AND p.rawMaterialName LIKE '%` + data.searchRawMaterial + `%'`;
                } else {
                    sql_get_pagination = `SELECT COUNT(*) AS numRows
                                        FROM
                                        factory_rawMaterial_data AS p
                                        ${sql_querry_joins}
                                        LEFT JOIN(
                                            SELECT
                                                factory_rmStockIn_data.rawMaterialId,
                                                ROUND(SUM(
                                                    factory_rmStockIn_data.rawMaterialQty
                                                ),2) AS total_quantity,
                                                ROUND(SUM(
                                                    factory_rmStockIn_data.totalPrice
                                                )) AS totalExpense
                                            FROM
                                                factory_rmStockIn_data
                                            WHERE
                                                factory_rmStockIn_data.rmStockInDate BETWEEN STR_TO_DATE('${firstDay}','%b %d %Y') AND STR_TO_DATE('${lastDay}','%b %d %Y')
                                            GROUP BY
                                                factory_rmStockIn_data.rawMaterialId
                                        ) AS simw
                                        ON
                                            p.rawMaterialId = simw.rawMaterialId
                                        LEFT JOIN(
                                            SELECT
                                                factory_rmStockOut_data.rawMaterialId,
                                                ROUND(SUM(
                                                    factory_rmStockOut_data.rawMaterialQty
                                                ),2) AS total_quantity
                                            FROM
                                                factory_rmStockOut_data
                                            WHERE
                                                factory_rmStockOut_data.rmStockOutDate BETWEEN STR_TO_DATE('${firstDay}','%b %d %Y') AND STR_TO_DATE('${lastDay}','%b %d %Y')
                                            GROUP BY
                                                factory_rmStockOut_data.rawMaterialId
                                        ) AS somw
                                        ON
                                            p.rawMaterialId = somw.rawMaterialId
                                        WHERE p.rawMaterialCategoryId = '${data.rawMaterialCategoryId}'`;
                }
            } else {
                if (req.query.rawMaterialStatus == 1) {
                    sql_get_pagination = `SELECT COUNT(*) AS numRows FROM factory_rawMaterial_data AS p
                                        ${sql_querry_joins}
                                        WHERE COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) >= p.minRawMaterialQty`;
                } else if (req.query.rawMaterialStatus == 2) {
                    sql_get_pagination = `SELECT COUNT(*) AS numRows FROM factory_rawMaterial_data AS p
                                        ${sql_querry_joins}
                                        WHERE COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) < p.minRawMaterialQty AND COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) != 0`;
                } else if (req.query.rawMaterialStatus == 3) {
                    sql_get_pagination = `SELECT COUNT(*) AS numRows FROM factory_rawMaterial_data AS p
                                        ${sql_querry_joins}
                                        WHERE COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) = 0`;
                } else if (req.query.startDate && req.query.endDate && req.query.searchRawMaterial) {
                    sql_get_pagination = `SELECT COUNT(*) AS numRows FROM factory_rawMaterial_data AS p
                                        ${sql_querry_joins}
                                        LEFT JOIN(
                                            SELECT
                                                factory_rmStockIn_data.rawMaterialId,
                                                ROUND(SUM(
                                                    factory_rmStockIn_data.rawMaterialQty
                                                ),2) AS total_quantity,
                                                ROUND(SUM(
                                                    factory_rmStockIn_data.totalPrice
                                                )) AS totalExpense
                                            FROM
                                                factory_rmStockIn_data
                                            WHERE
                                                factory_rmStockIn_data.rmStockInDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')
                                            GROUP BY
                                                factory_rmStockIn_data.rawMaterialId
                                        ) AS simw
                                        ON
                                            p.rawMaterialId = simw.rawMaterialId
                                        LEFT JOIN(
                                            SELECT
                                                factory_rmStockOut_data.rawMaterialId,
                                                ROUND(SUM(
                                                    factory_rmStockOut_data.rawMaterialQty
                                                ),2) AS total_quantity
                                            FROM
                                                factory_rmStockOut_data
                                            WHERE
                                                factory_rmStockOut_data.rmStockOutDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')
                                            GROUP BY
                                                factory_rmStockOut_data.rawMaterialId
                                        ) AS somw
                                        ON
                                            p.rawMaterialId = somw.rawMaterialId
                                        WHERE p.rawMaterialName LIKE '%` + data.searchRawMaterial + `%'`;
                } else if (req.query.startDate && req.query.endDate) {
                    sql_get_pagination = `SELECT COUNT(*) AS numRows FROM factory_rawMaterial_data AS p
                                        ${sql_querry_joins}
                                        LEFT JOIN(
                                            SELECT
                                                factory_rmStockIn_data.rawMaterialId,
                                                ROUND(SUM(
                                                    factory_rmStockIn_data.rawMaterialQty
                                                ),2) AS total_quantity,
                                                ROUND(SUM(
                                                    factory_rmStockIn_data.totalPrice
                                                )) AS totalExpense
                                            FROM
                                                factory_rmStockIn_data
                                            WHERE
                                                factory_rmStockIn_data.rmStockInDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')
                                            GROUP BY
                                                factory_rmStockIn_data.rawMaterialId
                                        ) AS simw
                                        ON
                                            p.rawMaterialId = simw.rawMaterialId
                                        LEFT JOIN(
                                            SELECT
                                                factory_rmStockOut_data.rawMaterialId,
                                                ROUND(SUM(
                                                    factory_rmStockOut_data.rawMaterialQty
                                                ),2) AS total_quantity
                                            FROM
                                                factory_rmStockOut_data
                                            WHERE
                                                factory_rmStockOut_data.rmStockOutDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')
                                            GROUP BY
                                                factory_rmStockOut_data.rawMaterialId
                                        ) AS somw
                                        ON
                                            p.rawMaterialId = somw.rawMaterialId`;
                } else if (req.query.searchRawMaterial) {
                    sql_get_pagination = `SELECT COUNT(*) AS numRows FROM factory_rawMaterial_data AS p
                                        ${sql_querry_joins}
                                        LEFT JOIN(
                                            SELECT
                                                factory_rmStockIn_data.rawMaterialId,
                                                ROUND(SUM(
                                                    factory_rmStockIn_data.rawMaterialQty
                                                ),2) AS total_quantity,
                                                ROUND(SUM(
                                                    factory_rmStockIn_data.totalPrice
                                                )) AS totalExpense
                                            FROM
                                                factory_rmStockIn_data
                                            WHERE
                                                factory_rmStockIn_data.rmStockInDate BETWEEN STR_TO_DATE('${firstDay}','%b %d %Y') AND STR_TO_DATE('${lastDay}','%b %d %Y')
                                            GROUP BY
                                                factory_rmStockIn_data.rawMaterialId
                                        ) AS simw
                                        ON
                                            p.rawMaterialId = simw.rawMaterialId
                                        LEFT JOIN(
                                            SELECT
                                                factory_rmStockOut_data.rawMaterialId,
                                                ROUND(SUM(
                                                    factory_rmStockOut_data.rawMaterialQty
                                                ),2) AS total_quantity
                                            FROM
                                                factory_rmStockOut_data
                                            WHERE
                                                factory_rmStockOut_data.rmStockOutDate BETWEEN STR_TO_DATE('${firstDay}','%b %d %Y') AND STR_TO_DATE('${lastDay}','%b %d %Y')
                                            GROUP BY
                                                factory_rmStockOut_data.rawMaterialId
                                        ) AS somw
                                        ON
                                            p.rawMaterialId = somw.rawMaterialId
                                        WHERE p.rawMaterialName LIKE '%` + data.searchRawMaterial + `%'`;
                } else {
                    sql_get_pagination = `SELECT COUNT(*) AS numRows
                                        FROM
                                        factory_rawMaterial_data AS p
                                        ${sql_querry_joins}
                                        LEFT JOIN(
                                            SELECT
                                                factory_rmStockIn_data.rawMaterialId,
                                                ROUND(SUM(
                                                    factory_rmStockIn_data.rawMaterialQty
                                                ),2) AS total_quantity,
                                                ROUND(SUM(
                                                    factory_rmStockIn_data.totalPrice
                                                )) AS totalExpense
                                            FROM
                                                factory_rmStockIn_data
                                            WHERE
                                                factory_rmStockIn_data.rmStockInDate BETWEEN STR_TO_DATE('${firstDay}','%b %d %Y') AND STR_TO_DATE('${lastDay}','%b %d %Y')
                                            GROUP BY
                                                factory_rmStockIn_data.rawMaterialId
                                        ) AS simw
                                        ON
                                            p.rawMaterialId = simw.rawMaterialId
                                        LEFT JOIN(
                                            SELECT
                                                factory_rmStockOut_data.rawMaterialId,
                                                ROUND(SUM(
                                                    factory_rmStockOut_data.rawMaterialQty
                                                ),2) AS total_quantity
                                            FROM
                                                factory_rmStockOut_data
                                            WHERE
                                                factory_rmStockOut_data.rmStockOutDate BETWEEN STR_TO_DATE('${firstDay}','%b %d %Y') AND STR_TO_DATE('${lastDay}','%b %d %Y')
                                            GROUP BY
                                                factory_rmStockOut_data.rawMaterialId
                                        ) AS somw
                                        ON
                                            p.rawMaterialId = somw.rawMaterialId`;
                }
            }
            pool.query(sql_get_pagination, (err, rows, fields) => {
                if (err) {
                    console.error("An error occurd in SQL Queery", err);
                    return res.status(500).send('Database Error');
                } else {
                    const numRows = rows[0].numRows;
                    const numPages = Math.ceil(numRows / numPerPage);
                    if (req.query.rawMaterialCategoryId) {
                        if (req.query.rawMaterialStatus == 1) {
                            sql_queries_getdetails = `${sql_querry_staticQuery}
                                                WHERE p.rawMaterialCategoryId = '${data.rawMaterialCategoryId}' AND COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) >= p.minRawMaterialQty 
                                                ORDER BY p.rawMaterialName LIMIT ${limit}`;
                        } else if (req.query.rawMaterialStatus == 2) {
                            sql_queries_getdetails = `${sql_querry_staticQuery}
                                                WHERE p.rawMaterialCategoryId = '${data.rawMaterialCategoryId}' AND COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) < p.minRawMaterialQty AND COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) != 0
                                                ORDER BY p.rawMaterialName LIMIT ${limit}`;
                        } else if (req.query.rawMaterialStatus == 3) {
                            sql_queries_getdetails = `${sql_querry_staticQuery}
                                                WHERE p.rawMaterialCategoryId = '${data.rawMaterialCategoryId}' AND COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) = 0
                                                ORDER BY p.rawMaterialName LIMIT ${limit}`;
                        } else if (req.query.startDate && req.query.endDate && req.query.searchRawMaterial) {
                            sql_queries_getdetails = `${sql_querry_getMwSiSO}
                                              LEFT JOIN(
                                                SELECT
                                                    factory_rmStockIn_data.rawMaterialId,
                                                    ROUND(SUM(
                                                        factory_rmStockIn_data.rawMaterialQty
                                                    ),2) AS total_quantity,
                                                    ROUND(SUM(
                                                        factory_rmStockIn_data.totalPrice
                                                    )) AS totalExpense
                                                FROM
                                                    factory_rmStockIn_data
                                                WHERE
                                                    factory_rmStockIn_data.rmStockInDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')
                                                GROUP BY
                                                    factory_rmStockIn_data.rawMaterialId
                                            ) AS simw
                                            ON
                                            p.rawMaterialId = simw.rawMaterialId
                                        LEFT JOIN(
                                            SELECT
                                                factory_rmStockOut_data.rawMaterialId,
                                                ROUND(SUM(
                                                    factory_rmStockOut_data.rawMaterialQty
                                                ),2) AS total_quantity,
                                                ROUND(SUM(
                                                    factory_rmStockOut_data.rmStockOutPrice
                                                )) AS totalStockOutPrice
                                            FROM
                                                factory_rmStockOut_data
                                            WHERE
                                               factory_rmStockOut_data.rmStockOutDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')
                                            GROUP BY
                                                factory_rmStockOut_data.rawMaterialId
                                        ) AS somw
                                        ON
                                        p.rawMaterialId = somw.rawMaterialId 
                                        WHERE p.rawMaterialCategoryId = '${data.rawMaterialCategoryId}' AND p.rawMaterialName LIKE '%` + data.searchRawMaterial + `%'
                                        ORDER BY p.rawMaterialName LIMIT ${limit}`
                        } else if (req.query.startDate && req.query.endDate) {
                            sql_queries_getdetails = `${sql_querry_getMwSiSO}
                                              LEFT JOIN(
                                                SELECT
                                                    factory_rmStockIn_data.rawMaterialId,
                                                    ROUND(SUM(
                                                        factory_rmStockIn_data.rawMaterialQty
                                                    ),2) AS total_quantity,
                                                    ROUND(SUM(
                                                        factory_rmStockIn_data.totalPrice
                                                    )) AS totalExpense
                                                FROM
                                                    factory_rmStockIn_data
                                                WHERE
                                                 factory_rmStockIn_data.rmStockInDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')
                                                GROUP BY
                                                    factory_rmStockIn_data.rawMaterialId
                                            ) AS simw
                                            ON
                                            p.rawMaterialId = simw.rawMaterialId
                                        LEFT JOIN(
                                            SELECT
                                                factory_rmStockOut_data.rawMaterialId,
                                                ROUND(SUM(
                                                    factory_rmStockOut_data.rawMaterialQty
                                                ),2) AS total_quantity,
                                                ROUND(SUM(
                                                        factory_rmStockOut_data.rmStockOutPrice
                                                )) AS totalStockOutPrice
                                            FROM
                                                factory_rmStockOut_data
                                            WHERE
                                               factory_rmStockOut_data.rmStockOutDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')
                                            GROUP BY
                                                factory_rmStockOut_data.rawMaterialId
                                        ) AS somw
                                        ON
                                        p.rawMaterialId = somw.rawMaterialId
                                        WHERE p.rawMaterialCategoryId = '${data.rawMaterialCategoryId}'
                                        ORDER BY p.rawMaterialName LIMIT ${limit}`
                        } else if (req.query.searchRawMaterial) {
                            sql_queries_getdetails = `${sql_querry_getMwSiSO}
                                              LEFT JOIN(
                                                SELECT
                                                    factory_rmStockIn_data.rawMaterialId,
                                                    ROUND(SUM(
                                                        factory_rmStockIn_data.rawMaterialQty
                                                    ),2) AS total_quantity,
                                                    ROUND(SUM(
                                                        factory_rmStockIn_data.totalPrice
                                                    )) AS totalExpense
                                                FROM
                                                    factory_rmStockIn_data
                                                WHERE
                                                    factory_rmStockIn_data.rmStockInDate BETWEEN STR_TO_DATE('${firstDay}','%b %d %Y') AND STR_TO_DATE('${lastDay}','%b %d %Y')
                                                GROUP BY
                                                    factory_rmStockIn_data.rawMaterialId
                                            ) AS simw
                                            ON
                                            p.rawMaterialId = simw.rawMaterialId
                                        LEFT JOIN(
                                            SELECT
                                                factory_rmStockOut_data.rawMaterialId,
                                                ROUND(SUM(
                                                    factory_rmStockOut_data.rawMaterialQty
                                                ),2) AS total_quantity,
                                                ROUND(SUM(
                                                    factory_rmStockOut_data.rmStockOutPrice
                                                )) AS totalStockOutPrice
                                            FROM
                                                factory_rmStockOut_data
                                            WHERE
                                                factory_rmStockOut_data.rmStockOutDate BETWEEN STR_TO_DATE('${firstDay}','%b %d %Y') AND STR_TO_DATE('${lastDay}','%b %d %Y')
                                            GROUP BY
                                                factory_rmStockOut_data.rawMaterialId
                                        ) AS somw
                                        ON
                                        p.rawMaterialId = somw.rawMaterialId
                                        WHERE p.rawMaterialCategoryId = '${data.rawMaterialCategoryId}' AND p.rawMaterialName LIKE '%` + data.searchRawMaterial + `%'
                                        ORDER BY p.rawMaterialName LIMIT ${limit}`
                        } else {
                            sql_queries_getdetails = `${sql_querry_getMwSiSO}
                                              LEFT JOIN(
                                                SELECT
                                                    factory_rmStockIn_data.rawMaterialId,
                                                    ROUND(SUM(
                                                        factory_rmStockIn_data.rawMaterialQty
                                                    ),2) AS total_quantity,
                                                    ROUND(SUM(
                                                        factory_rmStockIn_data.totalPrice
                                                    )) AS totalExpense
                                                FROM
                                                    factory_rmStockIn_data
                                                WHERE
                                                    factory_rmStockIn_data.rmStockInDate BETWEEN STR_TO_DATE('${firstDay}','%b %d %Y') AND STR_TO_DATE('${lastDay}','%b %d %Y')
                                                GROUP BY
                                                    factory_rmStockIn_data.rawMaterialId
                                            ) AS simw
                                            ON
                                            p.rawMaterialId = simw.rawMaterialId
                                        LEFT JOIN(
                                            SELECT
                                                factory_rmStockOut_data.rawMaterialId,
                                                ROUND(SUM(
                                                    factory_rmStockOut_data.rawMaterialQty
                                                ),2) AS total_quantity,
                                                ROUND(SUM(
                                                    factory_rmStockOut_data.rmStockOutPrice
                                                )) AS totalStockOutPrice
                                            FROM
                                                factory_rmStockOut_data
                                            WHERE
                                                factory_rmStockOut_data.rmStockOutDate BETWEEN STR_TO_DATE('${firstDay}','%b %d %Y') AND STR_TO_DATE('${lastDay}','%b %d %Y')
                                            GROUP BY
                                                factory_rmStockOut_data.rawMaterialId
                                        ) AS somw
                                        ON
                                        p.rawMaterialId = somw.rawMaterialId
                                        WHERE p.rawMaterialCategoryId = '${data.rawMaterialCategoryId}'
                                        ORDER BY p.rawMaterialName LIMIT ${limit}`
                        }
                    } else {
                        if (req.query.rawMaterialStatus == 1) {
                            sql_queries_getdetails = `${sql_querry_staticQuery}
                                                WHERE COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) >= p.minRawMaterialQty 
                                                ORDER BY p.rawMaterialName LIMIT ${limit}`;
                        } else if (req.query.rawMaterialStatus == 2) {
                            sql_queries_getdetails = `${sql_querry_staticQuery}
                                                WHERE COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) < p.minRawMaterialQty AND COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) != 0
                                                ORDER BY p.rawMaterialName LIMIT ${limit}`;
                        } else if (req.query.rawMaterialStatus == 3) {
                            sql_queries_getdetails = `${sql_querry_staticQuery}
                                                WHERE COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) = 0
                                                ORDER BY p.rawMaterialName LIMIT ${limit}`;
                        } else if (req.query.startDate && req.query.endDate && req.query.searchRawMaterial) {
                            sql_queries_getdetails = `${sql_querry_getMwSiSO}
                                              LEFT JOIN(
                                                SELECT
                                                    factory_rmStockIn_data.rawMaterialId,
                                                    ROUND(SUM(
                                                        factory_rmStockIn_data.rawMaterialQty
                                                    ),2) AS total_quantity,
                                                    ROUND(SUM(
                                                        factory_rmStockIn_data.totalPrice
                                                    )) AS totalExpense
                                                FROM
                                                    factory_rmStockIn_data
                                                WHERE
                                                    factory_rmStockIn_data.rmStockInDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')
                                                GROUP BY
                                                    factory_rmStockIn_data.rawMaterialId
                                            ) AS simw
                                            ON
                                            p.rawMaterialId = simw.rawMaterialId
                                        LEFT JOIN(
                                            SELECT
                                                factory_rmStockOut_data.rawMaterialId,
                                                ROUND(SUM(
                                                    factory_rmStockOut_data.rawMaterialQty
                                                ),2) AS total_quantity,
                                                ROUND(SUM(
                                                    factory_rmStockOut_data.rmStockOutPrice
                                                )) AS totalStockOutPrice
                                            FROM
                                                factory_rmStockOut_data
                                            WHERE
                                                factory_rmStockOut_data.rmStockOutDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')
                                            GROUP BY
                                                factory_rmStockOut_data.rawMaterialId
                                        ) AS somw
                                        ON
                                        p.rawMaterialId = somw.rawMaterialId 
                                        WHERE p.rawMaterialName LIKE '%` + data.searchRawMaterial + `%'
                                        ORDER BY p.rawMaterialName LIMIT ${limit}`
                        } else if (req.query.startDate && req.query.endDate) {
                            sql_queries_getdetails = `${sql_querry_getMwSiSO}
                                              LEFT JOIN(
                                                SELECT
                                                    factory_rmStockIn_data.rawMaterialId,
                                                    ROUND(SUM(
                                                        factory_rmStockIn_data.rawMaterialQty
                                                    ),2) AS total_quantity,
                                                    ROUND(SUM(
                                                        factory_rmStockIn_data.totalPrice
                                                    )) AS totalExpense
                                                FROM
                                                    factory_rmStockIn_data
                                                WHERE
                                                 factory_rmStockIn_data.rmStockInDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')
                                                GROUP BY
                                                    factory_rmStockIn_data.rawMaterialId
                                            ) AS simw
                                            ON
                                            p.rawMaterialId = simw.rawMaterialId
                                        LEFT JOIN(
                                            SELECT
                                                factory_rmStockOut_data.rawMaterialId,
                                                ROUND(SUM(
                                                    factory_rmStockOut_data.rawMaterialQty
                                                ),2) AS total_quantity,
                                                ROUND(SUM(
                                                        factory_rmStockOut_data.rmStockOutPrice
                                                )) AS totalStockOutPrice
                                            FROM
                                                factory_rmStockOut_data
                                            WHERE
                                               factory_rmStockOut_data.rmStockOutDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')
                                            GROUP BY
                                                factory_rmStockOut_data.rawMaterialId
                                        ) AS somw
                                        ON
                                        p.rawMaterialId = somw.rawMaterialId
                                        ORDER BY p.rawMaterialName LIMIT ${limit}`
                        } else if (req.query.searchRawMaterial) {
                            sql_queries_getdetails = `${sql_querry_getMwSiSO}
                                              LEFT JOIN(
                                                SELECT
                                                    factory_rmStockIn_data.rawMaterialId,
                                                    ROUND(SUM(
                                                        factory_rmStockIn_data.rawMaterialQty
                                                    ),2) AS total_quantity,
                                                    ROUND(SUM(
                                                        factory_rmStockIn_data.totalPrice
                                                    )) AS totalExpense
                                                FROM
                                                    factory_rmStockIn_data
                                                WHERE
                                                   factory_rmStockIn_data.rmStockInDate BETWEEN STR_TO_DATE('${firstDay}','%b %d %Y') AND STR_TO_DATE('${lastDay}','%b %d %Y')
                                                GROUP BY
                                                    factory_rmStockIn_data.rawMaterialId
                                            ) AS simw
                                            ON
                                            p.rawMaterialId = simw.rawMaterialId
                                        LEFT JOIN(
                                            SELECT
                                                factory_rmStockOut_data.rawMaterialId,
                                                ROUND(SUM(
                                                    factory_rmStockOut_data.rawMaterialQty
                                                ),2) AS total_quantity,
                                                ROUND(SUM(
                                                    factory_rmStockOut_data.rmStockOutPrice
                                                )) AS totalStockOutPrice
                                            FROM
                                                factory_rmStockOut_data
                                            WHERE
                                                factory_rmStockOut_data.rmStockOutDate BETWEEN STR_TO_DATE('${firstDay}','%b %d %Y') AND STR_TO_DATE('${lastDay}','%b %d %Y')
                                            GROUP BY
                                                factory_rmStockOut_data.rawMaterialId
                                        ) AS somw
                                        ON
                                        p.rawMaterialId = somw.rawMaterialId
                                        WHERE p.rawMaterialName LIKE '%` + data.searchRawMaterial + `%'
                                        ORDER BY p.rawMaterialName LIMIT ${limit}`
                        } else {
                            sql_queries_getdetails = `${sql_querry_getMwSiSO}
                                              LEFT JOIN(
                                                SELECT
                                                    factory_rmStockIn_data.rawMaterialId,
                                                    ROUND(SUM(
                                                        factory_rmStockIn_data.rawMaterialQty
                                                    ),2) AS total_quantity,
                                                    ROUND(SUM(
                                                        factory_rmStockIn_data.totalPrice
                                                    )) AS totalExpense
                                                FROM
                                                    factory_rmStockIn_data
                                                WHERE
                                                   factory_rmStockIn_data.rmStockInDate BETWEEN STR_TO_DATE('${firstDay}','%b %d %Y') AND STR_TO_DATE('${lastDay}','%b %d %Y')
                                                GROUP BY
                                                    factory_rmStockIn_data.rawMaterialId
                                            ) AS simw
                                            ON
                                            p.rawMaterialId = simw.rawMaterialId
                                        LEFT JOIN(
                                            SELECT
                                                factory_rmStockOut_data.rawMaterialId,
                                                ROUND(SUM(
                                                    factory_rmStockOut_data.rawMaterialQty
                                                ),2) AS total_quantity,
                                                ROUND(SUM(
                                                    factory_rmStockOut_data.rmStockOutPrice
                                                )) AS totalStockOutPrice
                                            FROM
                                                factory_rmStockOut_data
                                            WHERE
                                                factory_rmStockOut_data.rmStockOutDate BETWEEN STR_TO_DATE('${firstDay}','%b %d %Y') AND STR_TO_DATE('${lastDay}','%b %d %Y')
                                            GROUP BY
                                                factory_rmStockOut_data.rawMaterialId
                                        ) AS somw
                                        ON
                                        p.rawMaterialId = somw.rawMaterialId
                                        ORDER BY p.rawMaterialName LIMIT ${limit}`
                        }
                    }
                    pool.query(sql_queries_getdetails, (err, rows, fields) => {
                        if (err) {
                            console.error("An error occurd in SQL Queery", err);
                            return res.status(500).send('Database Error');;
                        } else {
                            if (numRows === 0) {
                                const rows = [{
                                    'msg': 'No Data Found'
                                }]
                                return res.status(200).send({ rows, numRows });
                            } else {
                                const datas = Object.values(JSON.parse(JSON.stringify(rows)));
                                processDatas(datas)
                                    .then((data) => {
                                        const rows = datas ? datas.map((element, index) => data[index] && data[index].convertedQuantity ? { ...element, remainingStock: data[index].convertedQuantity, allConversation: data[index].vikJson } : { ...element, remainingStock: element.remainingStock + ' ' + element.minRawMaterialUnit, allConversation: data[index].vikJson },
                                            // console.log(data[index] && data[index].convertedQuantity)
                                        ) : []
                                        let newData = [];
                                        Promise.all(
                                            rows ? rows.map(async (element, index) => {
                                                let newElement = element;
                                                return await newConversationAsync(element.purchese, element.rawMaterialId, element.minRawMaterialUnit)
                                                    .then(async (res) => {
                                                        newElement = { ...newElement, purchese: res }
                                                        return await newConversationAsync(element.totalUsed, element.rawMaterialId, element.minRawMaterialUnit)
                                                            .then((res) => {
                                                                newElement = { ...newElement, totalUsed: res }
                                                                newData.push(newElement)
                                                                return newElement
                                                            }).catch(error => {
                                                                console.error('Error in processing datas :', error);
                                                                return res.status(500).send('Internal Error');
                                                            });
                                                    }).catch(error => {
                                                        console.error('Error in processing datas :', error);
                                                        return res.status(500).send('Internal Error');
                                                    });
                                            }) : [])
                                            .then((rows) => {
                                                return res.status(200).send({ rows, numRows });
                                            }).catch(error => {
                                                console.error('Error in processing datas :', error);
                                                return res.status(500).send('Internal Error');
                                            });
                                    }).catch(error => {
                                        console.error('Error in processing datas :', error);
                                        return res.status(500).send('Internal Error');
                                    });
                            }
                        }
                    });
                }
            })
        } else {
            return res.status(401).send("Please Login Firest.....!");
        }
    } catch (error) {
        console.error('An error occurd', error);
        res.status(500).send('Internal Server Error');
    }
}

// Remove Raw Material API

const removeRawMaterial = async (req, res) => {
    try {
        let token;
        token = req.headers ? req.headers.authorization.split(" ")[1] : null;
        if (token) {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const rights = decoded.id.rights;
            if (rights == 1) {
                var rawMaterialId = req.query.rawMaterialId.trim();
                req.query.rawMaterialId = pool.query(`SELECT rawMaterialId FROM factory_rawMaterial_data WHERE rawMaterialId = '${rawMaterialId}'`, (err, row) => {
                    if (err) {
                        console.error("An error occurd in SQL Queery", err);
                        return res.status(500).send('Database Error');
                    }
                    if (row && row.length) {
                        const sql_querry_removedetails = `DELETE FROM factory_rawMaterial_data WHERE rawMaterialId = '${rawMaterialId}';
                                                  DELETE FROM inventory_supplierProducts_data WHERE productId = '${rawMaterialId}' AND supplierId = '${process.env.RAJ_MANDIR_FACTORY_ID}'`;
                        pool.query(sql_querry_removedetails, (err, data) => {
                            if (err) {
                                console.error("An error occurd in SQL Queery", err);
                                return res.status(500).send('Database Error');
                            }
                            return res.status(200).send("Raw Material Deleted Successfully");
                        })
                    } else {
                        return res.send('Raw Material Id Not Found');
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

// Update Raw Material API

const updateRawMaterial = async (req, res) => {
    try {
        let token;
        token = req.headers ? req.headers.authorization.split(" ")[1] : null;
        if (token) {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const rights = decoded.id.rights;
            if (rights == 1) {
                const rawMaterialId = req.body.rawMaterialId;
                const priorityArray = req.body.priorityArray;
                const data = {
                    productCategoryId: req.body.productCategoryId,
                    rawMaterialCategoryId: req.body.rawMaterialCategoryId,
                    rawMaterialName: req.body.rawMaterialName.trim(),
                    gujaratiRawMaterialName: req.body.gujaratiRawMaterialName,
                    minRawMaterialQty: req.body.minRawMaterialQty,
                    minRawMaterialUnit: req.body.minRawMaterialUnit.trim(),
                    leadTime: req.body.leadTime ? req.body.leadTime : 0,
                    isQtyNum: req.body.isQtyNum ? req.body.isQtyNum : false,
                    isExpired: req.body.isExpired,
                    expiredDays: req.body.expiredDays ? req.body.expiredDays : 0,
                    isSupplayBranch: req.body.isSupplayBranch ? req.body.isSupplayBranch : false
                }
                if (!rawMaterialId || !data.rawMaterialName || !data.minRawMaterialQty || !data.minRawMaterialUnit) {
                    return res.status(400).send("Please Fill All The Fields");
                }
                const sql_querry_updatedetails = `UPDATE factory_rawMaterial_data SET 
                                                rawMaterialCategoryId = '${data.rawMaterialCategoryId}',
                                                rawMaterialName = '${data.rawMaterialName}',
                                                gujaratiRawMaterialName = ${data.gujaratiRawMaterialName ? `'${data.gujaratiRawMaterialName}'` : null},
                                                minRawMaterialQty = ${data.minRawMaterialQty},
                                                minRawMaterialUnit = '${data.minRawMaterialUnit}',
                                                leadTime = ${data.leadTime},
                                                isQtyNum = ${data.isQtyNum},
                                                isExpired = ${data.isExpired},
                                                expiredDays = ${data.isExpired ? `${data.expiredDays}` : 0}
                                            WHERE rawMaterialId = '${rawMaterialId}';
                                            UPDATE inventory_product_data SET
                                                minProductUnit = minProductUnit
                                            WHERE productId = '${rawMaterialId}'`;
                pool.query(sql_querry_updatedetails, (err, datas) => {
                    if (err) {
                        console.error("An error occurd in SQL Queery", err);
                        return res.status(500).send('Database Error');
                    }
                    sql_querry_removePriorityArray = `DELETE FROM factory_rmUnit_preference WHERE rawMaterialId = '${rawMaterialId}'`;
                    pool.query(sql_querry_removePriorityArray, (err, result) => {
                        if (err) {
                            console.error("An error occurd in SQL Queery", err);
                            return res.status(500).send('Database Error');
                        }
                        if (priorityArray.length != 0 && priorityArray) {
                            let addPriorityData = priorityArray.map((item, index) => {
                                let uniqueId = `PriorityId_${Date.now() + index}`; // Generating a unique ID using current timestamp
                                let priorityNumber = index + 1; // Define Priority Number
                                return `('${uniqueId}', '${rawMaterialId}', ${priorityNumber}, '${item.bigUnitName}', ${item.unitNumber}, '${item.smallUnitName}')`;
                            }).join(', ');
                            const sql_querry_addPriority = `INSERT INTO factory_rmUnit_preference (preferenceId, rawMaterialId, priorityNumber, bigUnitName, unitNumber, smallUnitName)
                                                    VALUES ${addPriorityData}`;
                            pool.query(sql_querry_addPriority, (err, result) => {
                                if (err) {
                                    console.error("An error occurd in SQL Queery", err);
                                    return res.status(500).send('Database Error');
                                }
                                console.log('Unit Prefrence Updated');
                            });
                        }
                        sql_querry_getOldStatus = `SELECT isSupplyBranch FROM factory_rawMaterial_data WHERE factory_rawMaterial_data.rawMaterialId = '${rawMaterialId}'`;
                        pool.query(sql_querry_getOldStatus, (err, status) => {
                            const isSupplyBranchStatus = status ? status[0].isSupplyBranch : data.isSupplayBranch;

                            if (err) {
                                console.error("An error occurd in SQL Queery", err);
                                return res.status(500).send('Database Error');
                            } else if (data.isSupplayBranch == isSupplyBranchStatus) {
                                return res.status(200).send("Raw Material Update Successfully");
                            } else {
                                sql_querry_getId = `SELECT productId FROM inventory_product_data WHERE productId = '${rawMaterialId}';`;
                                pool.query(sql_querry_getId, (err, id) => {
                                    if (err) {
                                        console.error("An error occurd in SQL Queery", err);
                                        return res.status(500).send('Database Error');
                                    }
                                    const materialId = id && id[0] ? id[0].productId : null;
                                    console.log(materialId, 'jovu');
                                    if (materialId) {
                                        if (data.isSupplayBranch) {
                                            sql_querry_manage = `INSERT INTO inventory_supplierProducts_data(supplierId, productId)
                                                         VALUES('${process.env.RAJ_MANDIR_FACTORY_ID}','${rawMaterialId}');
                                                         UPDATE factory_rawMaterial_data SET isSupplyBranch = ${data.isSupplayBranch}  WHERE rawMaterialId = '${rawMaterialId}'`;
                                        } else {
                                            sql_querry_manage = `DELETE FROM inventory_supplierProducts_data 
                                                         WHERE supplierId = '${process.env.RAJ_MANDIR_FACTORY_ID}' AND productId = '${rawMaterialId}';
                                                         UPDATE factory_rawMaterial_data SET isSupplyBranch = ${data.isSupplayBranch}  WHERE rawMaterialId = '${rawMaterialId}'`;
                                        }
                                        pool.query(sql_querry_manage, (err, msg) => {
                                            if (err) {
                                                console.error("An error occurd in SQL Queery", err);
                                                return res.status(500).send('Database Error');
                                            }
                                            return res.status(200).send("Raw Material Update Successfully");
                                        })
                                    } else {
                                        if (data.isSupplayBranch) {
                                            sql_querry_mang = `INSERT INTO inventory_product_data(productId, productCategoryId, productName, gujaratiProductName, minProductQty, minProductUnit, leadTime, isExpired, expiredDays)
                                                       VALUES('${rawMaterialId}', '${data.productCategoryId}', '${data.rawMaterialName}',  ${data.gujaratiRawMaterialName ? `'${data.gujaratiRawMaterialName}'` : null},  ${data.minRawMaterialQty}, '${data.minRawMaterialUnit}', ${data.leadTime}, ${data.isExpired}, ${data.isExpired ? `${data.expiredDays}` : 0});
                                                       INSERT INTO inventory_supplierProducts_data(supplierId, productId)
                                                       VALUES('${process.env.RAJ_MANDIR_FACTORY_ID}','${rawMaterialId}');
                                                       UPDATE factory_rawMaterial_data SET isSupplyBranch = ${data.isSupplayBranch}  WHERE rawMaterialId = '${rawMaterialId}'`;
                                        } else {
                                            return res.status(200).send("Raw Material Update Successfully");
                                        }
                                        pool.query(sql_querry_mang, (err, msg) => {
                                            if (err) {
                                                console.error("An error occurd in SQL Queery", err);
                                                return res.status(500).send('Database Error');
                                            }
                                            if (priorityArray.length != 0 && priorityArray) {
                                                let addPriorityData = priorityArray.map((item, index) => {
                                                    let uniqueId = `PriorityId_${Date.now() + index}`; // Generating a unique ID using current timestamp
                                                    let priorityNumber = index + 1; // Define Priority Number
                                                    return `('${uniqueId}', '${rawMaterialId}', ${priorityNumber}, '${item.bigUnitName}', ${item.unitNumber}, '${item.smallUnitName}')`;
                                                }).join(', ');
                                                const sql_querry_addPriority = `INSERT INTO product_unit_preference (preferenceId, productId, priorityNumber, bigUnitName, unitNumber, smallUnitName)
                                                                        VALUES ${addPriorityData}`;
                                                pool.query(sql_querry_addPriority, (err, result) => {
                                                    if (err) {
                                                        console.error("An error occurd in SQL Queery", err);
                                                        return res.status(500).send('Database Error');
                                                    }
                                                    console.log('Product Unit Prefrence Updated');
                                                });
                                            }
                                            return res.status(200).send("Raw Material Update Successfully");
                                        })
                                    }
                                })
                            }
                        })
                        // return res.status(200).send("Raw Material Update Successfully");
                    })
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

// Get Raw Material Details By Id

const getRawMaterialDetailsById = (req, res) => {
    try {
        const rawMaterialId = req.query.rawMaterialId;
        if (!rawMaterialId) {
            return res.status(404).send('ProductId Not Found');
        }
        sql_queries_getdetails = `SELECT rawMaterialId, rawMaterialCategoryId, rawMaterialName, gujaratiRawMaterialName, minRawMaterialQty, minRawMaterialUnit, leadTime, isSupplyBranch AS isSupplayBranch, isQtyNum, isExpired, expiredDays FROM factory_rawMaterial_data WHERE rawMaterialId = '${rawMaterialId}';
                                  SELECT priorityNumber, bigUnitName, unitNumber, smallUnitName FROM factory_rmUnit_preference WHERE rawMaterialId = '${rawMaterialId}';
                                  SELECT productCategoryId FROM inventory_product_data WHERE productId = '${rawMaterialId}'`;
        pool.query(sql_queries_getdetails, (err, data) => {
            if (err) {
                console.error("An error occurd in SQL Queery", err);
                return res.status(500).send('Database Error');
            }
            const unitNames = data[1].map(item => item.bigUnitName);
            unitNames.splice(0, 0, data[0][0].minRawMaterialUnit);

            const mergedObject = {
                ...data[0][0], // Copy the first object as it contains the rm information
                productCategoryId: data && data[2].length ? data[2][0].productCategoryId : '',
                priorityArray: data[1], // Assign the second array as "priorityArray"
                unitArr: unitNames
            };
            return res.status(200).send(mergedObject);
        })
    } catch (error) {
        console.error('An error occurd', error);
        res.status(500).send('Internal Server Error');
    }
}

// Get StockOut Category Used API

const getCategoryWiseUsedByRawMaterial = (req, res) => {
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

            const data = {
                startDate: (req.query.startDate ? req.query.startDate : '').slice(4, 15),
                endDate: (req.query.endDate ? req.query.endDate : '').slice(4, 15),
                rawMaterialId: req.query.rawMaterialId
            }
            if (req.query.startDate && req.query.endDate) {
                sql_queries_getCategoryUsed = `SELECT
                                                        iscd.stockOutCategoryName,
                                                        ipd.rawMaterialId,
                                                        ipd.minRawMaterialUnit,
                                                        COALESCE(so.usedQty, 0) AS remainingStock,
                                                        COALESCE(so.usedPrice,0) AS usedPrice
                                                    FROM
                                                        inventory_stockOutCategory_data AS iscd
                                                    LEFT JOIN(
                                                        SELECT
                                                            factory_rmStockOut_data.rmStockOutCategory,
                                                            ROUND(SUM(
                                                                factory_rmStockOut_data.rawMaterialQty
                                                            ),2) AS usedQty,
                                                            ROUND(SUM(
                                                                factory_rmStockOut_data.rmStockOutPrice
                                                            )) AS usedPrice
                                                        FROM
                                                            factory_rmStockOut_data
                                                        WHERE
                                                            factory_rmStockOut_data.rawMaterialId = '${data.rawMaterialId}' AND factory_rmStockOut_data.rmStockOutDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')
                                                        GROUP BY
                                                            factory_rmStockOut_data.rmStockOutCategory
                                                    ) AS so
                                                    ON
                                                        iscd.stockOutCategoryId = so.rmStockOutCategory
                                                    LEFT JOIN factory_rawMaterial_data AS ipd ON ipd.rawMaterialId = '${data.rawMaterialId}'
                                                    ORDER BY so.usedQty DESC`;
            } else {
                sql_queries_getCategoryUsed = `SELECT
                                                    iscd.stockOutCategoryName,
                                                    ipd.rawMaterialId,
                                                    ipd.minRawMaterialUnit,
                                                    COALESCE(so.usedQty, 0) AS remainingStock,
                                                    COALESCE(so.usedPrice,0) AS usedPrice
                                                FROM
                                                    inventory_stockOutCategory_data AS iscd
                                                LEFT JOIN(
                                                    SELECT
                                                        factory_rmStockOut_data.rmStockOutCategory,
                                                        ROUND(SUM(
                                                            factory_rmStockOut_data.rawMaterialQty
                                                        ),2) AS usedQty,
                                                        ROUND(SUM(
                                                            factory_rmStockOut_data.rmStockOutPrice
                                                        )) AS usedPrice
                                                    FROM
                                                        factory_rmStockOut_data
                                                    WHERE
                                                        factory_rmStockOut_data.rawMaterialId = '${data.rawMaterialId}' AND factory_rmStockOut_data.rmStockOutDate BETWEEN STR_TO_DATE('${firstDay}','%b %d %Y') AND STR_TO_DATE('${lastDay}','%b %d %Y')
                                                    GROUP BY
                                                        factory_rmStockOut_data.rmStockOutCategory
                                                ) AS so
                                                ON
                                                  iscd.stockOutCategoryId = so.rmStockOutCategory
                                                LEFT JOIN factory_rawMaterial_data AS ipd ON ipd.rawMaterialId = '${data.rawMaterialId}'
                                                ORDER BY so.usedQty DESC`
            }
            console.log(sql_queries_getCategoryUsed);
            pool.query(sql_queries_getCategoryUsed, (err, result) => {
                if (err) {
                    console.error("An error occurd in SQL Queery", err);
                    return res.status(500).send('Database Error');
                }
                const datas = Object.values(JSON.parse(JSON.stringify(result)));
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
            return res.status(401).send("Please Login Firest.....!");
        }
    } catch (error) {
        console.error('An error occurd', error);
        res.status(500).json('Internal Server Error');
    }
}

// Get Unit Conversation Details By Raw Material Id

const getRmUnitPreferenceById = (req, res) => {
    try {
        const rawMaterialId = req.query.rawMaterialId;
        if (!rawMaterialId) {
            return res.status(404), send('rawMaterialId Not Found');
        }
        sql_get_preference = `SELECT
                                    bigUnitName AS largerUnit, unitNumber AS value, smallUnitName AS smallerUnit
                                FROM
                                    factory_rmUnit_preference AS pup
                                WHERE
                                    pup.rawMaterialId = '${rawMaterialId}'
                                ORDER BY
                                    pup.priorityNumber ASC`;
        pool.query(sql_get_preference, (err, data) => {
            if (err) {
                console.error("An error occurd in SQL Queery", err);
                return res.status(500).send('Database Error');
            }
            else if (data && data.length != 0) {
                const baseUnit = data[0].smallerUnit;
                const unitsData = Object.values(JSON.parse(JSON.stringify(data)));
                console.log(unitsData);
                const conversatio = computeConversionFactors(unitsData);
                const unitsDatas = unitsData.map(item => {
                    return `1 ${item.largerUnit} = ${item.value} ${item.smallerUnit}`;
                });
                const newData = conversatio.map(item => {
                    return `1 ${item.unitName} = ${item.value} ${baseUnit}`;
                });
                const jsonData1 = unitsDatas.map(item => ({ preference: item }));
                const jsonData2 = newData.map(item => ({ preference: item }));
                return res.status(200).send({ json1: jsonData1, json2: jsonData2 });
            } else {
                return res.status(200).send({ json1: [{ preference: 'No Unit Conversation' }], json2: [] });
            }
        })
    } catch (error) {
        console.error('An error occurd', error);
        res.status(500).json('Internal Server Error');
    }
}

// Export Excel Query for Raw Material Table

const exportExcelSheetForRawMaterialTable = (req, res) => {
    let token;
    token = req.headers.authorization ? req.headers.authorization.split(" ")[1] : null;
    if (token) {
        var date = new Date(), y = date.getFullYear(), m = (date.getMonth());
        var firstDay = new Date(y, m, 1).toString().slice(4, 15);
        var lastDay = new Date(y, m + 1, 0).toString().slice(4, 15);

        const data = {
            startDate: (req.query.startDate ? req.query.startDate : '').slice(4, 15),
            endDate: (req.query.endDate ? req.query.endDate : '').slice(4, 15),
            rawMaterialCategoryId: req.query.rawMaterialCategoryId
        }
        const sql_querry_staticQuery = `SELECT
                                                p.rawMaterialId,
                                                UCASE(p.rawMaterialName) AS rawMaterialName,
                                                gujaratiRawMaterialName AS gujProductName,
                                                CONCAT(p.minRawMaterialQty,' ',p.minRawMaterialUnit) AS minRawMaterialQty,
                                                p.minRawMaterialUnit,
                                                CONCAT(p.leadTime,' ','Day') AS leadTime,
                                                p.isExpired,
                                                CONCAT(p.expiredDays,' ','Day') AS expiredDays,
                                                COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) AS remainingStock,
                                                COALESCE(ROUND(siLu.rawMaterialPrice,2), 0) AS lastPrice,
                                                COALESCE(siLu.rawMaterialQty,'No In') AS lastUpdatedQty,
                                                COALESCE(siLu.totalPrice, 0) AS totalPrice,
                                                COALESCE(
                                                    DATE_FORMAT(siLu.rmStockInDate, '%d-%m-%Y'),
                                                    "No Update"
                                                ) AS lastUpdatedStockInDate,
                                                CASE WHEN COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) >= p.minRawMaterialQty THEN 'In-Stock' WHEN COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) < p.minRawMaterialQty AND COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) != 0 THEN 'Low-Stock' ELSE 'Out-Stock'
                                            END AS stockStatus
                                            FROM
                                                factory_rawMaterial_data AS p
                                            LEFT JOIN(
                                                SELECT
                                                    factory_rmStockIn_data.rawMaterialId,
                                                    ROUND(SUM(
                                                        factory_rmStockIn_data.rawMaterialQty
                                                    ),2) AS total_quantity
                                                FROM
                                                    factory_rmStockIn_data
                                                GROUP BY
                                                    factory_rmStockIn_data.rawMaterialId
                                            ) AS si
                                            ON
                                                p.rawMaterialId = si.rawMaterialId
                                            LEFT JOIN(
                                                SELECT
                                                    factory_rmStockOut_data.rawMaterialId,
                                                    ROUND(SUM(
                                                        factory_rmStockOut_data.rawMaterialQty
                                                    ),2) AS total_quantity
                                                FROM
                                                    factory_rmStockOut_data
                                                GROUP BY
                                                    factory_rmStockOut_data.rawMaterialId
                                            ) AS so
                                            ON
                                                p.rawMaterialId = so.rawMaterialId
                                            LEFT JOIN(
                                                SELECT
                                                    rawMaterialId,
                                                    rmStockInDate,
                                                    COALESCE(CONCAT(stockInDisplayQty,' ',stockInDisplayUnit),'No IN') AS rawMaterialQty,
                                                    rawMaterialPrice,
                                                    totalPrice
                                                FROM
                                                    factory_rmStockIn_data
                                                WHERE (rawMaterialId, rmStockInCreationDate) IN(
                                                    SELECT
                                                        rawMaterialId,
                                                        MAX(rmStockInCreationDate)
                                                    FROM
                                                        factory_rmStockIn_data
                                                    GROUP BY
                                                        rawMaterialId
                                                )
                                            ) AS siLu
                                            ON
                                                p.rawMaterialId = siLu.rawMaterialId`;
        const sql_querry_getMwSiSO = `SELECT
                                                p.rawMaterialId,
                                                UCASE(p.rawMaterialName) AS rawMaterialName,
                                                gujaratiRawMaterialName AS gujProductName,
                                                CONCAT(p.minRawMaterialQty,' ',p.minRawMaterialUnit) AS minRawMaterialQty,
                                                p.minRawMaterialUnit,
                                                CONCAT(p.leadTime,' ','Day') AS leadTime,
                                                p.isExpired,
                                                CONCAT(p.expiredDays,' ','Day') AS expiredDays,
                                                COALESCE(simw.total_quantity, 0) AS purchese,
                                                COALESCE(somw.total_quantity, 0) AS totalUsed,
                                                COALESCE(simw.totalExpense,0) AS totalExpense,
                                                COALESCE(somw.totalStockOutPrice,0) AS totalStockOutPrice,
                                                COALESCE(si.total_siPrice, 0) - COALESCE(so.total_soPrice, 0) AS remainPrice,
                                                COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) AS remainingStock,
                                                COALESCE(ROUND(siLu.rawMaterialPrice,2), 0) AS lastPrice,
                                                COALESCE(siLu.rawMaterialQty,'No In') AS lastUpdatedQty,
                                                COALESCE(siLu.totalPrice, 0) AS totalPrice,
                                                COALESCE(
                                                    DATE_FORMAT(siLu.rmStockInDate, '%d-%m-%Y'),
                                                    "No Update"
                                                ) AS lastUpdatedStockInDate,
                                                CASE WHEN COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) >= p.minRawMaterialQty THEN 'In-Stock' WHEN COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) < p.minRawMaterialQty AND COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) != 0 THEN 'Low-Stock' ELSE 'Out-Stock'
                                            END AS stockStatus
                                            FROM
                                                factory_rawMaterial_data AS p
                                            LEFT JOIN(
                                                SELECT
                                                    factory_rmStockIn_data.rawMaterialId,
                                                    ROUND(SUM(
                                                        factory_rmStockIn_data.rawMaterialQty
                                                    ),2) AS total_quantity,
                                                    ROUND(SUM(
                                                        factory_rmStockIn_data.totalPrice
                                                    ),2) AS total_siPrice
                                                FROM
                                                    factory_rmStockIn_data
                                                GROUP BY
                                                    factory_rmStockIn_data.rawMaterialId
                                            ) AS si
                                            ON
                                                p.rawMaterialId = si.rawMaterialId
                                            LEFT JOIN(
                                                SELECT
                                                    factory_rmStockOut_data.rawMaterialId,
                                                    ROUND(SUM(
                                                        factory_rmStockOut_data.rawMaterialQty
                                                    ),2) AS total_quantity,
                                                    ROUND(SUM(
                                                        factory_rmStockOut_data.rmStockOutPrice
                                                    ),2) AS total_soPrice
                                                FROM
                                                    factory_rmStockOut_data
                                                GROUP BY
                                                    factory_rmStockOut_data.rawMaterialId
                                            ) AS so
                                            ON
                                                p.rawMaterialId = so.rawMaterialId
                                            LEFT JOIN(
                                                SELECT
                                                    rawMaterialId,
                                                    rmStockInDate,
                                                    CONCAT(stockInDisplayQty,' ',stockInDisplayUnit) AS rawMaterialQty,
                                                    rawMaterialPrice,
                                                    totalPrice
                                                FROM
                                                    factory_rmStockIn_data
                                                WHERE (rawMaterialId, rmStockInCreationDate) IN(
                                                    SELECT
                                                        rawMaterialId,
                                                        MAX(rmStockInCreationDate) As lastDate
                                                    FROM
                                                        factory_rmStockIn_data
                                                    GROUP BY
                                                        rawMaterialId
                                                )
                                            ) AS siLu
                                            ON
                                                p.rawMaterialId = siLu.rawMaterialId`;
        if (req.query.rawMaterialCategoryId) {
            if (req.query.rawMaterialStatus == 1) {
                sql_queries_getdetails = `${sql_querry_staticQuery}
                                                WHERE p.rawMaterialCategoryId = '${data.rawMaterialCategoryId}' AND COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) >= p.minRawMaterialQty 
                                                ORDER BY p.rawMaterialName`;
            } else if (req.query.rawMaterialStatus == 2) {
                sql_queries_getdetails = `${sql_querry_staticQuery}
                                                WHERE p.rawMaterialCategoryId = '${data.rawMaterialCategoryId}' AND COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) < p.minRawMaterialQty AND COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) != 0
                                                ORDER BY p.rawMaterialName`;
            } else if (req.query.rawMaterialStatus == 3) {
                sql_queries_getdetails = `${sql_querry_staticQuery}
                                                WHERE p.rawMaterialCategoryId = '${data.rawMaterialCategoryId}' AND COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) = 0
                                                ORDER BY p.rawMaterialName`;
            } else if (req.query.startDate && req.query.endDate) {
                sql_queries_getdetails = `${sql_querry_getMwSiSO}
                                              LEFT JOIN(
                                                SELECT
                                                    factory_rmStockIn_data.rawMaterialId,
                                                    ROUND(SUM(
                                                        factory_rmStockIn_data.rawMaterialQty
                                                    ),2) AS total_quantity,
                                                    ROUND(SUM(
                                                        factory_rmStockIn_data.totalPrice
                                                    )) AS totalExpense
                                                FROM
                                                    factory_rmStockIn_data
                                                WHERE
                                                 factory_rmStockIn_data.rmStockInDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')
                                                GROUP BY
                                                    factory_rmStockIn_data.rawMaterialId
                                            ) AS simw
                                            ON
                                            p.rawMaterialId = simw.rawMaterialId
                                        LEFT JOIN(
                                            SELECT
                                                factory_rmStockOut_data.rawMaterialId,
                                                ROUND(SUM(
                                                    factory_rmStockOut_data.rawMaterialQty
                                                ),2) AS total_quantity,
                                                ROUND(SUM(
                                                        factory_rmStockOut_data.rmStockOutPrice
                                                )) AS totalStockOutPrice
                                            FROM
                                                factory_rmStockOut_data
                                            WHERE
                                               factory_rmStockOut_data.rmStockOutDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')
                                            GROUP BY
                                                factory_rmStockOut_data.rawMaterialId
                                        ) AS somw
                                        ON
                                        p.rawMaterialId = somw.rawMaterialId
                                        WHERE p.rawMaterialCategoryId = '${data.rawMaterialCategoryId}'
                                        ORDER BY p.rawMaterialName`;
            } else {
                sql_queries_getdetails = `${sql_querry_getMwSiSO}
                                              LEFT JOIN(
                                                SELECT
                                                    factory_rmStockIn_data.rawMaterialId,
                                                    ROUND(SUM(
                                                        factory_rmStockIn_data.rawMaterialQty
                                                    ),2) AS total_quantity,
                                                    ROUND(SUM(
                                                        factory_rmStockIn_data.totalPrice
                                                    )) AS totalExpense
                                                FROM
                                                    factory_rmStockIn_data
                                                WHERE
                                                    factory_rmStockIn_data.rmStockInDate BETWEEN STR_TO_DATE('${firstDay}','%b %d %Y') AND STR_TO_DATE('${lastDay}','%b %d %Y')
                                                GROUP BY
                                                    factory_rmStockIn_data.rawMaterialId
                                            ) AS simw
                                            ON
                                            p.rawMaterialId = simw.rawMaterialId
                                        LEFT JOIN(
                                            SELECT
                                                factory_rmStockOut_data.rawMaterialId,
                                                ROUND(SUM(
                                                    factory_rmStockOut_data.rawMaterialQty
                                                ),2) AS total_quantity,
                                                ROUND(SUM(
                                                    factory_rmStockOut_data.rmStockOutPrice
                                                )) AS totalStockOutPrice
                                            FROM
                                                factory_rmStockOut_data
                                            WHERE
                                                factory_rmStockOut_data.rmStockOutDate BETWEEN STR_TO_DATE('${firstDay}','%b %d %Y') AND STR_TO_DATE('${lastDay}','%b %d %Y')
                                            GROUP BY
                                                factory_rmStockOut_data.rawMaterialId
                                        ) AS somw
                                        ON
                                        p.rawMaterialId = somw.rawMaterialId
                                        WHERE p.rawMaterialCategoryId = '${data.rawMaterialCategoryId}'
                                        ORDER BY p.rawMaterialName`;
            }
        } else {
            if (req.query.rawMaterialStatus == 1) {
                sql_queries_getdetails = `${sql_querry_staticQuery}
                                                WHERE COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) >= p.minRawMaterialQty 
                                                ORDER BY p.rawMaterialName`;
            } else if (req.query.rawMaterialStatus == 2) {
                sql_queries_getdetails = `${sql_querry_staticQuery}
                                                WHERE COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) < p.minRawMaterialQty AND COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) != 0
                                                ORDER BY p.rawMaterialName`;
            } else if (req.query.rawMaterialStatus == 3) {
                sql_queries_getdetails = `${sql_querry_staticQuery}
                                                WHERE COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) = 0
                                                ORDER BY p.rawMaterialName`;
            } else if (req.query.startDate && req.query.endDate) {
                sql_queries_getdetails = `${sql_querry_getMwSiSO}
                                              LEFT JOIN(
                                                SELECT
                                                    factory_rmStockIn_data.rawMaterialId,
                                                    ROUND(SUM(
                                                        factory_rmStockIn_data.rawMaterialQty
                                                    ),2) AS total_quantity,
                                                    ROUND(SUM(
                                                        factory_rmStockIn_data.totalPrice
                                                    )) AS totalExpense
                                                FROM
                                                    factory_rmStockIn_data
                                                WHERE
                                                 factory_rmStockIn_data.rmStockInDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')
                                                GROUP BY
                                                    factory_rmStockIn_data.rawMaterialId
                                            ) AS simw
                                            ON
                                            p.rawMaterialId = simw.rawMaterialId
                                        LEFT JOIN(
                                            SELECT
                                                factory_rmStockOut_data.rawMaterialId,
                                                ROUND(SUM(
                                                    factory_rmStockOut_data.rawMaterialQty
                                                ),2) AS total_quantity,
                                                ROUND(SUM(
                                                        factory_rmStockOut_data.rmStockOutPrice
                                                )) AS totalStockOutPrice
                                            FROM
                                                factory_rmStockOut_data
                                            WHERE
                                               factory_rmStockOut_data.rmStockOutDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')
                                            GROUP BY
                                                factory_rmStockOut_data.rawMaterialId
                                        ) AS somw
                                        ON
                                        p.rawMaterialId = somw.rawMaterialId
                                        ORDER BY p.rawMaterialName`;
            } else {
                sql_queries_getdetails = `${sql_querry_getMwSiSO}
                                              LEFT JOIN(
                                                SELECT
                                                    factory_rmStockIn_data.rawMaterialId,
                                                    ROUND(SUM(
                                                        factory_rmStockIn_data.rawMaterialQty
                                                    ),2) AS total_quantity,
                                                    ROUND(SUM(
                                                        factory_rmStockIn_data.totalPrice
                                                    )) AS totalExpense
                                                FROM
                                                    factory_rmStockIn_data
                                                WHERE
                                                    factory_rmStockIn_data.rmStockInDate BETWEEN STR_TO_DATE('${firstDay}','%b %d %Y') AND STR_TO_DATE('${lastDay}','%b %d %Y')
                                                GROUP BY
                                                    factory_rmStockIn_data.rawMaterialId
                                            ) AS simw
                                            ON
                                            p.rawMaterialId = simw.rawMaterialId
                                        LEFT JOIN(
                                            SELECT
                                                factory_rmStockOut_data.rawMaterialId,
                                                ROUND(SUM(
                                                    factory_rmStockOut_data.rawMaterialQty
                                                ),2) AS total_quantity,
                                                ROUND(SUM(
                                                    factory_rmStockOut_data.rmStockOutPrice
                                                )) AS totalStockOutPrice
                                            FROM
                                                factory_rmStockOut_data
                                            WHERE
                                                factory_rmStockOut_data.rmStockOutDate BETWEEN STR_TO_DATE('${firstDay}','%b %d %Y') AND STR_TO_DATE('${lastDay}','%b %d %Y')
                                            GROUP BY
                                                factory_rmStockOut_data.rawMaterialId
                                        ) AS somw
                                        ON
                                        p.rawMaterialId = somw.rawMaterialId
                                        ORDER BY p.rawMaterialName`;
            }
        }
        pool.query(sql_queries_getdetails, async (err, rows) => {
            if (err) return res.status(404).send(err);
            const datas = Object.values(JSON.parse(JSON.stringify(rows)));
            processDatas(datas)
                .then((data) => {
                    const rows = datas ? datas.map((element, index) => data[index] && data[index].convertedQuantity ? { ...element, remainingStock: data[index].convertedQuantity } : { ...element, remainingStock: element.remainingStock + ' ' + element.minRawMaterialUnit },
                        // console.log(data[index] && data[index].convertedQuantity)
                    ) : []
                    let newData = [];
                    Promise.all(
                        rows ? rows.map(async (element, index) => {
                            let newElement = element;
                            return await newConversationAsync(element.purchese, element.rawMaterialId, element.minRawMaterialUnit)
                                .then(async (res) => {
                                    newElement = { ...newElement, purchese: res }
                                    return await newConversationAsync(element.totalUsed, element.rawMaterialId, element.minRawMaterialUnit)
                                        .then((res) => {
                                            newElement = { ...newElement, totalUsed: res }
                                            newData.push(newElement)
                                            return newElement
                                        }).catch(error => {
                                            console.error('Error in processing datas :', error);
                                            return res.status(500).send('Internal Error');
                                        });
                                }).catch(error => {
                                    console.error('Error in processing datas :', error);
                                    return res.status(500).send('Internal Error');
                                });
                        }) : [])
                        .then(async (rows) => {
                            // return res.status(200).send({ rows });
                            const workbook = new excelJS.Workbook();  // Create a new workbook
                            const worksheet = workbook.addWorksheet("All Products"); // New Worksheet

                            if (req.query.startDate && req.query.endDate) {
                                worksheet.mergeCells('A1', 'N1');
                                worksheet.getCell('A1').value = `Raw Material List From ${data.startDate} To ${data.endDate}`;
                            } else {
                                worksheet.mergeCells('A1', 'N1');
                                worksheet.getCell('A1').value = `Raw Material List From ${firstDay} To ${lastDay}`;
                            }

                            const headersNameList = ['S no.', 'Raw Material Name', 'પ્રોડક્ટ નામ', 'Total StockIn', 'Total Expense', 'Total Used', 'Total Used Price', 'Remaining Stock', 'Remaining Price', 'Last StockIn', 'Last Price', 'Last Updated Price', 'Min Raw Material Qty', 'Stock Status', 'LastIn DATE'];
                            const columnsArray = [
                                { key: "s_no", width: 10, },
                                { key: "rawMaterialName", width: 30 },
                                { key: "gujProductName", width: 30 },
                                { key: "purchese", width: 40 },
                                { key: "totalExpense", width: 20 },
                                { key: "totalUsed", width: 40 },
                                { key: "totalStockOutPrice", width: 20 },
                                { key: "remainingStock", width: 40 },
                                { key: "remainPrice", width: 20 },
                                { key: "lastUpdatedQty", width: 20 },
                                { key: "totalPrice", width: 20 },
                                { key: "lastPrice", width: 20 },
                                { key: "minRawMaterialQty", width: 20 },
                                { key: "stockStatus", width: 30 },
                                { key: "lastUpdatedStockInDate", width: 15 }
                            ];

                            /*Column headers*/
                            worksheet.getRow(2).values = headersNameList;

                            // Column for data in excel. key must match data key
                            worksheet.columns = columnsArray;
                            //Looping through User data
                            const arr = rows
                            console.log(arr);
                            console.log(">>>", arr);
                            let counter = 1;
                            arr.forEach((user, index) => {
                                user.s_no = counter;
                                const row = worksheet.addRow(user); // Add data in worksheet

                                // Get the stock status value for the current row
                                const stockStatus = user.stockStatus;

                                // Set color based on stock status
                                let textColor;
                                switch (stockStatus) {
                                    case 'In-Stock':
                                        textColor = '008000'; // Green color
                                        break;
                                    case 'Low-Stock':
                                        textColor = 'FFA500'; // Orange color
                                        break;
                                    case 'Out-Stock':
                                        textColor = 'FF0000'; // Red color
                                        break;
                                    default:
                                        textColor = '000000'; // Black color (default)
                                        break;
                                }

                                // Apply the color to the cells in the current row
                                row.eachCell((cell) => {
                                    cell.font = {
                                        color: {
                                            argb: textColor
                                        }
                                    };
                                });

                                counter++;
                            });
                            // Making first line in excel bold
                            worksheet.getRow(1).eachCell((cell) => {
                                cell.font = { bold: true, size: 13 }
                                cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
                                height = 200
                            });
                            worksheet.getRow(2).eachCell((cell) => {
                                cell.font = { bold: true, size: 13, color: { argb: '808080' } }
                                cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
                            });
                            worksheet.getRow(1).height = 30;
                            worksheet.getRow(2).height = 20;
                            worksheet.getRow(arr.length + 3).values = ['Total:', '', '', '', { formula: `SUM(E3:E${arr.length + 2})` }, '', { formula: `SUM(G3:G${arr.length + 2})` }, '', { formula: `SUM(I3:I${arr.length + 2})` }];

                            worksheet.getRow(arr.length + 3).eachCell((cell) => {
                                cell.font = { bold: true, size: 14, color: { argb: '808080' } }
                                cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
                            })
                            worksheet.eachRow((row) => {
                                row.eachCell((cell) => {
                                    cell.alignment = { horizontal: 'center', vertical: 'middle' };
                                    row.height = 20
                                });
                            });

                            const worksheetInStock = workbook.addWorksheet("In Stock"); // New Worksheet

                            if (req.query.startDate && req.query.endDate) {
                                worksheetInStock.mergeCells('A1', 'N1');
                                worksheetInStock.getCell('A1').value = `In-Stock Raw Material List From ${data.startDate} To ${data.endDate}`;
                            } else {
                                worksheetInStock.mergeCells('A1', 'N1');
                                worksheetInStock.getCell('A1').value = `In-Stock Raw Material List From ${firstDay} To ${lastDay}`;
                            }

                            /*Column headers*/
                            worksheetInStock.getRow(2).values = headersNameList;

                            // Column for data in excel. key must match data key
                            worksheetInStock.columns = columnsArray;
                            const inStockProducts = rows.filter(rm => rm.stockStatus === 'In-Stock');
                            console.log(inStockProducts);
                            //Looping through User data
                            const arrstockIn = inStockProducts
                            console.log(">>>", arr);
                            let inStockcounter = 1;
                            arrstockIn.forEach((user, index) => {
                                user.s_no = inStockcounter;
                                const row = worksheetInStock.addRow(user); // Add data in worksheet

                                // Get the stock status value for the current row
                                const stockStatus = user.stockStatus;

                                // Set color based on stock status
                                let textColor;
                                switch (stockStatus) {
                                    case 'In-Stock':
                                        textColor = '008000'; // Green color
                                        break;
                                    case 'Low-Stock':
                                        textColor = 'FFA500'; // Orange color
                                        break;
                                    case 'Out-Stock':
                                        textColor = 'FF0000'; // Red color
                                        break;
                                    default:
                                        textColor = '000000'; // Black color (default)
                                        break;
                                }

                                // Apply the color to the cells in the current row
                                row.eachCell((cell) => {
                                    cell.font = {
                                        color: {
                                            argb: textColor
                                        }
                                    };
                                });

                                inStockcounter++;
                            });
                            // Making first line in excel bold
                            worksheetInStock.getRow(1).eachCell((cell) => {
                                cell.font = { bold: true, size: 13 }
                                cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
                                height = 200
                            });
                            worksheetInStock.getRow(2).eachCell((cell) => {
                                cell.font = { bold: true, size: 13, color: { argb: '808080' } }
                                cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
                            });
                            worksheetInStock.getRow(1).height = 30;
                            worksheetInStock.getRow(2).height = 20;
                            worksheetInStock.getRow(arrstockIn.length + 3).values = ['Total:', '', '', '', { formula: `SUM(E3:E${arrstockIn.length + 2})` }, '', { formula: `SUM(G3:G${arrstockIn.length + 2})` }, '', { formula: `SUM(I3:I${arrstockIn.length + 2})` }];

                            worksheetInStock.getRow(arrstockIn.length + 3).eachCell((cell) => {
                                cell.font = { bold: true, size: 14, color: { argb: '808080' } }
                                cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
                            })
                            worksheetInStock.eachRow((row) => {
                                row.eachCell((cell) => {
                                    cell.alignment = { horizontal: 'center', vertical: 'middle' };
                                    row.height = 20
                                });
                            });

                            const worksheetLowStock = workbook.addWorksheet("Low Stock"); // New Worksheet

                            if (req.query.startDate && req.query.endDate) {
                                worksheetLowStock.mergeCells('A1', 'N1');
                                worksheetLowStock.getCell('A1').value = `Low-Stock Raw Material List From ${data.startDate} To ${data.endDate}`;
                            } else {
                                worksheetLowStock.mergeCells('A1', 'N1');
                                worksheetLowStock.getCell('A1').value = `Low-Stock Raw Material List From ${firstDay} To ${lastDay}`;
                            }

                            /*Column headers*/
                            worksheetLowStock.getRow(2).values = headersNameList;

                            // Column for data in excel. key must match data key
                            worksheetLowStock.columns = columnsArray;

                            worksheetInStock.columns = columnsArray;
                            const lowStockProducts = rows.filter(rm => rm.stockStatus === 'Low-Stock');
                            console.log(lowStockProducts);
                            //Looping through User data
                            const arrstockLow = lowStockProducts;
                            console.log(">>>", arr);
                            let lowStockcounter = 1;
                            arrstockLow.forEach((user, index) => {
                                if (Object.values(user).some((value) => value !== null && value !== "")) {
                                    user.s_no = lowStockcounter;
                                    const row = worksheetLowStock.addRow(user); // Add data in worksheet

                                    // Get the stock status value for the current row
                                    const stockStatus = user.stockStatus;

                                    // Set color based on stock status
                                    let textColor;
                                    switch (stockStatus) {
                                        case 'In-Stock':
                                            textColor = '008000'; // Green color
                                            break;
                                        case 'Low-Stock':
                                            textColor = 'FFA500'; // Orange color
                                            break;
                                        case 'Out-Stock':
                                            textColor = 'FF0000'; // Red color
                                            break;
                                        default:
                                            textColor = '000000'; // Black color (default)
                                            break;
                                    }

                                    // Apply the color to the cells in the current row
                                    row.eachCell((cell) => {
                                        cell.font = {
                                            color: {
                                                argb: textColor
                                            }
                                        };
                                    });

                                    lowStockcounter++;
                                }
                            });
                            // Making first line in excel bold
                            worksheetLowStock.getRow(1).eachCell((cell) => {
                                cell.font = { bold: true, size: 13 }
                                cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
                                height = 200
                            });
                            worksheetLowStock.getRow(2).eachCell((cell) => {
                                cell.font = { bold: true, size: 13, color: { argb: '808080' } }
                                cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
                            });
                            worksheetLowStock.getRow(1).height = 30;
                            worksheetLowStock.getRow(2).height = 20;
                            worksheetLowStock.getRow(arrstockLow.length + 3).values = ['Total:', '', '', '', { formula: `SUM(E3:E${arrstockLow.length + 2})` }, '', { formula: `SUM(G3:G${arrstockLow.length + 2})` }, '', { formula: `SUM(I3:I${arrstockLow.length + 2})` }];

                            worksheetLowStock.getRow(arrstockLow.length + 3).eachCell((cell) => {
                                cell.font = { bold: true, size: 14, color: { argb: '808080' } }
                                cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
                            })
                            worksheetLowStock.eachRow((row) => {
                                row.eachCell((cell) => {
                                    cell.alignment = { horizontal: 'center', vertical: 'middle' };
                                    row.height = 20
                                });
                            });

                            const worksheetOutStock = workbook.addWorksheet("Out Stock"); // New Worksheet

                            if (req.query.startDate && req.query.endDate) {
                                worksheetOutStock.mergeCells('A1', 'N1');
                                worksheetOutStock.getCell('A1').value = `Out-Stock Raw Material List From ${data.startDate} To ${data.endDate}`;
                            } else {
                                worksheetOutStock.mergeCells('A1', 'N1');
                                worksheetOutStock.getCell('A1').value = `Out-Stock Raw Material List From ${firstDay} To ${lastDay}`;
                            }

                            /*Column headers*/
                            worksheetOutStock.getRow(2).values = headersNameList;

                            // Column for data in excel. key must match data key
                            worksheetOutStock.columns = columnsArray;

                            const outStockProducts = rows.filter(rm => rm.stockStatus === 'Out-Stock');
                            console.log(outStockProducts);
                            //Looping through User data
                            const arrstockOut = outStockProducts;
                            let outStockcounter = 1;
                            arrstockOut.forEach((user, index) => {
                                user.s_no = outStockcounter;
                                const row = worksheetOutStock.addRow(user); // Add data in worksheet

                                // Get the stock status value for the current row
                                const stockStatus = user.stockStatus;

                                // Set color based on stock status
                                let textColor;
                                switch (stockStatus) {
                                    case 'In-Stock':
                                        textColor = '008000'; // Green color
                                        break;
                                    case 'Low-Stock':
                                        textColor = 'FFA500'; // Orange color
                                        break;
                                    case 'Out-Stock':
                                        textColor = 'FF0000'; // Red color
                                        break;
                                    default:
                                        textColor = '000000'; // Black color (default)
                                        break;
                                }

                                // Apply the color to the cells in the current row
                                row.eachCell((cell) => {
                                    cell.font = {
                                        color: {
                                            argb: textColor
                                        }
                                    };
                                });

                                outStockcounter++;
                            });
                            // Making first line in excel bold
                            worksheetOutStock.getRow(1).eachCell((cell) => {
                                cell.font = { bold: true, size: 13 }
                                cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
                                height = 200
                            });
                            worksheetOutStock.getRow(2).eachCell((cell) => {
                                cell.font = { bold: true, size: 13, color: { argb: '808080' } }
                                cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
                            });
                            worksheetOutStock.getRow(1).height = 30;
                            worksheetOutStock.getRow(2).height = 20;
                            worksheetOutStock.getRow(arrstockOut.length + 3).values = ['Total:', '', '', '', { formula: `SUM(E3:E${arrstockOut.length + 2})` }, '', { formula: `SUM(G3:G${arrstockOut.length + 2})` }, '', { formula: `SUM(I3:I${arrstockOut.length + 2})` }];

                            worksheetOutStock.getRow(arrstockOut.length + 3).eachCell((cell) => {
                                cell.font = { bold: true, size: 14, color: { argb: '808080' } }
                                cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
                            })
                            worksheetOutStock.eachRow((row) => {
                                row.eachCell((cell) => {
                                    cell.alignment = { horizontal: 'center', vertical: 'middle' };
                                    row.height = 20
                                });
                            });

                            // Check Sheet

                            const worksheetChkStock = workbook.addWorksheet("Check Stock"); // New Worksheet

                            if (req.query.startDate && req.query.endDate) {
                                worksheetChkStock.mergeCells('A1', 'F1');
                                worksheetChkStock.getCell('A1').value = `Raw Material List From ${data.startDate} To ${data.endDate}`;
                            } else {
                                worksheetChkStock.mergeCells('A1', 'F1');
                                worksheetChkStock.getCell('A1').value = `Raw Material List From ${firstDay} To ${lastDay}`;
                            }

                            /*Column headers*/
                            worksheetChkStock.getRow(2).values = ['Sr. No', 'Raw Material Name', 'પ્રોડક્ટ નામ', 'Remain Stock', 'Min Qty', 'Status'];

                            // Column for data in excel. key must match data key
                            worksheetChkStock.columns = [
                                { key: "s_no", width: 10, },
                                { key: "rawMaterialName", width: 30 },
                                { key: "gujProductName", width: 30 },
                                { key: "remainingStock", width: 40 },
                                { key: "minRawMaterialQty", width: 20 },
                                { key: "stockStatus", width: 30 }
                            ];

                            //Looping through User data
                            const arrstockChk = rows;
                            let chkCounter = 1;
                            arrstockChk.forEach((user, index) => {
                                user.s_no = chkCounter;
                                const row = worksheetChkStock.addRow(user); // Add data in worksheet

                                // Get the stock status value for the current row
                                const stockStatus = user.stockStatus;

                                // Set color based on stock status
                                let textColor;
                                switch (stockStatus) {
                                    case 'In-Stock':
                                        textColor = '008000'; // Green color
                                        break;
                                    case 'Low-Stock':
                                        textColor = 'FFA500'; // Orange color
                                        break;
                                    case 'Out-Stock':
                                        textColor = 'FF0000'; // Red color
                                        break;
                                    default:
                                        textColor = '000000'; // Black color (default)
                                        break;
                                }

                                // Apply the color to the cells in the current row
                                row.eachCell((cell) => {
                                    cell.font = {
                                        color: {
                                            argb: textColor
                                        }
                                    };
                                });

                                chkCounter++;
                            });
                            // Making first line in excel bold
                            worksheetChkStock.getRow(1).eachCell((cell) => {
                                cell.font = { bold: true, size: 13 }
                                cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
                                height = 200
                            });
                            worksheetChkStock.getRow(2).eachCell((cell) => {
                                cell.font = { bold: true, size: 13, color: { argb: '808080' } }
                                cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
                            });
                            worksheetChkStock.getRow(1).height = 30;
                            worksheetChkStock.getRow(2).height = 20;

                            worksheetChkStock.getRow(arrstockChk.length + 3).eachCell((cell) => {
                                cell.font = { bold: true, size: 14, color: { argb: '808080' } }
                                cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
                            })
                            worksheetChkStock.eachRow((row) => {
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
                        }).catch(error => {
                            console.error('Error in processing datas :', error);
                            return res.status(500).send('Internal Error');
                        });
                }).catch(error => {
                    console.error('Error in processing datas :', error);
                    return res.status(500).send('Internal Error');
                });
        })
    } else {
        return res.status(401).send("Please Login Firest.....!");
    }
};

// PDF Function

async function createPDF(res, datas, tableHeading) {
    try {
        // Create a new PDF document
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

        // Add auto table to the PDF document
        doc.text(15, 15, tableHeading);
        doc.autoTable({
            startY: 20,
            head: [columns.map(col => col.header)], // Extract headers correctly
            body: data,
            theme: 'grid',
            didParseCell: function (data) {
                const columnIndex = data.column.index;
                const rowIndex = data.row.index - 1; // Adjust for header row

                if (columnIndex === 9) { // Assuming 'Type' is in the sixth column (index 5)
                    const type = data.cell.raw;

                    if (type === 'In-Stock') {
                        data.cell.styles.textColor = [0, 128, 0]; // Green color for 'CREDIT'
                    } else if (type === 'Out-Stock') {
                        data.cell.styles.textColor = [255, 0, 0]; // Red color for 'DEBIT'
                    } else if (type === 'Low-Stock') {
                        data.cell.styles.textColor = [255, 165, 0]; // Orange color for 'CREDIT'
                    }
                }
            },
            styles: {
                cellPadding: 2, // Add padding to cells for better appearance
                halign: 'center', // Horizontally center-align content
                fontSize: 10,
                lineColor: [0, 0, 0], // Border color
                lineWidth: 0.1, // Border width
            }
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
    } catch (error) {
        console.error('An error occurd', error);
        res.status(500).json('Internal Server Error');
    }
}

// Export PDF For Raw Material List

const exportPdfForAllRawMaterialData = (req, res) => {
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
                rawMaterialStatus: req.query.rawMaterialStatus,
                rawMaterialCategoryId: req.query.rawMaterialCategoryId
            }
            const sql_querry_staticQuery = `SELECT
                                                p.rawMaterialId,
                                                UCASE(p.rawMaterialName) AS rawMaterialName,
                                                gujaratiRawMaterialName AS gujProductName,
                                                CONCAT(p.minRawMaterialQty,' ',p.minRawMaterialUnit) AS minRawMaterialQty,
                                                p.minRawMaterialUnit,
                                                CONCAT(p.leadTime,' ','Day') AS leadTime,
                                                p.isExpired,
                                                CONCAT(p.expiredDays,' ','Day') AS expiredDays,
                                                COALESCE(si.total_quantity, 0) AS purchese,
                                                COALESCE(so.total_quantity, 0) AS totalUsed,
                                                COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) AS remainingStock,
                                                COALESCE(ROUND(siLu.rawMaterialPrice,2), 0) AS lastPrice,
                                                COALESCE(siLu.rawMaterialQty,'No In') AS lastUpdatedQty,
                                                COALESCE(siLu.totalPrice, 0) AS totalPrice,
                                                COALESCE(
                                                    DATE_FORMAT(siLu.rmStockInDate, '%d-%m-%Y'),
                                                    "No Update"
                                                ) AS lastUpdatedStockInDate,
                                                CASE WHEN COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) >= p.minRawMaterialQty THEN 'In-Stock' WHEN COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) < p.minRawMaterialQty AND COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) != 0 THEN 'Low-Stock' ELSE 'Out-Stock'
                                            END AS stockStatus
                                            FROM
                                                factory_rawMaterial_data AS p
                                            LEFT JOIN(
                                                SELECT
                                                    factory_rmStockIn_data.rawMaterialId,
                                                    ROUND(SUM(
                                                        factory_rmStockIn_data.rawMaterialQty
                                                    ),2) AS total_quantity
                                                FROM
                                                    factory_rmStockIn_data
                                                GROUP BY
                                                    factory_rmStockIn_data.rawMaterialId
                                            ) AS si
                                            ON
                                                p.rawMaterialId = si.rawMaterialId
                                            LEFT JOIN(
                                                SELECT
                                                    factory_rmStockOut_data.rawMaterialId,
                                                    ROUND(SUM(
                                                        factory_rmStockOut_data.rawMaterialQty
                                                    ),2) AS total_quantity
                                                FROM
                                                    factory_rmStockOut_data
                                                GROUP BY
                                                    factory_rmStockOut_data.rawMaterialId
                                            ) AS so
                                            ON
                                                p.rawMaterialId = so.rawMaterialId
                                            LEFT JOIN(
                                                SELECT
                                                    rawMaterialId,
                                                    rmStockInDate,
                                                    COALESCE(CONCAT(stockInDisplayQty,' ',stockInDisplayUnit),'No IN') AS rawMaterialQty,
                                                    rawMaterialPrice,
                                                    totalPrice
                                                FROM
                                                    factory_rmStockIn_data
                                                WHERE (rawMaterialId, rmStockInCreationDate) IN(
                                                    SELECT
                                                        rawMaterialId,
                                                        MAX(rmStockInCreationDate)
                                                    FROM
                                                        factory_rmStockIn_data
                                                    GROUP BY
                                                        rawMaterialId
                                                )
                                            ) AS siLu
                                            ON
                                                p.rawMaterialId = siLu.rawMaterialId`;
            const sql_querry_getMwSiSO = `SELECT
                                                p.rawMaterialId,
                                                UCASE(p.rawMaterialName) AS rawMaterialName,
                                                gujaratiRawMaterialName AS gujProductName,
                                                CONCAT(p.minRawMaterialQty,' ',p.minRawMaterialUnit) AS minRawMaterialQty,
                                                p.minRawMaterialUnit,
                                                CONCAT(p.leadTime,' ','Day') AS leadTime,
                                                p.isExpired,
                                                CONCAT(p.expiredDays,' ','Day') AS expiredDays,
                                                COALESCE(simw.total_quantity, 0) AS purchese,
                                                COALESCE(somw.total_quantity, 0) AS totalUsed,
                                                COALESCE(simw.totalExpense,0) AS totalExpense,
                                                COALESCE(somw.totalStockOutPrice,0) AS totalStockOutPrice,
                                                COALESCE(si.total_siPrice, 0) - COALESCE(so.total_soPrice, 0) AS remainPrice,
                                                COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) AS remainingStock,
                                                COALESCE(ROUND(siLu.rawMaterialPrice,2), 0) AS lastPrice,
                                                COALESCE(siLu.rawMaterialQty,'No In') AS lastUpdatedQty,
                                                COALESCE(siLu.totalPrice, 0) AS totalPrice,
                                                COALESCE(
                                                    DATE_FORMAT(siLu.rmStockInDate, '%d-%m-%Y'),
                                                    "No Update"
                                                ) AS lastUpdatedStockInDate,
                                                CASE WHEN COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) >= p.minRawMaterialQty THEN 'In-Stock' WHEN COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) < p.minRawMaterialQty AND COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) != 0 THEN 'Low-Stock' ELSE 'Out-Stock'
                                            END AS stockStatus
                                            FROM
                                                factory_rawMaterial_data AS p
                                            LEFT JOIN(
                                                SELECT
                                                    factory_rmStockIn_data.rawMaterialId,
                                                    ROUND(SUM(
                                                        factory_rmStockIn_data.rawMaterialQty
                                                    ),2) AS total_quantity,
                                                    ROUND(SUM(
                                                        factory_rmStockIn_data.totalPrice
                                                    ),2) AS total_siPrice
                                                FROM
                                                    factory_rmStockIn_data
                                                GROUP BY
                                                    factory_rmStockIn_data.rawMaterialId
                                            ) AS si
                                            ON
                                                p.rawMaterialId = si.rawMaterialId
                                            LEFT JOIN(
                                                SELECT
                                                    factory_rmStockOut_data.rawMaterialId,
                                                    ROUND(SUM(
                                                        factory_rmStockOut_data.rawMaterialQty
                                                    ),2) AS total_quantity,
                                                    ROUND(SUM(
                                                        factory_rmStockOut_data.rmStockOutPrice
                                                    ),2) AS total_soPrice
                                                FROM
                                                    factory_rmStockOut_data
                                                GROUP BY
                                                    factory_rmStockOut_data.rawMaterialId
                                            ) AS so
                                            ON
                                                p.rawMaterialId = so.rawMaterialId
                                            LEFT JOIN(
                                                SELECT
                                                    rawMaterialId,
                                                    rmStockInDate,
                                                    CONCAT(stockInDisplayQty,' ',stockInDisplayUnit) AS rawMaterialQty,
                                                    rawMaterialPrice,
                                                    totalPrice
                                                FROM
                                                    factory_rmStockIn_data
                                                WHERE (rawMaterialId, rmStockInCreationDate) IN(
                                                    SELECT
                                                        rawMaterialId,
                                                        MAX(rmStockInCreationDate) As lastDate
                                                    FROM
                                                        factory_rmStockIn_data
                                                    GROUP BY
                                                        rawMaterialId
                                                )
                                            ) AS siLu
                                            ON
                                                p.rawMaterialId = siLu.rawMaterialId`;
            if (req.query.rawMaterialCategoryId) {
                if (req.query.rawMaterialStatus == 1) {
                    sql_queries_getdetails = `${sql_querry_staticQuery}
                                                WHERE p.rawMaterialCategoryId = '${data.rawMaterialCategoryId}' AND COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) >= p.minRawMaterialQty 
                                                ORDER BY p.rawMaterialName`;
                } else if (req.query.rawMaterialStatus == 2) {
                    sql_queries_getdetails = `${sql_querry_staticQuery}
                                                WHERE p.rawMaterialCategoryId = '${data.rawMaterialCategoryId}' AND COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) < p.minRawMaterialQty AND COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) != 0
                                                ORDER BY p.rawMaterialName`;
                } else if (req.query.rawMaterialStatus == 3) {
                    sql_queries_getdetails = `${sql_querry_staticQuery}
                                                WHERE p.rawMaterialCategoryId = '${data.rawMaterialCategoryId}' AND COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) = 0
                                                ORDER BY p.rawMaterialName`;
                } else if (req.query.startDate && req.query.endDate) {
                    sql_queries_getdetails = `${sql_querry_getMwSiSO}
                                              LEFT JOIN(
                                                SELECT
                                                    factory_rmStockIn_data.rawMaterialId,
                                                    ROUND(SUM(
                                                        factory_rmStockIn_data.rawMaterialQty
                                                    ),2) AS total_quantity,
                                                    ROUND(SUM(
                                                        factory_rmStockIn_data.totalPrice
                                                    )) AS totalExpense
                                                FROM
                                                    factory_rmStockIn_data
                                                WHERE
                                                 factory_rmStockIn_data.rmStockInDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')
                                                GROUP BY
                                                    factory_rmStockIn_data.rawMaterialId
                                            ) AS simw
                                            ON
                                            p.rawMaterialId = simw.rawMaterialId
                                        LEFT JOIN(
                                            SELECT
                                                factory_rmStockOut_data.rawMaterialId,
                                                ROUND(SUM(
                                                    factory_rmStockOut_data.rawMaterialQty
                                                ),2) AS total_quantity,
                                                ROUND(SUM(
                                                        factory_rmStockOut_data.rmStockOutPrice
                                                )) AS totalStockOutPrice
                                            FROM
                                                factory_rmStockOut_data
                                            WHERE
                                               factory_rmStockOut_data.rmStockOutDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')
                                            GROUP BY
                                                factory_rmStockOut_data.rawMaterialId
                                        ) AS somw
                                        ON
                                        p.rawMaterialId = somw.rawMaterialId
                                        WHERE p.rawMaterialCategoryId = '${data.rawMaterialCategoryId}'
                                        ORDER BY p.rawMaterialName`;
                } else {
                    sql_queries_getdetails = `${sql_querry_getMwSiSO}
                                              LEFT JOIN(
                                                SELECT
                                                    factory_rmStockIn_data.rawMaterialId,
                                                    ROUND(SUM(
                                                        factory_rmStockIn_data.rawMaterialQty
                                                    ),2) AS total_quantity,
                                                    ROUND(SUM(
                                                        factory_rmStockIn_data.totalPrice
                                                    )) AS totalExpense
                                                FROM
                                                    factory_rmStockIn_data
                                                WHERE
                                                    factory_rmStockIn_data.rmStockInDate BETWEEN STR_TO_DATE('${firstDay}','%b %d %Y') AND STR_TO_DATE('${lastDay}','%b %d %Y')
                                                GROUP BY
                                                    factory_rmStockIn_data.rawMaterialId
                                            ) AS simw
                                            ON
                                            p.rawMaterialId = simw.rawMaterialId
                                        LEFT JOIN(
                                            SELECT
                                                factory_rmStockOut_data.rawMaterialId,
                                                ROUND(SUM(
                                                    factory_rmStockOut_data.rawMaterialQty
                                                ),2) AS total_quantity,
                                                ROUND(SUM(
                                                    factory_rmStockOut_data.rmStockOutPrice
                                                )) AS totalStockOutPrice
                                            FROM
                                                factory_rmStockOut_data
                                            WHERE
                                               factory_rmStockOut_data.rmStockOutDate BETWEEN STR_TO_DATE('${firstDay}','%b %d %Y') AND STR_TO_DATE('${lastDay}','%b %d %Y')
                                            GROUP BY
                                                factory_rmStockOut_data.rawMaterialId
                                        ) AS somw
                                        ON
                                        p.rawMaterialId = somw.rawMaterialId
                                        WHERE p.rawMaterialCategoryId = '${data.rawMaterialCategoryId}'
                                        ORDER BY p.rawMaterialName`;
                }
            } else {
                if (req.query.rawMaterialStatus == 1) {
                    sql_queries_getdetails = `${sql_querry_staticQuery}
                                                WHERE COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) >= p.minRawMaterialQty 
                                                ORDER BY p.rawMaterialName`;
                } else if (req.query.rawMaterialStatus == 2) {
                    sql_queries_getdetails = `${sql_querry_staticQuery}
                                                WHERE COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) < p.minRawMaterialQty AND COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) != 0
                                                ORDER BY p.rawMaterialName`;
                } else if (req.query.rawMaterialStatus == 3) {
                    sql_queries_getdetails = `${sql_querry_staticQuery}
                                                WHERE COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) = 0
                                                ORDER BY p.rawMaterialName`;
                } else if (req.query.startDate && req.query.endDate) {
                    sql_queries_getdetails = `${sql_querry_getMwSiSO}
                                              LEFT JOIN(
                                                SELECT
                                                    factory_rmStockIn_data.rawMaterialId,
                                                    ROUND(SUM(
                                                        factory_rmStockIn_data.rawMaterialQty
                                                    ),2) AS total_quantity,
                                                    ROUND(SUM(
                                                        factory_rmStockIn_data.totalPrice
                                                    )) AS totalExpense
                                                FROM
                                                    factory_rmStockIn_data
                                                WHERE
                                                 factory_rmStockIn_data.rmStockInDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')
                                                GROUP BY
                                                    factory_rmStockIn_data.rawMaterialId
                                            ) AS simw
                                            ON
                                            p.rawMaterialId = simw.rawMaterialId
                                        LEFT JOIN(
                                            SELECT
                                                factory_rmStockOut_data.rawMaterialId,
                                                ROUND(SUM(
                                                    factory_rmStockOut_data.rawMaterialQty
                                                ),2) AS total_quantity,
                                                ROUND(SUM(
                                                        factory_rmStockOut_data.rmStockOutPrice
                                                )) AS totalStockOutPrice
                                            FROM
                                                factory_rmStockOut_data
                                            WHERE
                                               factory_rmStockOut_data.rmStockOutDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')
                                            GROUP BY
                                                factory_rmStockOut_data.rawMaterialId
                                        ) AS somw
                                        ON
                                        p.rawMaterialId = somw.rawMaterialId
                                        ORDER BY p.rawMaterialName`;
                } else {
                    sql_queries_getdetails = `${sql_querry_getMwSiSO}
                                              LEFT JOIN(
                                                SELECT
                                                    factory_rmStockIn_data.rawMaterialId,
                                                    ROUND(SUM(
                                                        factory_rmStockIn_data.rawMaterialQty
                                                    ),2) AS total_quantity,
                                                    ROUND(SUM(
                                                        factory_rmStockIn_data.totalPrice
                                                    )) AS totalExpense
                                                FROM
                                                    factory_rmStockIn_data
                                                WHERE
                                                    factory_rmStockIn_data.rmStockInDate BETWEEN STR_TO_DATE('${firstDay}','%b %d %Y') AND STR_TO_DATE('${lastDay}','%b %d %Y')
                                                GROUP BY
                                                    factory_rmStockIn_data.rawMaterialId
                                            ) AS simw
                                            ON
                                            p.rawMaterialId = simw.rawMaterialId
                                        LEFT JOIN(
                                            SELECT
                                                factory_rmStockOut_data.rawMaterialId,
                                                ROUND(SUM(
                                                    factory_rmStockOut_data.rawMaterialQty
                                                ),2) AS total_quantity,
                                                ROUND(SUM(
                                                    factory_rmStockOut_data.rmStockOutPrice
                                                )) AS totalStockOutPrice
                                            FROM
                                                factory_rmStockOut_data
                                            WHERE
                                                factory_rmStockOut_data.rmStockOutDate BETWEEN STR_TO_DATE('${firstDay}','%b %d %Y') AND STR_TO_DATE('${lastDay}','%b %d %Y')
                                            GROUP BY
                                                factory_rmStockOut_data.rawMaterialId
                                        ) AS somw
                                        ON
                                        p.rawMaterialId = somw.rawMaterialId
                                        ORDER BY p.rawMaterialName`;
                }
            }
            pool.query(sql_queries_getdetails, (err, rows) => {
                if (err) {
                    console.error("An error occurd in SQL Queery", err);
                    return res.status(500).send('Database Error');
                } else if (rows && rows.length <= 0) {
                    return res.status(400).send('No Data Found');
                } else {
                    const datas = Object.values(JSON.parse(JSON.stringify(rows)));
                    processDatas(datas)
                        .then((data) => {
                            const rows = datas ? datas.map((element, index) => data[index] && data[index].convertedQuantity ? { ...element, remainingStock: data[index].convertedQuantity, allConversation: data[index].vikJson } : { ...element, remainingStock: element.remainingStock + ' ' + element.minRawMaterialUnit, allConversation: data[index].vikJson },
                            ) : []
                            let newData = [];
                            Promise.all(
                                rows ? rows.map(async (element, index) => {
                                    let newElement = element;
                                    return await newConversationAsync(element.purchese, element.rawMaterialId, element.minRawMaterialUnit)
                                        .then(async (res) => {
                                            newElement = { ...newElement, purchese: res }
                                            return await newConversationAsync(element.totalUsed, element.rawMaterialId, element.minRawMaterialUnit)
                                                .then((res) => {
                                                    newElement = { ...newElement, totalUsed: res }
                                                    newData.push(newElement)
                                                    return newElement
                                                }).catch(error => {
                                                    console.error('Error in processing datas :', error);
                                                    return res.status(500).send('Internal Error');
                                                });
                                        }).catch(error => {
                                            console.error('Error in processing datas :', error);
                                            return res.status(500).send('Internal Error');
                                        });
                                }) : [])
                                .then((rows) => {
                                    const extractedData = rows.map(rm => {
                                        return {
                                            "Raw Material Name": rm.rawMaterialName,
                                            "Total Purchese": rm.purchese,
                                            "Total Used": rm.totalUsed,
                                            "Remaining": rm.remainingStock,
                                            "Last In Qty": rm.lastUpdatedQty,
                                            "Last Total Price": parseFloat(rm.totalPrice).toLocaleString('en-IN'),
                                            "Raw Material Price": rm.lastPrice,
                                            "Last In Date": rm.lastUpdatedStockInDate,
                                            "Status": rm.stockStatus
                                        };
                                    });
                                    const abc = extractedData;

                                    if (req.query.startDate && req.query.endDate) {
                                        tableHeading = `Raw Material Data From ${data.startDate} To ${data.endDate}`;
                                    } else {
                                        tableHeading = `Raw Material Data From ${firstDay} To ${lastDay}`;
                                    }

                                    createPDF(res, abc, tableHeading)
                                        .then(() => {
                                            console.log('PDF created successfully');
                                            res.status(200);
                                        })
                                        .catch((err) => {
                                            console.log(err);
                                            res.status(500).send('Error creating PDF');
                                        });
                                }).catch(error => {
                                    console.error('Error in processing datas :', error);
                                    return res.status(500).send('Internal Error');
                                });
                        }).catch(error => {
                            console.error('Error in processing datas :', error);
                            return res.status(500).send('Internal Error');
                        });
                }
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
    addRawMaterial,
    getRawMaterialListCounter,
    updateRawMaterial,
    removeRawMaterial,
    getRawMaterialList,
    getRowMaterialCountDetailsById,
    getSupplierByRawMaterialId,
    getRawMaterialTable,
    exportExcelSheetForRawMaterialTable,
    getRawMaterialDetailsById,
    getCategoryWiseUsedByRawMaterial,
    getRmUnitPreferenceById,
    exportPdfForAllRawMaterialData
}
