const pool = require('../../../database');
const jwt = require("jsonwebtoken");
const excelJS = require("exceljs");
const { jsPDF } = require('jspdf');
require('jspdf-autotable');
const { processDatas, newConversationAsync, computeConversionFactors } = require("./mfConversation.controller");

// Get Manufacture Product Detalis By Id

const getmfProductDetailsById = (req, res) => {
    try {
        const mfProductId = req.query.mfProductId;
        if (!mfProductId) {
            return res.status(404).send('ProductId Not Found');
        }
        sql_queries_getdetails = `SELECT mfProductId, mfProductName AS productName, mfGujaratiProductName AS gujaratiProductName, minMfProductQty AS minProductQty, minMfProductUnit AS minProductUnit, productionTime, isExpired, expiredDays FROM factory_manufactureProduct_data WHERE mfProductId = '${mfProductId}';
                                  SELECT priorityNumber, bigUnitName, unitNumber, smallUnitName FROM mfProduct_unit_preference WHERE mfProductId = '${mfProductId}';
                                  SELECT productCategoryId FROM inventory_product_data WHERE productId = '${mfProductId}'`;
        pool.query(sql_queries_getdetails, (err, data) => {
            if (err) {
                console.error("An error occurd in SQL Queery", err);
                return res.status(500).send('Database Error');
            }

            const unitNames = data && data[1].length ? data[1].map(item => item.bigUnitName) : [];
            unitNames.splice(0, 0, data[0][0].minProductUnit);
            const mergedObject = {
                ...data[0][0], // Copy the first object as it contains the mf information
                productCategoryId: data && data[2].length ? data[2][0].productCategoryId : null,
                priorityArray: data && data[1].length ? data[1] : [], // Assign the second array as "priorityArray"
                unitArr: unitNames && unitNames.length ? unitNames : [data[0][0].minProductUnit]
            };
            return res.status(200).send(mergedObject);
        })
    } catch (error) {
        console.error('An error occurd', error);
        res.status(500).send('Internal Server Error');
    }
}

// Get Raw Material Counter Details

const getMfProductCountDetailsById = (req, res) => {
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
                mfProductId: req.query.mfProductId
            }
            if (!data.mfProductId) {
                return res.status(404).send('ProductId Not Found...!');
            }
            const sql_querry_StatickCCount = `SELECT
                                                p.minMfProductQty,
                                                p.minMfProductUnit,
                                                COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) AS remainingStock,
                                                COALESCE(ROUND(siLu.mfProductPrice,2), 0) AS lastPrice,
                                                COALESCE(si.total_siPrice, 0) - COALESCE(so.total_soPrice, 0) AS remainPrice
                                              FROM
                                                factory_manufactureProduct_data AS p
                                              LEFT JOIN(
                                                SELECT
                                                    factory_mfProductStockIn_data.mfProductId,
                                                    ROUND(SUM(
                                                        factory_mfProductStockIn_data.mfProductQty
                                                    ),2) AS total_quantity,
                                                    ROUND(SUM(
                                                    factory_mfProductStockIn_data.totalPrice
                                                    )) AS total_siPrice
                                                FROM
                                                    factory_mfProductStockIn_data
                                                GROUP BY
                                                    factory_mfProductStockIn_data.mfProductId
                                              ) AS si
                                              ON
                                                p.mfProductId = si.mfProductId
                                              LEFT JOIN(
                                                   SELECT
                                                      factory_mfProductStockOut_data.mfProductId,
                                                      ROUND(SUM(
                                                          factory_mfProductStockOut_data.mfProductQty
                                                      ),2) AS total_quantity,
                                                      ROUND(SUM(
                                                          factory_mfProductStockOut_data.mfProductOutPrice
                                                      )) AS total_soPrice
                                                  FROM
                                                      factory_mfProductStockOut_data
                                                  GROUP BY
                                                      factory_mfProductStockOut_data.mfProductId
                                              ) AS so
                                              ON
                                                p.mfProductId = so.mfProductId
                                              LEFT JOIN(
                                                  SELECT
                                                      mfProductId,
                                                      mfStockInDate,
                                                      mfProductQty,
                                                      mfProductPrice
                                                  FROM
                                                      factory_mfProductStockIn_data
                                                  WHERE (mfProductId, mfStockInCreationDate) IN(
                                                      SELECT
                                                          mfProductId,
                                                          MAX(mfStockInCreationDate)
                                                      FROM
                                                          factory_mfProductStockIn_data
                                                      GROUP BY
                                                          mfProductId
                                                  )
                                              ) AS siLu
                                             ON
                                                p.mfProductId = siLu.mfProductId
                                             WHERE p.mfProductId = '${data.mfProductId}'`;
            if (req.query.startDate && req.query.endDate) {
                sql_querry_getRmCount = `SELECT COALESCE(ROUND(SUM(mfProductQty),2),0) AS purchase, COALESCE(ROUND(SUM(totalPrice)),0) AS totalRs FROM factory_mfProductStockIn_data WHERE factory_mfProductStockIn_data.mfProductId = '${data.mfProductId}'  AND factory_mfProductStockIn_data.mfStockInDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y');
                                         SELECT COALESCE(ROUND(SUM(mfProductQty),2),0) AS used, COALESCE(ROUND(SUM(mfProductOutPrice)),0) AS totalUsedPrice FROM factory_mfProductStockOut_data WHERE factory_mfProductStockOut_data.mfProductId = '${data.mfProductId}' AND factory_mfProductStockOut_data.mfStockOutDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y');
                                         ${sql_querry_StatickCCount}`;
            } else {
                sql_querry_getRmCount = `SELECT COALESCE(ROUND(SUM(mfProductQty),2),0) AS purchase, COALESCE(ROUND(SUM(totalPrice)),0) AS totalRs FROM factory_mfProductStockIn_data WHERE factory_mfProductStockIn_data.mfProductId = '${data.mfProductId}' AND factory_mfProductStockIn_data.mfStockInDate BETWEEN STR_TO_DATE('${firstDay}','%b %d %Y') AND STR_TO_DATE('${lastDay}','%b %d %Y');
                                         SELECT COALESCE(ROUND(SUM(mfProductQty),2),0) AS used, COALESCE(ROUND(SUM(mfProductOutPrice)),0) AS totalUsedPrice FROM factory_mfProductStockOut_data WHERE factory_mfProductStockOut_data.mfProductId = '${data.mfProductId}' AND factory_mfProductStockOut_data.mfStockOutDate BETWEEN STR_TO_DATE('${firstDay}','%b %d %Y') AND STR_TO_DATE('${lastDay}','%b %d %Y');
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
                            mfProductId: req.query.mfProductId,
                            remainingStock: results[0][0].purchase,
                            minMfProductUnit: results && results[2].length && results[2][0].minMfProductUnit ? results[2][0].minMfProductUnit : null
                        },
                        {
                            mfProductId: req.query.mfProductId,
                            remainingStock: results[1][0].used,
                            minMfProductUnit: results[2][0].minMfProductUnit
                        },
                        {
                            mfProductId: req.query.mfProductId,
                            remainingStock: results[2][0].remainingStock,
                            minMfProductUnit: results[2][0].minMfProductUnit
                        }
                    ]
                    processDatas(datas)
                        .then((data) => {
                            console.log('json 2', data);
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
                            console.log(convertedQuantities);


                            let totalRs = results[0][0].totalRs;
                            let totalUsedPrice = results[1][0].totalUsedPrice;
                            let remainUsedPrice = results[2][0].remainingStock != 0 ? results[2][0].remainPrice : 0;
                            let lastPrice = results[2][0].lastPrice;
                            let minMfProductQty = results[2][0].minMfProductQty;

                            convertedQuantities.push(
                                { totalRs: totalRs },
                                { totalUsedPrice: totalUsedPrice },
                                { remainUsedPrice: remainUsedPrice },
                                { lastPrice: lastPrice },
                                { minMfProductQty: minMfProductQty },
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

// Manufacture Product List Counter

const getMfProductListCounter = (req, res) => {
    try {
        let token;
        token = req.headers.authorization ? req.headers.authorization.split(" ")[1] : null;
        if (token) {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const departmentId = decoded.id.categoryId ? decoded.id.categoryId : null;
            if (departmentId) {
                const mfProductCategoryId = departmentId;
                var sql_querry_joins = `LEFT JOIN
                                    (
                                        SELECT
                                            factory_mfProductStockIn_data.mfProductId,
                                            ROUND(SUM(factory_mfProductStockIn_data.mfProductQty),2) AS total_quantity
                                        FROM
                                            factory_mfProductStockIn_data
                                        GROUP BY
                                            factory_mfProductStockIn_data.mfProductId
                                    ) AS si ON p.mfProductId = si.mfProductId
                                  LEFT JOIN
                                    (
                                        SELECT
                                            factory_mfProductStockOut_data.mfProductId,
                                            ROUND(SUM(factory_mfProductStockOut_data.mfProductQty),2) AS total_quantity
                                        FROM
                                            factory_mfProductStockOut_data
                                        GROUP BY
                                            factory_mfProductStockOut_data.mfProductId
                                    ) AS so ON p.mfProductId = so.mfProductId`;

                let sql_querry_getProductList = `SELECT COUNT(*) AS inStockMfProduct
                                             FROM
                                                 factory_manufactureProduct_data AS p
                                             ${sql_querry_joins}
                                             WHERE p.mfProductCategoryId = '${mfProductCategoryId}' AND COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) >= p.minMfProductQty;
                                             SELECT COUNT(*) AS underStockedMfProduct
                                             FROM
                                                 factory_manufactureProduct_data AS p
                                             ${sql_querry_joins}
                                                WHERE p.mfProductCategoryId = '${mfProductCategoryId}' AND COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) < p.minMfProductQty AND COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) != 0;
                                                SELECT COUNT(*) AS outOfStockMfProduct
                                             FROM
                                                 factory_manufactureProduct_data AS p
                                             ${sql_querry_joins}
                                             WHERE p.mfProductCategoryId = '${mfProductCategoryId}' AND p.mfProductCategoryId = '${mfProductCategoryId}' AND COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) = 0;
                                             SELECT COUNT(*) AS allMfProduct
                                             FROM
                                                 factory_manufactureProduct_data AS p
                                             ${sql_querry_joins}
                                             WHERE p.mfProductCategoryId = '${mfProductCategoryId}'`;

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
                            instockProduct: data[0][0].inStockMfProduct,
                            underStockedMfProduct: data[1][0].underStockedMfProduct,
                            outOfStock: data[2][0].outOfStockMfProduct,
                            allMfProduct: data[3][0].allMfProduct
                        }
                        return res.status(200).send(count);
                    }
                })
            } else {
                return res.status(404).send("Department Not Found");
            }
        } else {
            return res.status(401).send("Please Login Firest.....!");
        }
    } catch (error) {
        console.error('An error occurd', error);
        res.status(500).json('Internal Server Error');
    }
}

// Get Manufacture Product Details Table

const getManufactureProductTable = (req, res) => {
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
                var date = new Date(), y = date.getFullYear(), m = (date.getMonth());
                var firstDay = new Date(y, m, 1).toString().slice(4, 15);
                var lastDay = new Date(y, m + 1, 0).toString().slice(4, 15);

                console.log("1111>>>>", firstDay);
                console.log("1111>>>>", lastDay);
                const data = {
                    startDate: (req.query.startDate ? req.query.startDate : '').slice(4, 15),
                    endDate: (req.query.endDate ? req.query.endDate : '').slice(4, 15),
                    productStatus: req.query.productStatus,
                    searchProduct: req.query.searchProduct,
                    mfProductCategoryId: departmentId
                }
                const sql_querry_staticQuery = `SELECT
                                                p.mfProductId,
                                                UCASE(p.mfProductName) AS mfProductName,
                                                p.minMfProductQty,
                                                p.minMfProductUnit,
                                                CONCAT(p.productionTime,' ','Day') AS productionTime,
                                                p.isExpired,
                                                CONCAT(p.expiredDays,' ','Day') AS expiredDays,
                                                COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) AS remainingStock,
                                                COALESCE(siLu.mfProductPrice, 0) AS lastPrice,
                                                COALESCE(siLu.mfProductQty, 0) AS lastUpdatedQty,
                                                CASE
                                                WHEN EXISTS (
                                                    SELECT mfProductId FROM factory_rawMaterialRecipee_data WHERE mfProductId = p.mfProductId
                                                    UNION
                                                    SELECT mfProductId FROM factory_otherSourceRecipee_data WHERE mfProductId = p.mfProductId
                                                    UNION
                                                    SELECT mfProductId FROM factory_mfProductRecipee_data WHERE mfProductId = p.mfProductId
                                                )
                                                THEN 'true'
                                                ELSE 'false'
                                                END AS recipeeStatus,
                                                COALESCE(
                                                    DATE_FORMAT(siLu.mfStockInDate, '%d-%m-%Y'),
                                                    "No Update"
                                                ) AS lastUpdatedStockInDate,
                                                CASE WHEN COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) >= p.minMfProductQty THEN 'In-Stock' WHEN COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) < p.minMfProductQty AND COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) != 0 THEN 'Low-Stock' ELSE 'Out-Stock'
                                            END AS stockStatus
                                            FROM
                                                factory_manufactureProduct_data AS p
                                            LEFT JOIN(
                                                SELECT
                                                    factory_mfProductStockIn_data.mfProductId,
                                                    ROUND(SUM(
                                                        factory_mfProductStockIn_data.mfProductQty
                                                    ),2) AS total_quantity
                                                FROM
                                                    factory_mfProductStockIn_data
                                                GROUP BY
                                                    factory_mfProductStockIn_data.mfProductId
                                            ) AS si
                                            ON
                                                p.mfProductId = si.mfProductId
                                            LEFT JOIN(
                                                SELECT
                                                    factory_mfProductStockOut_data.mfProductId,
                                                    ROUND(SUM(
                                                        factory_mfProductStockOut_data.mfProductQty
                                                    ),2) AS total_quantity
                                                FROM
                                                    factory_mfProductStockOut_data
                                                GROUP BY
                                                    factory_mfProductStockOut_data.mfProductId
                                            ) AS so
                                            ON
                                                p.mfProductId = so.mfProductId
                                            LEFT JOIN(
                                                SELECT
                                                    mfProductId,
                                                    mfStockInDate,
                                                    mfProductQty,
                                                    mfProductPrice
                                                FROM
                                                    factory_mfProductStockIn_data
                                                WHERE (mfProductId, mfStockInCreationDate) IN(
                                                    SELECT
                                                        mfProductId,
                                                        MAX(mfStockInCreationDate)
                                                    FROM
                                                        factory_mfProductStockIn_data
                                                    GROUP BY
                                                        mfProductId
                                                )
                                            ) AS siLu
                                            ON
                                                p.mfProductId = siLu.mfProductId`;
                const sql_querry_getMwSiSO = `SELECT
                                                p.mfProductId,
                                                UCASE(p.mfProductName) AS mfProductName,
                                                p.minMfProductQty,
                                                p.minMfProductUnit,
                                                CONCAT(p.productionTime,' ','Day') AS productionTime,
                                                p.isExpired,
                                                CONCAT(p.expiredDays,' ','Day') AS expiredDays,
                                                COALESCE(simw.total_quantity, 0) AS purchese,
                                                COALESCE(somw.total_quantity, 0) AS totalUsed,
                                                COALESCE(simw.totalExpense,0) AS totalExpense,
                                                COALESCE(somw.totalStockOutPrice,0) AS totalStockOutPrice,
                                                COALESCE(si.total_siPrice, 0) - COALESCE(so.total_soPrice, 0) AS remainPrice,
                                                COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) AS remainingStock,
                                                COALESCE(siLu.mfProductPrice, 0) AS lastPrice,
                                                COALESCE(siLu.mfProductQty, 0) AS lastUpdatedQty,
                                                CASE
                                                WHEN EXISTS (
                                                    SELECT mfProductId FROM factory_rawMaterialRecipee_data WHERE mfProductId = p.mfProductId
                                                    UNION
                                                    SELECT mfProductId FROM factory_otherSourceRecipee_data WHERE mfProductId = p.mfProductId
                                                    UNION
                                                    SELECT mfProductId FROM factory_mfProductRecipee_data WHERE mfProductId = p.mfProductId
                                                )
                                                THEN true
                                                ELSE false
                                                END AS recipeeStatus,
                                                COALESCE(
                                                    DATE_FORMAT(siLu.mfStockInDate, '%d-%m-%Y'),
                                                    "No Update"
                                                ) AS lastUpdatedStockInDate,
                                                CASE WHEN COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) >= p.minMfProductQty THEN 'In-Stock' WHEN COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) < p.minMfProductQty AND COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) != 0 THEN 'Low-Stock' ELSE 'Out-Stock'
                                            END AS stockStatus
                                            FROM
                                                factory_manufactureProduct_data AS p
                                            LEFT JOIN(
                                                SELECT
                                                    factory_mfProductStockIn_data.mfProductId,
                                                    ROUND(SUM(
                                                        factory_mfProductStockIn_data.mfProductQty
                                                    ),2) AS total_quantity,
                                                    ROUND(SUM(
                                                        factory_mfProductStockIn_data.totalPrice
                                                    ),2) AS total_siPrice
                                                FROM
                                                    factory_mfProductStockIn_data
                                                GROUP BY
                                                    factory_mfProductStockIn_data.mfProductId
                                            ) AS si
                                            ON
                                                p.mfProductId = si.mfProductId
                                            LEFT JOIN(
                                                SELECT
                                                    factory_mfProductStockOut_data.mfProductId,
                                                    ROUND(SUM(
                                                        factory_mfProductStockOut_data.mfProductQty
                                                    ),2) AS total_quantity,
                                                    ROUND(SUM(
                                                        factory_mfProductStockOut_data.mfProductOutPrice
                                                    ),2) AS total_soPrice
                                                FROM
                                                    factory_mfProductStockOut_data
                                                GROUP BY
                                                    factory_mfProductStockOut_data.mfProductId
                                            ) AS so
                                            ON
                                                p.mfProductId = so.mfProductId
                                            LEFT JOIN(
                                                SELECT
                                                    mfProductId,
                                                    mfStockInDate,
                                                    mfProductQty,
                                                    mfProductPrice
                                                FROM
                                                    factory_mfProductStockIn_data
                                                WHERE (mfProductId, mfStockInCreationDate) IN(
                                                    SELECT
                                                        mfProductId,
                                                        MAX(mfStockInCreationDate) As lastDate
                                                    FROM
                                                        factory_mfProductStockIn_data
                                                    GROUP BY
                                                        mfProductId
                                                )
                                            ) AS siLu
                                            ON
                                                p.mfProductId = siLu.mfProductId`;
                const sql_querry_joins = `LEFT JOIN
                                                    (
                                                        SELECT
                                                            factory_mfProductStockIn_data.mfProductId,
                                                            ROUND(SUM(factory_mfProductStockIn_data.mfProductQty),2) AS total_quantity
                                                        FROM
                                                            factory_mfProductStockIn_data
                                                        GROUP BY
                                                            factory_mfProductStockIn_data.mfProductId
                                                    ) AS si ON p.mfProductId = si.mfProductId
                                          LEFT JOIN
                                                    (
                                                        SELECT
                                                            factory_mfProductStockOut_data.mfProductId,
                                                            ROUND(SUM(factory_mfProductStockOut_data.mfProductQty),2) AS total_quantity
                                                        FROM
                                                            factory_mfProductStockOut_data
                                                        GROUP BY
                                                            factory_mfProductStockOut_data.mfProductId
                                                    ) AS so ON p.mfProductId = so.mfProductId`;

                if (req.query.productStatus == 1) {
                    sql_get_pagination = `SELECT COUNT(*) AS numRows FROM factory_manufactureProduct_data AS p
                                                ${sql_querry_joins}
                                                WHERE p.mfProductCategoryId = '${data.mfProductCategoryId}' AND COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) >= p.minMfProductQty`;
                } else if (req.query.productStatus == 2) {
                    sql_get_pagination = `SELECT COUNT(*) AS numRows FROM factory_manufactureProduct_data AS p
                                                ${sql_querry_joins}
                                                WHERE p.mfProductCategoryId = '${data.mfProductCategoryId}' AND COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) < p.minMfProductQty AND COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) != 0`;
                } else if (req.query.productStatus == 3) {
                    sql_get_pagination = `SELECT COUNT(*) AS numRows FROM factory_manufactureProduct_data AS p
                                                ${sql_querry_joins}
                                                WHERE p.mfProductCategoryId = '${data.mfProductCategoryId}' AND COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) = 0`;
                } else if (req.query.startDate && req.query.endDate && req.query.searchProduct) {
                    sql_get_pagination = `SELECT COUNT(*) AS numRows FROM factory_manufactureProduct_data AS p
                                        ${sql_querry_joins}
                                        LEFT JOIN(
                                            SELECT
                                                factory_mfProductStockIn_data.mfProductId,
                                                ROUND(SUM(
                                                    factory_mfProductStockIn_data.mfProductQty
                                                ),2) AS total_quantity,
                                                ROUND(SUM(
                                                    factory_mfProductStockIn_data.totalPrice
                                                )) AS totalExpense
                                            FROM
                                                factory_mfProductStockIn_data
                                            WHERE
                                                factory_mfProductStockIn_data.mfStockInDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')
                                            GROUP BY
                                                factory_mfProductStockIn_data.mfProductId
                                        ) AS simw
                                        ON
                                            p.mfProductId = simw.mfProductId
                                        LEFT JOIN(
                                            SELECT
                                                factory_mfProductStockOut_data.mfProductId,
                                                ROUND(SUM(
                                                    factory_mfProductStockOut_data.mfProductQty
                                                ),2) AS total_quantity
                                            FROM
                                                factory_mfProductStockOut_data
                                            WHERE
                                                factory_mfProductStockOut_data.mfStockOutDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')
                                            GROUP BY
                                                factory_mfProductStockOut_data.mfProductId
                                        ) AS somw
                                        ON
                                            p.mfProductId = somw.mfProductId
                                        WHERE p.mfProductCategoryId = '${data.mfProductCategoryId}' AND p.mfProductName LIKE '%` + data.searchProduct + `%'`;
                } else if (req.query.startDate && req.query.endDate) {
                    sql_get_pagination = `SELECT COUNT(*) AS numRows FROM factory_manufactureProduct_data AS p
                                        ${sql_querry_joins}
                                        LEFT JOIN(
                                            SELECT
                                                factory_mfProductStockIn_data.mfProductId,
                                                ROUND(SUM(
                                                    factory_mfProductStockIn_data.mfProductQty
                                                ),2) AS total_quantity,
                                                ROUND(SUM(
                                                    factory_mfProductStockIn_data.totalPrice
                                                )) AS totalExpense
                                            FROM
                                                factory_mfProductStockIn_data
                                            WHERE
                                                factory_mfProductStockIn_data.mfStockInDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')
                                            GROUP BY
                                                factory_mfProductStockIn_data.mfProductId
                                        ) AS simw
                                        ON
                                            p.mfProductId = simw.mfProductId
                                        LEFT JOIN(
                                            SELECT
                                                factory_mfProductStockOut_data.mfProductId,
                                                ROUND(SUM(
                                                    factory_mfProductStockOut_data.mfProductQty
                                                ),2) AS total_quantity
                                            FROM
                                                factory_mfProductStockOut_data
                                            WHERE
                                                factory_mfProductStockOut_data.mfStockOutDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')
                                            GROUP BY
                                                factory_mfProductStockOut_data.mfProductId
                                        ) AS somw
                                        ON
                                            p.mfProductId = somw.mfProductId
                                        WHERE p.mfProductCategoryId = '${data.mfProductCategoryId}'`;
                } else if (req.query.searchProduct) {
                    sql_get_pagination = `SELECT COUNT(*) AS numRows FROM factory_manufactureProduct_data AS p
                                        ${sql_querry_joins}
                                        LEFT JOIN(
                                            SELECT
                                                factory_mfProductStockIn_data.mfProductId,
                                                ROUND(SUM(
                                                    factory_mfProductStockIn_data.mfProductQty
                                                ),2) AS total_quantity,
                                                ROUND(SUM(
                                                    factory_mfProductStockIn_data.totalPrice
                                                )) AS totalExpense
                                            FROM
                                                factory_mfProductStockIn_data
                                            WHERE
                                                factory_mfProductStockIn_data.mfStockInDate BETWEEN STR_TO_DATE('${firstDay}','%b %d %Y') AND STR_TO_DATE('${lastDay}','%b %d %Y')
                                            GROUP BY
                                                factory_mfProductStockIn_data.mfProductId
                                        ) AS simw
                                        ON
                                            p.mfProductId = simw.mfProductId
                                        LEFT JOIN(
                                            SELECT
                                                factory_mfProductStockOut_data.mfProductId,
                                                ROUND(SUM(
                                                    factory_mfProductStockOut_data.mfProductQty
                                                ),2) AS total_quantity
                                            FROM
                                                factory_mfProductStockOut_data
                                            WHERE
                                                factory_mfProductStockOut_data.mfStockOutDate BETWEEN STR_TO_DATE('${firstDay}','%b %d %Y') AND STR_TO_DATE('${lastDay}','%b %d %Y')
                                            GROUP BY
                                                factory_mfProductStockOut_data.mfProductId
                                        ) AS somw
                                        ON
                                            p.mfProductId = somw.mfProductId
                                        WHERE p.mfProductCategoryId = '${data.mfProductCategoryId}' AND p.mfProductName LIKE '%` + data.searchProduct + `%'`;
                } else {
                    sql_get_pagination = `SELECT COUNT(*) AS numRows
                                        FROM
                                        factory_manufactureProduct_data AS p
                                        ${sql_querry_joins}
                                        LEFT JOIN(
                                            SELECT
                                                factory_mfProductStockIn_data.mfProductId,
                                                ROUND(SUM(
                                                    factory_mfProductStockIn_data.mfProductQty
                                                ),2) AS total_quantity,
                                                ROUND(SUM(
                                                    factory_mfProductStockIn_data.totalPrice
                                                )) AS totalExpense
                                            FROM
                                                factory_mfProductStockIn_data
                                            WHERE
                                                factory_mfProductStockIn_data.mfStockInDate BETWEEN STR_TO_DATE('${firstDay}','%b %d %Y') AND STR_TO_DATE('${lastDay}','%b %d %Y')
                                            GROUP BY
                                                factory_mfProductStockIn_data.mfProductId
                                        ) AS simw
                                        ON
                                            p.mfProductId = simw.mfProductId
                                        LEFT JOIN(
                                            SELECT
                                                factory_mfProductStockOut_data.mfProductId,
                                                ROUND(SUM(
                                                    factory_mfProductStockOut_data.mfProductQty
                                                ),2) AS total_quantity
                                            FROM
                                                factory_mfProductStockOut_data
                                            WHERE
                                                factory_mfProductStockOut_data.mfStockOutDate BETWEEN STR_TO_DATE('${firstDay}','%b %d %Y') AND STR_TO_DATE('${lastDay}','%b %d %Y')
                                            GROUP BY
                                                factory_mfProductStockOut_data.mfProductId
                                        ) AS somw
                                        ON
                                            p.mfProductId = somw.mfProductId
                                        WHERE p.mfProductCategoryId = '${data.mfProductCategoryId}'`;
                }

                pool.query(sql_get_pagination, (err, rows, fields) => {
                    if (err) {
                        console.error("An error occurd in SQL Queery", err);
                        return res.status(500).send('Database Error');
                    } else {
                        const numRows = rows[0].numRows;
                        const numPages = Math.ceil(numRows / numPerPage);
                        if (req.query.mfProductCategoryId) {
                            if (req.query.productStatus == 1) {
                                sql_queries_getdetails = `${sql_querry_staticQuery}
                                                WHERE p.mfProductCategoryId = '${data.mfProductCategoryId}' AND COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) >= p.minMfProductQty 
                                                ORDER BY p.mfProductName LIMIT ${limit}`;
                            } else if (req.query.productStatus == 2) {
                                sql_queries_getdetails = `${sql_querry_staticQuery}
                                                WHERE p.mfProductCategoryId = '${data.mfProductCategoryId}' AND COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) < p.minMfProductQty AND COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) != 0
                                                ORDER BY p.mfProductName LIMIT ${limit}`;
                            } else if (req.query.productStatus == 3) {
                                sql_queries_getdetails = `${sql_querry_staticQuery}
                                                WHERE p.mfProductCategoryId = '${data.mfProductCategoryId}' AND COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) = 0
                                                ORDER BY p.mfProductName LIMIT ${limit}`;
                            } else if (req.query.startDate && req.query.endDate && req.query.searchProduct) {
                                sql_queries_getdetails = `${sql_querry_getMwSiSO}
                                              LEFT JOIN(
                                                SELECT
                                                    factory_mfProductStockIn_data.mfProductId,
                                                    ROUND(SUM(
                                                        factory_mfProductStockIn_data.mfProductQty
                                                    ),2) AS total_quantity,
                                                    ROUND(SUM(
                                                        factory_mfProductStockIn_data.totalPrice
                                                    )) AS totalExpense
                                                FROM
                                                    factory_mfProductStockIn_data
                                                WHERE
                                                    factory_mfProductStockIn_data.mfStockInDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')
                                                GROUP BY
                                                    factory_mfProductStockIn_data.mfProductId
                                            ) AS simw
                                            ON
                                            p.mfProductId = simw.mfProductId
                                        LEFT JOIN(
                                            SELECT
                                                factory_mfProductStockOut_data.mfProductId,
                                                ROUND(SUM(
                                                    factory_mfProductStockOut_data.mfProductQty
                                                ),2) AS total_quantity,
                                                ROUND(SUM(
                                                    factory_mfProductStockOut_data.mfProductOutPrice
                                                )) AS totalStockOutPrice
                                            FROM
                                                factory_mfProductStockOut_data
                                            WHERE
                                               factory_mfProductStockOut_data.mfStockOutDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')
                                            GROUP BY
                                                factory_mfProductStockOut_data.mfProductId
                                        ) AS somw
                                        ON
                                        p.mfProductId = somw.mfProductId 
                                        WHERE p.mfProductCategoryId = '${data.mfProductCategoryId}' AND p.mfProductName LIKE '%` + data.searchProduct + `%'
                                        ORDER BY p.mfProductName LIMIT ${limit}`
                            } else if (req.query.startDate && req.query.endDate) {
                                sql_queries_getdetails = `${sql_querry_getMwSiSO}
                                              LEFT JOIN(
                                                SELECT
                                                    factory_mfProductStockIn_data.mfProductId,
                                                    ROUND(SUM(
                                                        factory_mfProductStockIn_data.mfProductQty
                                                    ),2) AS total_quantity,
                                                    ROUND(SUM(
                                                        factory_mfProductStockIn_data.totalPrice
                                                    )) AS totalExpense
                                                FROM
                                                    factory_mfProductStockIn_data
                                                WHERE
                                                 factory_mfProductStockIn_data.mfStockInDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')
                                                GROUP BY
                                                    factory_mfProductStockIn_data.mfProductId
                                            ) AS simw
                                            ON
                                            p.mfProductId = simw.mfProductId
                                        LEFT JOIN(
                                            SELECT
                                                factory_mfProductStockOut_data.mfProductId,
                                                ROUND(SUM(
                                                    factory_mfProductStockOut_data.mfProductQty
                                                ),2) AS total_quantity,
                                                ROUND(SUM(
                                                        factory_mfProductStockOut_data.mfProductOutPrice
                                                )) AS totalStockOutPrice
                                            FROM
                                                factory_mfProductStockOut_data
                                            WHERE
                                               factory_mfProductStockOut_data.mfStockOutDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')
                                            GROUP BY
                                                factory_mfProductStockOut_data.mfProductId
                                        ) AS somw
                                        ON
                                        p.mfProductId = somw.mfProductId
                                        WHERE p.mfProductCategoryId = '${data.mfProductCategoryId}'
                                        ORDER BY p.mfProductName LIMIT ${limit}`
                            } else if (req.query.searchProduct) {
                                sql_queries_getdetails = `${sql_querry_getMwSiSO}
                                              LEFT JOIN(
                                                SELECT
                                                    factory_mfProductStockIn_data.mfProductId,
                                                    ROUND(SUM(
                                                        factory_mfProductStockIn_data.mfProductQty
                                                    ),2) AS total_quantity,
                                                    ROUND(SUM(
                                                        factory_mfProductStockIn_data.totalPrice
                                                    )) AS totalExpense
                                                FROM
                                                    factory_mfProductStockIn_data
                                                WHERE
                                                    factory_mfProductStockIn_data.mfStockInDate BETWEEN STR_TO_DATE('${firstDay}','%b %d %Y') AND STR_TO_DATE('${lastDay}','%b %d %Y')
                                                GROUP BY
                                                    factory_mfProductStockIn_data.mfProductId
                                            ) AS simw
                                            ON
                                            p.mfProductId = simw.mfProductId
                                        LEFT JOIN(
                                            SELECT
                                                factory_mfProductStockOut_data.mfProductId,
                                                ROUND(SUM(
                                                    factory_mfProductStockOut_data.mfProductQty
                                                ),2) AS total_quantity,
                                                ROUND(SUM(
                                                    factory_mfProductStockOut_data.mfProductOutPrice
                                                )) AS totalStockOutPrice
                                            FROM
                                                factory_mfProductStockOut_data
                                            WHERE
                                                factory_mfProductStockOut_data.mfStockOutDate BETWEEN STR_TO_DATE('${firstDay}','%b %d %Y') AND STR_TO_DATE('${lastDay}','%b %d %Y')
                                            GROUP BY
                                                factory_mfProductStockOut_data.mfProductId
                                        ) AS somw
                                        ON
                                        p.mfProductId = somw.mfProductId
                                        WHERE p.mfProductCategoryId = '${data.mfProductCategoryId}' AND p.mfProductName LIKE '%` + data.searchProduct + `%'
                                        ORDER BY p.mfProductName LIMIT ${limit}`
                            } else {
                                sql_queries_getdetails = `${sql_querry_getMwSiSO}
                                              LEFT JOIN(
                                                SELECT
                                                    factory_mfProductStockIn_data.mfProductId,
                                                    ROUND(SUM(
                                                        factory_mfProductStockIn_data.mfProductQty
                                                    ),2) AS total_quantity,
                                                    ROUND(SUM(
                                                        factory_mfProductStockIn_data.totalPrice
                                                    )) AS totalExpense
                                                FROM
                                                    factory_mfProductStockIn_data
                                                WHERE
                                                    factory_mfProductStockIn_data.mfStockInDate BETWEEN STR_TO_DATE('${firstDay}','%b %d %Y') AND STR_TO_DATE('${lastDay}','%b %d %Y')
                                                GROUP BY
                                                    factory_mfProductStockIn_data.mfProductId
                                            ) AS simw
                                            ON
                                            p.mfProductId = simw.mfProductId
                                        LEFT JOIN(
                                            SELECT
                                                factory_mfProductStockOut_data.mfProductId,
                                                ROUND(SUM(
                                                    factory_mfProductStockOut_data.mfProductQty
                                                ),2) AS total_quantity,
                                                ROUND(SUM(
                                                    factory_mfProductStockOut_data.mfProductOutPrice
                                                )) AS totalStockOutPrice
                                            FROM
                                                factory_mfProductStockOut_data
                                            WHERE
                                                factory_mfProductStockOut_data.mfStockOutDate BETWEEN STR_TO_DATE('${firstDay}','%b %d %Y') AND STR_TO_DATE('${lastDay}','%b %d %Y')
                                            GROUP BY
                                                factory_mfProductStockOut_data.mfProductId
                                        ) AS somw
                                        ON
                                        p.mfProductId = somw.mfProductId
                                        WHERE p.mfProductCategoryId = '${data.mfProductCategoryId}'
                                        ORDER BY p.mfProductName LIMIT ${limit}`
                            }
                        } else {
                            if (req.query.productStatus == 1) {
                                sql_queries_getdetails = `${sql_querry_staticQuery}
                                                WHERE COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) >= p.minMfProductQty 
                                                ORDER BY p.mfProductName LIMIT ${limit}`;
                            } else if (req.query.productStatus == 2) {
                                sql_queries_getdetails = `${sql_querry_staticQuery}
                                                WHERE COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) < p.minMfProductQty AND COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) != 0
                                                ORDER BY p.mfProductName LIMIT ${limit}`;
                            } else if (req.query.productStatus == 3) {
                                sql_queries_getdetails = `${sql_querry_staticQuery}
                                                WHERE COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) = 0
                                                ORDER BY p.mfProductName LIMIT ${limit}`;
                            } else if (req.query.startDate && req.query.endDate && req.query.searchProduct) {
                                sql_queries_getdetails = `${sql_querry_getMwSiSO}
                                              LEFT JOIN(
                                                SELECT
                                                    factory_mfProductStockIn_data.mfProductId,
                                                    ROUND(SUM(
                                                        factory_mfProductStockIn_data.mfProductQty
                                                    ),2) AS total_quantity,
                                                    ROUND(SUM(
                                                        factory_mfProductStockIn_data.totalPrice
                                                    )) AS totalExpense
                                                FROM
                                                    factory_mfProductStockIn_data
                                                WHERE
                                                    factory_mfProductStockIn_data.mfStockInDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')
                                                GROUP BY
                                                    factory_mfProductStockIn_data.mfProductId
                                            ) AS simw
                                            ON
                                            p.mfProductId = simw.mfProductId
                                        LEFT JOIN(
                                            SELECT
                                                factory_mfProductStockOut_data.mfProductId,
                                                ROUND(SUM(
                                                    factory_mfProductStockOut_data.mfProductQty
                                                ),2) AS total_quantity,
                                                ROUND(SUM(
                                                    factory_mfProductStockOut_data.mfProductOutPrice
                                                )) AS totalStockOutPrice
                                            FROM
                                                factory_mfProductStockOut_data
                                            WHERE
                                                factory_mfProductStockOut_data.mfStockOutDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')
                                            GROUP BY
                                                factory_mfProductStockOut_data.mfProductId
                                        ) AS somw
                                        ON
                                        p.mfProductId = somw.mfProductId 
                                        WHERE p.mfProductName LIKE '%` + data.searchProduct + `%'
                                        ORDER BY p.mfProductName LIMIT ${limit}`
                            } else if (req.query.startDate && req.query.endDate) {
                                sql_queries_getdetails = `${sql_querry_getMwSiSO}
                                              LEFT JOIN(
                                                SELECT
                                                    factory_mfProductStockIn_data.mfProductId,
                                                    ROUND(SUM(
                                                        factory_mfProductStockIn_data.mfProductQty
                                                    ),2) AS total_quantity,
                                                    ROUND(SUM(
                                                        factory_mfProductStockIn_data.totalPrice
                                                    )) AS totalExpense
                                                FROM
                                                    factory_mfProductStockIn_data
                                                WHERE
                                                 factory_mfProductStockIn_data.mfStockInDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')
                                                GROUP BY
                                                    factory_mfProductStockIn_data.mfProductId
                                            ) AS simw
                                            ON
                                            p.mfProductId = simw.mfProductId
                                        LEFT JOIN(
                                            SELECT
                                                factory_mfProductStockOut_data.mfProductId,
                                                ROUND(SUM(
                                                    factory_mfProductStockOut_data.mfProductQty
                                                ),2) AS total_quantity,
                                                ROUND(SUM(
                                                        factory_mfProductStockOut_data.mfProductOutPrice
                                                )) AS totalStockOutPrice
                                            FROM
                                                factory_mfProductStockOut_data
                                            WHERE
                                               factory_mfProductStockOut_data.mfStockOutDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')
                                            GROUP BY
                                                factory_mfProductStockOut_data.mfProductId
                                        ) AS somw
                                        ON
                                        p.mfProductId = somw.mfProductId
                                        ORDER BY p.mfProductName LIMIT ${limit}`
                            } else if (req.query.searchProduct) {
                                sql_queries_getdetails = `${sql_querry_getMwSiSO}
                                              LEFT JOIN(
                                                SELECT
                                                    factory_mfProductStockIn_data.mfProductId,
                                                    ROUND(SUM(
                                                        factory_mfProductStockIn_data.mfProductQty
                                                    ),2) AS total_quantity,
                                                    ROUND(SUM(
                                                        factory_mfProductStockIn_data.totalPrice
                                                    )) AS totalExpense
                                                FROM
                                                    factory_mfProductStockIn_data
                                                WHERE
                                                   factory_mfProductStockIn_data.mfStockInDate BETWEEN STR_TO_DATE('${firstDay}','%b %d %Y') AND STR_TO_DATE('${lastDay}','%b %d %Y')
                                                GROUP BY
                                                    factory_mfProductStockIn_data.mfProductId
                                            ) AS simw
                                            ON
                                            p.mfProductId = simw.mfProductId
                                        LEFT JOIN(
                                            SELECT
                                                factory_mfProductStockOut_data.mfProductId,
                                                ROUND(SUM(
                                                    factory_mfProductStockOut_data.mfProductQty
                                                ),2) AS total_quantity,
                                                ROUND(SUM(
                                                    factory_mfProductStockOut_data.mfProductOutPrice
                                                )) AS totalStockOutPrice
                                            FROM
                                                factory_mfProductStockOut_data
                                            WHERE
                                                factory_mfProductStockOut_data.mfStockOutDate BETWEEN STR_TO_DATE('${firstDay}','%b %d %Y') AND STR_TO_DATE('${lastDay}','%b %d %Y')
                                            GROUP BY
                                                factory_mfProductStockOut_data.mfProductId
                                        ) AS somw
                                        ON
                                        p.mfProductId = somw.mfProductId
                                        WHERE p.mfProductName LIKE '%` + data.searchProduct + `%'
                                        ORDER BY p.mfProductName LIMIT ${limit}`
                            } else {
                                sql_queries_getdetails = `${sql_querry_getMwSiSO}
                                              LEFT JOIN(
                                                SELECT
                                                    factory_mfProductStockIn_data.mfProductId,
                                                    ROUND(SUM(
                                                        factory_mfProductStockIn_data.mfProductQty
                                                    ),2) AS total_quantity,
                                                    ROUND(SUM(
                                                        factory_mfProductStockIn_data.totalPrice
                                                    )) AS totalExpense
                                                FROM
                                                    factory_mfProductStockIn_data
                                                WHERE
                                                   factory_mfProductStockIn_data.mfStockInDate BETWEEN STR_TO_DATE('${firstDay}','%b %d %Y') AND STR_TO_DATE('${lastDay}','%b %d %Y')
                                                GROUP BY
                                                    factory_mfProductStockIn_data.mfProductId
                                            ) AS simw
                                            ON
                                            p.mfProductId = simw.mfProductId
                                        LEFT JOIN(
                                            SELECT
                                                factory_mfProductStockOut_data.mfProductId,
                                                ROUND(SUM(
                                                    factory_mfProductStockOut_data.mfProductQty
                                                ),2) AS total_quantity,
                                                ROUND(SUM(
                                                    factory_mfProductStockOut_data.mfProductOutPrice
                                                )) AS totalStockOutPrice
                                            FROM
                                                factory_mfProductStockOut_data
                                            WHERE
                                                factory_mfProductStockOut_data.mfStockOutDate BETWEEN STR_TO_DATE('${firstDay}','%b %d %Y') AND STR_TO_DATE('${lastDay}','%b %d %Y')
                                            GROUP BY
                                                factory_mfProductStockOut_data.mfProductId
                                        ) AS somw
                                        ON
                                        p.mfProductId = somw.mfProductId
                                        ORDER BY p.mfProductName LIMIT ${limit}`
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
                                            const rows = datas ? datas.map((element, index) => data[index] && data[index].convertedQuantity ? { ...element, remainingStock: data[index].convertedQuantity, allConversation: data[index].vikJson } : { ...element, remainingStock: element.remainingStock + ' ' + element.minMfProductUnit, allConversation: data[index].vikJson },
                                                // console.log(data[index] && data[index].convertedQuantity)
                                            ) : []
                                            let newData = [];
                                            Promise.all(
                                                rows ? rows.map(async (element, index) => {
                                                    let newElement = element;
                                                    return await newConversationAsync(element.purchese, element.mfProductId, element.minMfProductUnit)
                                                        .then(async (res) => {
                                                            newElement = { ...newElement, purchese: res }
                                                            return await newConversationAsync(element.totalUsed, element.mfProductId, element.minMfProductUnit)
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
                return res.status(404).send("Department Not Found");
            }
        } else {
            return res.status(401).send("Please Login Firest.....!");
        }
    } catch (error) {
        console.error('An error occurd', error);
        res.status(500).send('Internal Server Error');
    }
}

// Get Out Categiry Wise Mf Product Details

const getStaticsOutCategoryWiseMfProductData = (req, res) => {
    try {
        let token;
        token = req.headers.authorization ? req.headers.authorization.split(" ")[1] : null;
        if (token) {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const departmentId = decoded.id.categoryId ? decoded.id.categoryId : null;
            if (departmentId) {
                const data = {
                    startDate: (req.query.startDate ? req.query.startDate : '').slice(4, 15),
                    endDate: (req.query.endDate ? req.query.endDate : '').slice(4, 15),
                    outCategoryId: req.query.outCategoryId,
                    branchId: req.query.branchId,
                    searchWord: req.query.searchWord ? req.query.searchWord : '',
                }
                if (req.query.outCategoryId == 'Branch' && req.query.branchId) {
                    sql_queries_getdetails = `SELECT
                                                  ROUND(SUM(COALESCE(mfsod.costPrice, 0))) AS costPrice,
                                                  ROUND(SUM(COALESCE(isid.selAmt, 0))) AS sellAmt,
                                                  ROUND(SUM((COALESCE(isid.selAmt, 0))-(COALESCE(mfsod.costPrice, 0)))) AS profit
                                              FROM
                                                  factory_manufactureProduct_data AS mfpd
                                                 LEFT JOIN(
                                                                SELECT
                                                                    mfso.mfProductId,
                                                                    SUM(mfso.mfProductOutPrice) AS costPrice
                                                                FROM
                                                                    factory_mfProductStockOut_data AS mfso
                                                                WHERE
                                                                    mfso.mfProductOutCategory = '${data.outCategoryId}' AND mfso.mfStockOutId IN(
                                                                    SELECT
                                                                        COALESCE(isd.stockInId, NULL)
                                                                    FROM
                                                                        inventory_stockIn_data AS isd
                                                                    WHERE
                                                                        isd.branchId = '${data.branchId}'
                                                                ) AND 
                                                                ${req.query.startDate && req.query.endDate ? `mfso.mfStockOutDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')` : `mfso.mfStockOutDate >= DATE_SUB(CURDATE(), INTERVAL 1 MONTH) AND mfso.mfStockOutDate <= CURDATE()`}
                                                            GROUP BY
                                                                mfso.mfProductId) AS mfsod
                                                            ON
                                                                mfpd.mfProductId = mfsod.mfProductId
                                                        LEFT JOIN(
                                                            SELECT
                                                                isi.productId,
                                                                SUM(isi.productQty) AS qty,
                                                                SUM(isi.totalPrice) AS selAmt
                                                            FROM
                                                                inventory_stockIn_data AS isi
                                                            WHERE
                                                                isi.stockInId IN(
                                                                SELECT
                                                                    COALESCE(msod.mfStockOutId, NULL)
                                                                FROM
                                                                    factory_mfProductStockOut_data AS msod
                                                                WHERE
                                                                    msod.mfProductOutCategory = '${data.outCategoryId}'
                                                            ) AND isi.branchId = '${data.branchId}' AND 
                                                            ${req.query.startDate && req.query.endDate ? `isi.stockInDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')` : `isi.stockInDate >= DATE_SUB(CURDATE(), INTERVAL 1 MONTH) AND isi.stockInDate <= CURDATE()`}
                                                        GROUP BY
                                                            isi.productId) AS isid
                                                        ON
                                                            mfpd.mfProductId = isid.productId
                                                        WHERE mfpd.mfProductCategoryId = '${departmentId}'`;
                } else if (req.query.outCategoryId) {
                    sql_queries_getdetails = `SELECT
                                                  ROUND(SUM(COALESCE(mfsod.costPrice, 0))) AS costPrice,
                                                  ROUND(SUM(COALESCE(fdwod.sellAmt,isid.selAmt,autoWast.autoPrice,0))) AS sellAmt,
                                                  ROUND(SUM((COALESCE(fdwod.sellAmt,isid.selAmt,autoWast.autoPrice,0))-(COALESCE(mfsod.costPrice, 0)))) AS profit
                                              FROM
                                                factory_manufactureProduct_data AS mfpd
                                                  LEFT JOIN(
                                                            SELECT
                                                                mfsodAutoWast.mfProductId,
                                                                SUM(mfsodAutoWast.mfProductOutPrice) AS autoPrice
                                                            FROM
                                                                factory_mfProductStockOut_data AS mfsodAutoWast
                                                            WHERE
                                                                mfsodAutoWast.mfProductOutCategory IN ('${data.outCategoryId == 'Auto' ? 'Auto' : null}') AND
                                                                ${req.query.startDate && req.query.endDate ? `mfsodAutoWast.mfStockOutDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')` : ` mfsodAutoWast.mfStockOutDate >= DATE_SUB(CURDATE(), INTERVAL 1 MONTH) AND mfsodAutoWast.mfStockOutDate <= CURDATE()`}
                                                            GROUP BY
                                                                mfsodAutoWast.mfProductId) AS autoWast
                                                            ON
                                                                mfpd.mfProductId = autoWast.mfProductId
                                                        LEFT JOIN(
                                                            SELECT
                                                                mfso.mfProductId,
                                                                SUM(mfso.mfProductQty) AS qty,
                                                                SUM(mfso.mfProductOutPrice) AS costPrice
                                                            FROM
                                                                factory_mfProductStockOut_data AS mfso
                                                            WHERE
                                                                mfso.mfProductOutCategory = '${data.outCategoryId}' AND
                                                                ${req.query.startDate && req.query.endDate ? `mfso.mfStockOutDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')` : `mfso.mfStockOutDate >= DATE_SUB(CURDATE(), INTERVAL 1 MONTH) AND mfso.mfStockOutDate <= CURDATE()`}
                                                            GROUP BY
                                                                mfso.mfProductId) AS mfsod
                                                            ON
                                                                mfpd.mfProductId = mfsod.mfProductId
                                                        LEFT JOIN(
                                                            SELECT
                                                                fdow.mfProductId,
                                                                SUM(fdow.sellAmount) AS sellAmt
                                                            FROM
                                                                factory_distributorWiseOut_data AS fdow
                                                            WHERE
                                                                fdow.mfStockOutId IN(
                                                                SELECT
                                                                    COALESCE(msod.mfStockOutId, NULL)
                                                                FROM
                                                                    factory_mfProductStockOut_data AS msod
                                                                WHERE
                                                                    msod.mfProductOutCategory = '${data.outCategoryId}'
                                                            ) AND 
                                                            ${req.query.startDate && req.query.endDate ? `fdow.sellDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')` : `fdow.sellDate >= DATE_SUB(CURDATE(), INTERVAL 1 MONTH) AND fdow.sellDate <= CURDATE()`}
                                                        GROUP BY
                                                            fdow.mfProductId) AS fdwod
                                                        ON
                                                            mfpd.mfProductId = fdwod.mfProductId
                                                        LEFT JOIN(
                                                            SELECT
                                                                isi.productId,
                                                                SUM(isi.totalPrice) AS selAmt
                                                            FROM
                                                                inventory_stockIn_data AS isi
                                                            WHERE
                                                                isi.stockInId IN(
                                                                SELECT
                                                                    COALESCE(msod.mfStockOutId, NULL)
                                                                FROM
                                                                    factory_mfProductStockOut_data AS msod
                                                                WHERE
                                                                    msod.mfProductOutCategory = '${data.outCategoryId}'
                                                            ) AND 
                                                            ${req.query.startDate && req.query.endDate ? `isi.stockInDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')` : `isi.stockInDate >= DATE_SUB(CURDATE(), INTERVAL 1 MONTH) AND isi.stockInDate <= CURDATE()`}
                                                        GROUP BY
                                                            isi.productId) AS isid
                                                        ON
                                                            mfpd.mfProductId = isid.productId
                                                        WHERE mfpd.mfProductCategoryId = '${departmentId}'`;
                } else {
                    sql_queries_getdetails = `SELECT
                                                  ROUND(SUM(COALESCE(mfsod.costPrice, 0))) AS costPrice,
                                                  ROUND(SUM(COALESCE(fdwod.sellAmt,0) + COALESCE(isid.selAmt,0) + COALESCE(autoWast.autoPrice,0))) AS sellAmt,
                                                  ROUND(SUM((ROUND(COALESCE(fdwod.sellAmt,0) + COALESCE(isid.selAmt,0) + COALESCE(autoWast.autoPrice,0)))-(COALESCE(mfsod.costPrice, 0)))) AS profit
                                              FROM
                                                  factory_manufactureProduct_data AS mfpd
                                              LEFT JOIN(
                                                            SELECT
                                                                mfsodAutoWast.mfProductId,
                                                                SUM(mfsodAutoWast.mfProductOutPrice) AS autoPrice
                                                            FROM
                                                                factory_mfProductStockOut_data AS mfsodAutoWast
                                                            WHERE
                                                                mfsodAutoWast.mfProductOutCategory IN ('Auto') AND
                                                                ${req.query.startDate && req.query.endDate ? `mfsodAutoWast.mfStockOutDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')` : ` mfsodAutoWast.mfStockOutDate >= DATE_SUB(CURDATE(), INTERVAL 1 MONTH) AND mfsodAutoWast.mfStockOutDate <= CURDATE()`}
                                                            GROUP BY
                                                                mfsodAutoWast.mfProductId) AS autoWast
                                                            ON
                                                                mfpd.mfProductId = autoWast.mfProductId
                                                      LEFT JOIN(
                                                            SELECT
                                                                mfso.mfProductId,
                                                                SUM(mfso.mfProductQty) AS qty,
                                                                SUM(mfso.mfProductOutPrice) AS costPrice
                                                            FROM
                                                                factory_mfProductStockOut_data AS mfso
                                                            WHERE
                                                                ${req.query.startDate && req.query.endDate ? `mfso.mfStockOutDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')` : `mfso.mfStockOutDate >= DATE_SUB(CURDATE(), INTERVAL 1 MONTH) AND mfso.mfStockOutDate <= CURDATE()`}
                                                            GROUP BY
                                                                mfso.mfProductId) AS mfsod
                                                            ON
                                                                mfpd.mfProductId = mfsod.mfProductId
                                                      LEFT JOIN(
                                                          SELECT
                                                              fdow.mfProductId,
                                                              SUM(fdow.sellAmount) AS sellAmt
                                                          FROM
                                                              factory_distributorWiseOut_data AS fdow
                                                          WHERE
                                                              fdow.mfStockOutId IN(
                                                              SELECT
                                                                  COALESCE(msod.mfStockOutId, NULL)
                                                              FROM
                                                                  factory_mfProductStockOut_data AS msod
                                                          ) AND 
                                                          ${req.query.startDate && req.query.endDate ? `fdow.sellDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')` : `fdow.sellDate >= DATE_SUB(CURDATE(), INTERVAL 1 MONTH) AND fdow.sellDate <= CURDATE()`}
                                                      GROUP BY
                                                          fdow.mfProductId) AS fdwod
                                                      ON
                                                          mfpd.mfProductId = fdwod.mfProductId
                                                      LEFT JOIN(
                                                          SELECT
                                                              isi.productId,
                                                              SUM(isi.totalPrice) AS selAmt
                                                          FROM
                                                              inventory_stockIn_data AS isi
                                                          WHERE
                                                              isi.stockInId IN(
                                                              SELECT
                                                                  COALESCE(msod.mfStockOutId, NULL)
                                                              FROM
                                                                  factory_mfProductStockOut_data AS msod
                                                          ) AND 
                                                          ${req.query.startDate && req.query.endDate ? `isi.stockInDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')` : `isi.stockInDate >= DATE_SUB(CURDATE(), INTERVAL 1 MONTH) AND isi.stockInDate <= CURDATE()`}
                                                      GROUP BY
                                                          isi.productId) AS isid
                                                      ON
                                                          mfpd.mfProductId = isid.productId
                                                      WHERE mfpd.mfProductCategoryId = '${departmentId}'`;
                }
                pool.query(sql_queries_getdetails, (err, rows, fields) => {
                    if (err) {
                        console.error("An error occurd in SQL Queery", err);
                        return res.status(500).send('Database Error');;
                    } else {
                        return res.status(200).send(rows[0]);
                    }
                })
            } else {
                return res.status(404).send("Department Not Found");
            }
        } else {
            return res.status(401).send("Please Login Firest.....!");
        }
    } catch (error) {
        console.error('An error occurd', error);
        res.status(500).send('Internal Server Error');
    }
}

// Get Out Categiry Wise Mf Product Details

const getOutCategoryWiseMfProductData = (req, res) => {
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
                    outCategoryId: req.query.outCategoryId,
                    branchId: req.query.branchId,
                    searchWord: req.query.searchWord ? req.query.searchWord : '',
                }
                sql_querry_getCountdetails = `SELECT count(*) as numRows FROM factory_manufactureProduct_data WHERE mfProductCategoryId = '${departmentId}' AND mfProductName LIKE '%` + data.searchWord + `%'`;
                pool.query(sql_querry_getCountdetails, (err, rows, fields) => {
                    if (err) {
                        console.error("An error occurd in SQL Queery", err);
                        return res.status(500).send('Database Error');
                    } else {
                        const numRows = rows[0].numRows;
                        const numPages = Math.ceil(numRows / numPerPage);
                        if (req.query.outCategoryId == 'Branch' && req.query.branchId) {
                            sql_queries_getdetails = `SELECT
                                                          mfpd.mfProductId AS mfProductId,
                                                          mfpd.mfProductName AS mfProductName,
                                                          mfpd.minMfProductUnit AS minMfProductUnit,
                                                          COALESCE(isid.qty, 0) AS remainingStock,
                                                          COALESCE(mfsod.costPrice, 0) AS costPrice,
                                                          COALESCE(isid.selAmt, 0) AS sellAmt,
                                                          (COALESCE(isid.selAmt, 0))-(COALESCE(mfsod.costPrice, 0)) AS profit
                                                      FROM
                                                          factory_manufactureProduct_data AS mfpd
                                                        LEFT JOIN(
                                                                SELECT
                                                                    mfso.mfProductId,
                                                                    SUM(mfso.mfProductOutPrice) AS costPrice
                                                                FROM
                                                                    factory_mfProductStockOut_data AS mfso
                                                                WHERE
                                                                    mfso.mfProductOutCategory = '${data.outCategoryId}' AND mfso.mfStockOutId IN(
                                                                    SELECT
                                                                        COALESCE(isd.stockInId, NULL)
                                                                    FROM
                                                                        inventory_stockIn_data AS isd
                                                                    WHERE
                                                                        isd.branchId = '${data.branchId}'
                                                                ) AND 
                                                                ${req.query.startDate && req.query.endDate ? `mfso.mfStockOutDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')` : `mfso.mfStockOutDate >= DATE_SUB(CURDATE(), INTERVAL 1 MONTH) AND mfso.mfStockOutDate <= CURDATE()`}
                                                            GROUP BY
                                                                mfso.mfProductId) AS mfsod
                                                            ON
                                                                mfpd.mfProductId = mfsod.mfProductId
                                                        LEFT JOIN(
                                                            SELECT
                                                                isi.productId,
                                                                SUM(isi.productQty) AS qty,
                                                                SUM(isi.totalPrice) AS selAmt
                                                            FROM
                                                                inventory_stockIn_data AS isi
                                                            WHERE
                                                                isi.stockInId IN(
                                                                SELECT
                                                                    COALESCE(msod.mfStockOutId, NULL)
                                                                FROM
                                                                    factory_mfProductStockOut_data AS msod
                                                                WHERE
                                                                    msod.mfProductOutCategory = '${data.outCategoryId}'
                                                            ) AND isi.branchId = '${data.branchId}' AND 
                                                            ${req.query.startDate && req.query.endDate ? `isi.stockInDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')` : `isi.stockInDate >= DATE_SUB(CURDATE(), INTERVAL 1 MONTH) AND isi.stockInDate <= CURDATE()`}
                                                        GROUP BY
                                                            isi.productId) AS isid
                                                        ON
                                                            mfpd.mfProductId = isid.productId
                                                        WHERE mfpd.mfProductCategoryId = '${departmentId}' AND mfpd.mfProductName LIKE '%` + data.searchWord + `%'
                                                        ORDER BY mfpd.mfProductName ASC
                                                        LIMIT ${limit}`
                        } else if (req.query.outCategoryId) {
                            sql_queries_getdetails = `SELECT
                                                        mfpd.mfProductId AS mfProductId,
                                                        mfpd.mfProductName AS mfProductName,
                                                        mfpd.minMfProductUnit AS minMfProductUnit,
                                                        COALESCE(mfsod.qty, 0) AS remainingStock,
                                                        COALESCE(mfsod.costPrice, 0) AS costPrice,
                                                        COALESCE(fdwod.sellAmt,isid.selAmt,autoWast.autoPrice,0) AS sellAmt,
                                                        (COALESCE(fdwod.sellAmt,isid.selAmt,autoWast.autoPrice,0))-(COALESCE(mfsod.costPrice, 0)) AS profit
                                                      FROM
                                                          factory_manufactureProduct_data AS mfpd
                                                        LEFT JOIN(
                                                            SELECT
                                                                mfsodAutoWast.mfProductId,
                                                                SUM(mfsodAutoWast.mfProductOutPrice) AS autoPrice
                                                            FROM
                                                                factory_mfProductStockOut_data AS mfsodAutoWast
                                                            WHERE
                                                                mfsodAutoWast.mfProductOutCategory IN ('${data.outCategoryId == 'Auto' ? 'Auto' : null}') AND
                                                                ${req.query.startDate && req.query.endDate ? `mfsodAutoWast.mfStockOutDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')` : ` mfsodAutoWast.mfStockOutDate >= DATE_SUB(CURDATE(), INTERVAL 1 MONTH) AND mfsodAutoWast.mfStockOutDate <= CURDATE()`}
                                                            GROUP BY
                                                                mfsodAutoWast.mfProductId) AS autoWast
                                                            ON
                                                                mfpd.mfProductId = autoWast.mfProductId
                                                        LEFT JOIN(
                                                            SELECT
                                                                mfso.mfProductId,
                                                                SUM(mfso.mfProductQty) AS qty,
                                                                SUM(mfso.mfProductOutPrice) AS costPrice
                                                            FROM
                                                                factory_mfProductStockOut_data AS mfso
                                                            WHERE
                                                                mfso.mfProductOutCategory = '${data.outCategoryId}' AND
                                                                ${req.query.startDate && req.query.endDate ? `mfso.mfStockOutDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')` : `mfso.mfStockOutDate >= DATE_SUB(CURDATE(), INTERVAL 1 MONTH) AND mfso.mfStockOutDate <= CURDATE()`}
                                                            GROUP BY
                                                                mfso.mfProductId) AS mfsod
                                                            ON
                                                                mfpd.mfProductId = mfsod.mfProductId
                                                        LEFT JOIN(
                                                            SELECT
                                                                fdow.mfProductId,
                                                                SUM(fdow.sellAmount) AS sellAmt
                                                            FROM
                                                                factory_distributorWiseOut_data AS fdow
                                                            WHERE
                                                                fdow.mfStockOutId IN(
                                                                SELECT
                                                                    COALESCE(msod.mfStockOutId, NULL)
                                                                FROM
                                                                    factory_mfProductStockOut_data AS msod
                                                                WHERE
                                                                    msod.mfProductOutCategory = '${data.outCategoryId}'
                                                            ) AND 
                                                            ${req.query.startDate && req.query.endDate ? `fdow.sellDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')` : `fdow.sellDate >= DATE_SUB(CURDATE(), INTERVAL 1 MONTH) AND fdow.sellDate <= CURDATE()`}
                                                        GROUP BY
                                                            fdow.mfProductId) AS fdwod
                                                        ON
                                                            mfpd.mfProductId = fdwod.mfProductId
                                                        LEFT JOIN(
                                                            SELECT
                                                                isi.productId,
                                                                SUM(isi.totalPrice) AS selAmt
                                                            FROM
                                                                inventory_stockIn_data AS isi
                                                            WHERE
                                                                isi.stockInId IN(
                                                                SELECT
                                                                    COALESCE(msod.mfStockOutId, NULL)
                                                                FROM
                                                                    factory_mfProductStockOut_data AS msod
                                                                WHERE
                                                                    msod.mfProductOutCategory = '${data.outCategoryId}'
                                                            ) AND 
                                                            ${req.query.startDate && req.query.endDate ? `isi.stockInDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')` : `isi.stockInDate >= DATE_SUB(CURDATE(), INTERVAL 1 MONTH) AND isi.stockInDate <= CURDATE()`}
                                                        GROUP BY
                                                            isi.productId) AS isid
                                                        ON
                                                            mfpd.mfProductId = isid.productId
                                                        WHERE mfpd.mfProductCategoryId = '${departmentId}' AND mfpd.mfProductName LIKE '%` + data.searchWord + `%'
                                                        ORDER BY mfpd.mfProductName ASC
                                                        LIMIT ${limit}`;
                        } else {
                            sql_queries_getdetails = `SELECT
                                                          mfpd.mfProductId AS mfProductId,
                                                          mfpd.mfProductName AS mfProductName,
                                                          mfpd.minMfProductUnit AS minMfProductUnit,
                                                          COALESCE(mfsod.qty, 0) AS remainingStock,
                                                          COALESCE(mfsod.costPrice, 0) AS costPrice,
                                                          ROUND(COALESCE(fdwod.sellAmt,0) + COALESCE(isid.selAmt,0) + COALESCE(autoWast.autoPrice,0)) AS sellAmt,
                                                          (ROUND(COALESCE(fdwod.sellAmt,0) + COALESCE(isid.selAmt,0)+ COALESCE(autoWast.autoPrice,0)))-(COALESCE(mfsod.costPrice, 0)) AS profit
                                                      FROM
                                                          factory_manufactureProduct_data AS mfpd
                                                      LEFT JOIN(
                                                            SELECT
                                                                mfsodAutoWast.mfProductId,
                                                                SUM(mfsodAutoWast.mfProductOutPrice) AS autoPrice
                                                            FROM
                                                                factory_mfProductStockOut_data AS mfsodAutoWast
                                                            WHERE
                                                                mfsodAutoWast.mfProductOutCategory IN ('Auto') AND
                                                                ${req.query.startDate && req.query.endDate ? `mfsodAutoWast.mfStockOutDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')` : ` mfsodAutoWast.mfStockOutDate >= DATE_SUB(CURDATE(), INTERVAL 1 MONTH) AND mfsodAutoWast.mfStockOutDate <= CURDATE()`}
                                                            GROUP BY
                                                                mfsodAutoWast.mfProductId) AS autoWast
                                                            ON
                                                                mfpd.mfProductId = autoWast.mfProductId
                                                      LEFT JOIN(
                                                            SELECT
                                                                mfso.mfProductId,
                                                                SUM(mfso.mfProductQty) AS qty,
                                                                SUM(mfso.mfProductOutPrice) AS costPrice
                                                            FROM
                                                                factory_mfProductStockOut_data AS mfso
                                                            WHERE
                                                                ${req.query.startDate && req.query.endDate ? `mfso.mfStockOutDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')` : `mfso.mfStockOutDate >= DATE_SUB(CURDATE(), INTERVAL 1 MONTH) AND mfso.mfStockOutDate <= CURDATE()`}
                                                            GROUP BY
                                                                mfso.mfProductId) AS mfsod
                                                            ON
                                                                mfpd.mfProductId = mfsod.mfProductId
                                                      LEFT JOIN(
                                                          SELECT
                                                              fdow.mfProductId,
                                                              SUM(fdow.sellAmount) AS sellAmt
                                                          FROM
                                                              factory_distributorWiseOut_data AS fdow
                                                          WHERE
                                                              fdow.mfStockOutId IN(
                                                              SELECT
                                                                  COALESCE(msod.mfStockOutId, NULL)
                                                              FROM
                                                                  factory_mfProductStockOut_data AS msod
                                                          ) AND 
                                                          ${req.query.startDate && req.query.endDate ? `fdow.sellDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')` : `fdow.sellDate >= DATE_SUB(CURDATE(), INTERVAL 1 MONTH) AND fdow.sellDate <= CURDATE()`}
                                                      GROUP BY
                                                          fdow.mfProductId) AS fdwod
                                                      ON
                                                          mfpd.mfProductId = fdwod.mfProductId
                                                      LEFT JOIN(
                                                          SELECT
                                                              isi.productId,
                                                              SUM(isi.totalPrice) AS selAmt
                                                          FROM
                                                              inventory_stockIn_data AS isi
                                                          WHERE
                                                              isi.stockInId IN(
                                                              SELECT
                                                                  COALESCE(msod.mfStockOutId, NULL)
                                                              FROM
                                                                  factory_mfProductStockOut_data AS msod
                                                          ) AND 
                                                          ${req.query.startDate && req.query.endDate ? `isi.stockInDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')` : `isi.stockInDate >= DATE_SUB(CURDATE(), INTERVAL 1 MONTH) AND isi.stockInDate <= CURDATE()`}
                                                      GROUP BY
                                                          isi.productId) AS isid
                                                      ON
                                                          mfpd.mfProductId = isid.productId
                                                      WHERE mfpd.mfProductCategoryId = '${departmentId}' AND mfpd.mfProductName LIKE '%` + data.searchWord + `%'
                                                      ORDER BY mfpd.mfProductName ASC
                                                      LIMIT ${limit}`
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
                                    const datas = Object.values(JSON.parse(JSON.stringify(rows)))
                                    processDatas(datas)
                                        .then((data) => {
                                            const rows = datas ? datas.map((element, index) => data[index] && data[index].convertedQuantity ? { ...element, remainingStock: data[index].convertedQuantity, allConversation: data[index].vikJson } : { ...element, remainingStock: element.remainingStock + ' ' + element.productUnit, allConversation: data[index].vikJson },
                                            ) : []
                                            return res.status(200).send({ rows, numRows });
                                        }).catch(error => {
                                            console.error('Error in processing datas:', error);
                                            return res.status(500).send('Internal Error');
                                        });
                                }
                            }
                        });
                    }
                })
            } else {
                return res.status(404).send("Department Not Found");
            }
        } else {
            return res.status(401).send("Please Login Firest.....!");
        }
    } catch (error) {
        console.error('An error occurd', error);
        res.status(500).send('Internal Server Error');
    }
}

// Add Manufacture Product Data

const addMfProductData = (req, res) => {
    try {
        let token;
        token = req.headers.authorization ? req.headers.authorization.split(" ")[1] : null;
        if (token) {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const departmentId = decoded.id.categoryId ? decoded.id.categoryId : null;
            if (departmentId) {
                const uid1 = new Date();
                const mfProductId = String("mfProduct_" + uid1.getTime() + 1);
                const factoryId = process.env.RAJ_MANDIR_FACTORY_ID
                const priorityArray = req.body.priorityArray;
                const data = {
                    productCategoryId: req.body.productCategoryId,
                    productName: req.body.productName.trim(),
                    gujaratiProductName: req.body.gujaratiProductName,
                    minProductQty: req.body.minProductQty,
                    minProductUnit: req.body.minProductUnit.trim(),
                    productionTime: req.body.productionTime ? req.body.productionTime : 0,
                    isExpired: req.body.isExpired ? req.body.isExpired : false,
                    expiredDays: req.body.expiredDays ? req.body.expiredDays : 0,
                }
                if (!data.productName || !departmentId || !data.productCategoryId || !data.minProductQty || !data.minProductUnit) {
                    return res.status(400).send("Please Fill All The Fields");
                } else {
                    req.body.productName = pool.query(`SELECT productName FROM inventory_product_data WHERE productName = '${data.productName}';
                                                       SELECT mfProductName FROM factory_manufactureProduct_data WHERE mfProductName = '${data.productName}'`, function (err, row) {
                        if (err) {
                            console.error("An error occurd in SQL Queery", err);
                            return res.status(500).send('Database Error');
                        }
                        const ipname = row && row[0].length ? row[0][0].productName : null;
                        const mfpname = row && row[1].length && row[1][0].mfProductName ? row[1][0].mfProductName : null;

                        if (ipname || mfpname) {
                            return res.status(400).send('Product is Already In Use');
                        } else {
                            const sql_querry_addUser = `INSERT INTO factory_manufactureProduct_data(mfProductId, mfProductCategoryId, mfProductName, mfGujaratiProductName, minMfProductQty, minMfProductUnit, productionTime, isExpired, expiredDays)
                                                        VALUES('${mfProductId}', '${departmentId}', '${data.productName}', '${data.gujaratiProductName}', ${data.minProductQty}, '${data.minProductUnit}', ${data.productionTime}, ${data.isExpired}, ${data.isExpired ? `${data.expiredDays}` : 0});
                                                        INSERT INTO inventory_product_data(productId, productCategoryId, productName, gujaratiProductName, minProductQty, minProductUnit, leadTime, isExpired, expiredDays)
                                                        VALUES('${mfProductId}', '${data.productCategoryId}', '${data.productName}',  ${data.gujaratiProductName ? `'${data.gujaratiProductName}'` : null},  ${data.minProductQty}, '${data.minProductUnit}', ${data.productionTime}, ${data.isExpired}, ${data.isExpired ? `${data.expiredDays}` : 0})`;
                            pool.query(sql_querry_addUser, (err, result) => {
                                if (err) {
                                    console.error("An error occurd in SQL Queery", err);
                                    return res.status(500).send('Database Error');
                                }
                                if (priorityArray.length != 0 && priorityArray) {
                                    let addPriorityData = priorityArray.map((item, index) => {
                                        let uniqueId = `PriorityId_${Date.now() + index}`; // Generating a unique ID using current timestamp
                                        let priorityNumber = index + 1; // Define Priority Number
                                        return `('${uniqueId}', '${mfProductId}', ${priorityNumber}, '${item.bigUnitName}', ${item.unitNumber}, '${item.smallUnitName}')`;
                                    }).join(', ');
                                    console.log(addPriorityData);
                                    const sql_querry_addPriority = `INSERT INTO mfProduct_unit_preference(preferenceId, mfProductId, priorityNumber, bigUnitName, unitNumber, smallUnitName)
                                                                    VALUES ${addPriorityData};
                                                                    INSERT INTO product_unit_preference (preferenceId, productId, priorityNumber, bigUnitName, unitNumber, smallUnitName)
                                                                    VALUES ${addPriorityData};
                                                                    INSERT INTO inventory_supplierProducts_data(supplierId, productId)
                                                                    VALUES('${factoryId}', '${mfProductId}')`;
                                    pool.query(sql_querry_addPriority, (err, result) => {
                                        if (err) {
                                            console.error("An error occurd in SQL Queery", err);
                                            return res.status(500).send('Database Error');
                                        }
                                        return res.status(200).send({ "mfProductId": mfProductId, "mfProductName": data.productName, "minProductUnit": data.minProductUnit, "msg": "Product Added Successfully" });
                                    });
                                } else {
                                    return res.status(200).send({ "mfProductID": mfProductId, "mfProductName": data.productName, "minProductUnit": data.minProductUnit, "msg": "Product Added Successfully" });
                                }
                            })
                        }
                    })
                }
            } else {
                return res.status(404).send("Department Not Found");
            }
        } else {
            return res.status(401).send("Please Login Firest.....!");
        }
    } catch (error) {
        console.error('An error occurd', error);
        res.status(500).json('Internal Server Error');
    }
}

// Remove Manufacture Product Data

const removeMfProductData = (req, res) => {
    try {
        let token;
        token = req.headers ? req.headers.authorization.split(" ")[1] : null;
        if (token) {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const rights = decoded.id.rights;
            if (rights == 1) {
                var mfProductId = req.query.mfProductId.trim();
                const factoryId = process.env.RAJ_MANDIR_FACTORY_ID;
                req.query.mfProductId = pool.query(`SELECT mfProductId FROM factory_manufactureProduct_data WHERE mfProductId = '${mfProductId}'`, (err, row) => {
                    if (err) {
                        console.error("An error occurd in SQL Queery", err);
                        return res.status(500).send('Database Error');
                    }
                    if (row && row.length) {
                        const sql_querry_removedetails = `DELETE FROM factory_manufactureProduct_data WHERE mfProductId = '${mfProductId}';
                                                  DELETE FROM inventory_supplierProducts_data WHERE supplierId = '${factoryId}' AND productId = '${mfProductId}'`;
                        pool.query(sql_querry_removedetails, (err, data) => {
                            if (err) {
                                console.error("An error occurd in SQL Queery", err);
                                return res.status(500).send('Database Error');
                            }
                            return res.status(200).send("Product Deleted Successfully");
                        })
                    } else {
                        return res.send('ProductId Not Found');
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

// Update Manufacture Product Data

const updateMfProductData = (req, res) => {
    try {
        let token;
        token = req.headers.authorization ? req.headers.authorization.split(" ")[1] : null;
        if (token) {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const departmentId = decoded.id.categoryId ? decoded.id.categoryId : null;
            if (departmentId) {
                const mfProductId = req.body.mfProductId;
                const priorityArray = req.body.priorityArray;
                const data = {
                    productCategoryId: req.body.productCategoryId,
                    productName: req.body.productName.trim(),
                    gujaratiProductName: req.body.gujaratiProductName,
                    minProductQty: req.body.minProductQty,
                    minProductUnit: req.body.minProductUnit.trim(),
                    productionTime: req.body.productionTime ? req.body.productionTime : 0,
                    isExpired: req.body.isExpired ? req.body.isExpired : false,
                    expiredDays: req.body.expiredDays ? req.body.expiredDays : 0,
                }
                if (!mfProductId || !data.productName || !data.minProductQty || !data.minProductUnit) {
                    return res.status(400).send("Please Fill All The Fields");
                }
                console.log(departmentId, 'ffffff');
                const sql_querry_updatedetails = `UPDATE factory_manufactureProduct_data SET 
                                                            mfProductCategoryId = '${departmentId}',
                                                            mfProductName = '${data.productName}',
                                                            mfGujaratiProductName = ${data.gujaratiProductName ? `'${data.gujaratiProductName}'` : null},
                                                            minMfProductQty = ${data.minProductQty},
                                                            minMfProductUnit = '${data.minProductUnit}',
                                                            productionTime = ${data.productionTime},
                                                            isExpired = ${data.isExpired},
                                                            expiredDays = ${data.isExpired ? `${data.expiredDays}` : 0}
                                                 WHERE mfProductId = '${mfProductId}';
                                                 UPDATE
                                                     inventory_product_data
                                                 SET
                                                     productCategoryId = '${data.productCategoryId}',
                                                     minProductUnit = '${data.minProductUnit}'
                                                 WHERE inventory_product_data.productId = '${mfProductId}'`;
                pool.query(sql_querry_updatedetails, (err, data) => {
                    if (err) {
                        console.error("An error occurd in SQL Queery", err);
                        return res.status(500).send('Database Error');
                    }
                    sql_querry_removePriorityArray = `DELETE FROM mfProduct_unit_preference WHERE mfProductId = '${mfProductId}'`;
                    pool.query(sql_querry_removePriorityArray, (err, result) => {
                        if (err) {
                            console.error("An error occurd in SQL Queery", err);
                            return res.status(500).send('Database Error');
                        }
                        if (priorityArray.length != 0 && priorityArray) {
                            let addPriorityData = priorityArray.map((item, index) => {
                                let uniqueId = `PriorityId_${Date.now() + index}`; // Generating a unique ID using current timestamp
                                let priorityNumber = index + 1; // Define Priority Number
                                return `('${uniqueId}', '${mfProductId}', ${priorityNumber}, '${item.bigUnitName}', ${item.unitNumber}, '${item.smallUnitName}')`;
                            }).join(', ');

                            const sql_querry_addPriority = `INSERT INTO mfProduct_unit_preference(preferenceId, mfProductId, priorityNumber, bigUnitName, unitNumber, smallUnitName)
                                                            VALUES ${addPriorityData};`;
                            pool.query(sql_querry_addPriority, (err, result) => {
                                if (err) {
                                    console.error("An error occurd in SQL Queery", err);
                                    return res.status(500).send('Database Error');
                                }
                                return res.status(200).send("Product Update Successfully");
                            });
                        } else {
                            return res.status(200).send("Product Update Successfully");
                        }
                    })
                })
            } else {
                return res.status(404).send("Department Not Found");
            }
        } else {
            return res.status(401).send("Please Login Firest.....!");
        }
    } catch (error) {
        console.error('An error occurd', error);
        res.status(500).send('Internal Server Error');
    }

}

// Get Unit Conversation Details By mfProduct Id

const getMfUnitPreferenceById = (req, res) => {
    try {
        const mfProductId = req.query.mfProductId;
        if (!mfProductId) {
            return res.status(404), send('mfProductId Not Found');
        }
        sql_get_preference = `SELECT
                                    bigUnitName AS largerUnit, unitNumber AS value, smallUnitName AS smallerUnit
                                FROM
                                    mfProduct_unit_preference AS pup
                                WHERE
                                    pup.mfProductId = '${mfProductId}'
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

// Get OutCategory Wise Used Product

const getOutCategoryWiseUsedByProduct = (req, res) => {
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
                mfProductId: req.query.mfProductId
            }
            if (req.query.startDate && req.query.endDate) {
                sql_queries_getCategoryUsed = `SELECT
                                                   mfcd.stockOutCategoryName,
                                                   mpd.mfProductId,
                                                   mpd.minMfProductUnit,
                                                   COALESCE(so.usedQty, 0) AS remainingStock,
                                                   COALESCE(so.usedPrice, 0) AS usedPrice
                                               FROM
                                                   factory_mfProductOutCategory_data AS mfcd
                                               LEFT JOIN(
                                                   SELECT
                                                       factory_mfProductStockOut_data.mfProductOutCategory,
                                                       ROUND(
                                                           SUM(
                                                               factory_mfProductStockOut_data.mfProductQty
                                                           ),
                                                           2
                                                       ) AS usedQty,
                                                       ROUND(
                                                           SUM(
                                                               factory_mfProductStockOut_data.mfProductOutPrice
                                                           )
                                                       ) AS usedPrice
                                                   FROM
                                                       factory_mfProductStockOut_data
                                                   WHERE
                                                       factory_mfProductStockOut_data.mfProductId = '${data.mfProductId}' AND factory_mfProductStockOut_data.mfStockOutDate BETWEEN STR_TO_DATE('${data.startDate}', '%b %d %Y') AND STR_TO_DATE('${data.endDate}', '%b %d %Y')
                                                   GROUP BY
                                                       factory_mfProductStockOut_data.mfProductOutCategory
                                               ) AS so
                                               ON
                                                   mfcd.stockOutCategoryId = so.mfProductOutCategory
                                               LEFT JOIN factory_manufactureProduct_data AS mpd
                                               ON
                                                   mpd.mfProductId = '${data.mfProductId}'
                                               ORDER BY
                                                   so.usedQty
                                               DESC`;
            } else {
                sql_queries_getCategoryUsed = `SELECT
                                                   mfcd.stockOutCategoryName,
                                                   mpd.mfProductId,
                                                   mpd.minMfProductUnit,
                                                   COALESCE(so.usedQty, 0) AS remainingStock,
                                                   COALESCE(so.usedPrice, 0) AS usedPrice
                                               FROM
                                                   factory_mfProductOutCategory_data AS mfcd
                                               LEFT JOIN(
                                                   SELECT
                                                       factory_mfProductStockOut_data.mfProductOutCategory,
                                                       ROUND(
                                                           SUM(
                                                               factory_mfProductStockOut_data.mfProductQty
                                                           ),
                                                           2
                                                       ) AS usedQty,
                                                       ROUND(
                                                           SUM(
                                                               factory_mfProductStockOut_data.mfProductOutPrice
                                                           )
                                                       ) AS usedPrice
                                                   FROM
                                                       factory_mfProductStockOut_data
                                                   WHERE
                                                       factory_mfProductStockOut_data.mfProductId = '${data.mfProductId}' AND factory_mfProductStockOut_data.mfStockOutDate BETWEEN STR_TO_DATE('${firstDay}', '%b %d %Y') AND STR_TO_DATE('${lastDay}', '%b %d %Y')
                                                   GROUP BY
                                                       factory_mfProductStockOut_data.mfProductOutCategory
                                               ) AS so
                                               ON
                                                   mfcd.stockOutCategoryId = so.mfProductOutCategory
                                               LEFT JOIN factory_manufactureProduct_data AS mpd
                                               ON
                                                   mpd.mfProductId = '${data.mfProductId}'
                                               ORDER BY
                                                   so.usedQty
                                               DESC`;
            }
            pool.query(sql_queries_getCategoryUsed, (err, result) => {
                if (err) {
                    console.error("An error occurd in SQL Queery", err);
                    return res.status(500).send('Database Error');
                }
                const datas = Object.values(JSON.parse(JSON.stringify(result)));
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
        } else {
            return res.status(401).send("Please Login Firest.....!");
        }
    } catch (error) {
        console.error('An error occurd', error);
        res.status(500).json('Internal Server Error');
    }
}

// Get OutCategory Wise Used Product

const getDistridutorWiseSellByMfProductId = (req, res) => {
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
                mfProductId: req.query.mfProductId
            }
            if (req.query.startDate && req.query.endDate) {
                sql_queries_getSellData = `SELECT
                                                   dpd.distributorId AS distributorId,
                                                   fdd.distributorNickName AS distributorNickName,
                                                   fmp.minMfProductUnit AS minMfProductUnit,
                                                   dpd.mfProductId AS mfProductId,
                                                   (
                                                   SELECT
                                                       COALESCE(SUM(mfso.mfProductQty),
                                                       0)
                                                   FROM
                                                       factory_mfProductStockOut_data AS mfso
                                                   WHERE
                                                       mfso.mfStockOutId IN(
                                                       SELECT
                                                           COALESCE(fdwo.mfStockOutId, NULL)
                                                       FROM
                                                           factory_distributorWiseOut_data AS fdwo
                                                       WHERE
                                                           fdwo.distributorId = dpd.distributorId AND fdwo.mfProductId = dpd.mfProductId AND fdwo.sellDate BETWEEN STR_TO_DATE('${data.startDate}', '%b %d %Y') AND STR_TO_DATE('${data.endDate}', '%b %d %Y')
                                                   )
                                               ) AS remainingStock,
                                               (
                                                   SELECT
                                                       COALESCE(SUM(fdo.sellAmount),
                                                       0)
                                                   FROM
                                                       factory_distributorWiseOut_data AS fdo
                                                   WHERE
                                                       fdo.distributorId = dpd.distributorId AND fdo.mfProductId = dpd.mfProductId AND fdo.sellDate BETWEEN STR_TO_DATE('${data.startDate}', '%b %d %Y') AND STR_TO_DATE('${data.endDate}', '%b %d %Y')
                                               ) AS totalPrice
                                               FROM
                                                   factory_distributorProducts_data AS dpd
                                               INNER JOIN factory_distributor_data AS fdd ON fdd.distributorId = dpd.distributorId
                                               INNER JOIN factory_manufactureProduct_data AS fmp ON fmp.mfProductId = dpd.mfProductId
                                               WHERE dpd.mfProductId = '${data.mfProductId}'`;
            } else {
                sql_queries_getSellData = `SELECT
                                                   dpd.distributorId AS distributorId,
                                                   fdd.distributorNickName AS distributorNickName,
                                                   fmp.minMfProductUnit AS minMfProductUnit,
                                                   dpd.mfProductId AS mfProductId,
                                                   (
                                                   SELECT
                                                       COALESCE(SUM(mfso.mfProductQty),
                                                       0)
                                                   FROM
                                                       factory_mfProductStockOut_data AS mfso
                                                   WHERE
                                                       mfso.mfStockOutId IN(
                                                       SELECT
                                                           COALESCE(fdwo.mfStockOutId, NULL)
                                                       FROM
                                                           factory_distributorWiseOut_data AS fdwo
                                                       WHERE
                                                           fdwo.distributorId = dpd.distributorId AND fdwo.mfProductId = dpd.mfProductId AND fdwo.sellDate BETWEEN STR_TO_DATE('${firstDay}', '%b %d %Y') AND STR_TO_DATE('${lastDay}', '%b %d %Y')
                                                   )
                                               ) AS remainingStock,
                                               (
                                                   SELECT
                                                       COALESCE(SUM(fdo.sellAmount),
                                                       0)
                                                   FROM
                                                       factory_distributorWiseOut_data AS fdo
                                                   WHERE
                                                       fdo.distributorId = dpd.distributorId AND fdo.mfProductId = dpd.mfProductId AND fdo.sellDate BETWEEN STR_TO_DATE('${firstDay}', '%b %d %Y') AND STR_TO_DATE('${lastDay}', '%b %d %Y')
                                               ) AS totalPrice
                                               FROM
                                                   factory_distributorProducts_data AS dpd
                                               INNER JOIN factory_distributor_data AS fdd ON fdd.distributorId = dpd.distributorId
                                               INNER JOIN factory_manufactureProduct_data AS fmp ON fmp.mfProductId = dpd.mfProductId
                                               WHERE dpd.mfProductId = '${data.mfProductId}'`;
            }
            console.log(sql_queries_getSellData);
            pool.query(sql_queries_getSellData, (err, result) => {
                if (err) {
                    console.error("An error occurd in SQL Queery", err);
                    return res.status(500).send('Database Error');
                }
                const datas = Object.values(JSON.parse(JSON.stringify(result)));
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
        } else {
            return res.status(401).send("Please Login Firest.....!");
        }
    } catch (error) {
        console.error('An error occurd', error);
        res.status(500).json('Internal Server Error');
    }
}

// Export Product Table Data

// Export Excel Query for Manufacture Product Table

const exportExcelSheetForMfProduct = (req, res) => {
    let token;
    token = req.headers.authorization ? req.headers.authorization.split(" ")[1] : null;
    if (token) {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const departmentId = decoded.id.categoryId ? decoded.id.categoryId : null;
        if (departmentId) {
            var date = new Date(), y = date.getFullYear(), m = (date.getMonth());
            var firstDay = new Date(y, m, 1).toString().slice(4, 15);
            var lastDay = new Date(y, m + 1, 0).toString().slice(4, 15);

            const data = {
                startDate: (req.query.startDate ? req.query.startDate : '').slice(4, 15),
                endDate: (req.query.endDate ? req.query.endDate : '').slice(4, 15),
                mfProductCategoryId: departmentId
            }
            const sql_querry_staticQuery = `SELECT
                                            p.mfProductId,
                                            UCASE(p.mfProductName) AS mfProductName,
                                            mfGujaratiProductName AS gujProductName,
                                            CONCAT(p.minMfProductQty,' ',p.minMfProductUnit) AS minMfProductQty,
                                            p.minMfProductUnit,
                                            CONCAT(p.productionTime,' ','Day') AS productionTime,
                                            p.isExpired,
                                            CONCAT(p.expiredDays,' ','Day') AS expiredDays,
                                            COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) AS remainingStock,
                                            COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) AS OnlyremainingStock,
                                            COALESCE(ROUND(siLu.mfProductPrice,2), 0) AS lastPrice,
                                            COALESCE(siLu.mfProductQty,'No In') AS lastUpdatedQty,
                                            COALESCE(siLu.totalPrice, 0) AS totalPrice,
                                            COALESCE(
                                                DATE_FORMAT(siLu.mfStockInDate, '%d-%m-%Y'),
                                                "No Update"
                                            ) AS lastUpdatedStockInDate,
                                            CASE WHEN COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) >= p.minMfProductQty THEN 'In-Stock' WHEN COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) < p.minMfProductQty AND COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) != 0 THEN 'Low-Stock' ELSE 'Out-Stock'
                                        END AS stockStatus
                                        FROM
                                            factory_manufactureProduct_data AS p
                                        LEFT JOIN(
                                            SELECT
                                                factory_mfProductStockIn_data.mfProductId,
                                                ROUND(SUM(
                                                    factory_mfProductStockIn_data.mfProductQty
                                                ),2) AS total_quantity
                                            FROM
                                                factory_mfProductStockIn_data
                                            GROUP BY
                                                factory_mfProductStockIn_data.mfProductId
                                        ) AS si
                                        ON
                                            p.mfProductId = si.mfProductId
                                        LEFT JOIN(
                                            SELECT
                                                factory_mfProductStockOut_data.mfProductId,
                                                ROUND(SUM(
                                                    factory_mfProductStockOut_data.mfProductQty
                                                ),2) AS total_quantity
                                            FROM
                                                factory_mfProductStockOut_data
                                            GROUP BY
                                                factory_mfProductStockOut_data.mfProductId
                                        ) AS so
                                        ON
                                            p.mfProductId = so.mfProductId
                                        LEFT JOIN(
                                            SELECT
                                                mfProductId,
                                                mfStockInDate,
                                                COALESCE(CONCAT(mfStockInDisplayQty,' ',mfStockInDisplayUnit),'No IN') AS mfProductQty,
                                                mfProductPrice,
                                                totalPrice
                                            FROM
                                                factory_mfProductStockIn_data
                                            WHERE (mfProductId, mfStockInCreationDate) IN(
                                                SELECT
                                                    mfProductId,
                                                    MAX(mfStockInCreationDate)
                                                FROM
                                                    factory_mfProductStockIn_data
                                                GROUP BY
                                                    mfProductId
                                            )
                                        ) AS siLu
                                        ON
                                            p.mfProductId = siLu.mfProductId`;
            const sql_querry_getMwSiSO = `SELECT
                                            p.mfProductId,
                                            UCASE(p.mfProductName) AS mfProductName,
                                            mfGujaratiProductName AS gujProductName,
                                            CONCAT(p.minMfProductQty,' ',p.minMfProductUnit) AS minMfProductQty,
                                            p.minMfProductUnit,
                                            CONCAT(p.productionTime,' ','Day') AS productionTime,
                                            p.isExpired,
                                            CONCAT(p.expiredDays,' ','Day') AS expiredDays,
                                            COALESCE(simw.total_quantity, 0) AS purchese,
                                            COALESCE(somw.total_quantity, 0) AS totalUsed,
                                            COALESCE(simw.totalExpense,0) AS totalExpense,
                                            COALESCE(somw.totalStockOutPrice,0) AS totalStockOutPrice,
                                            COALESCE(si.total_siPrice, 0) - COALESCE(so.total_soPrice, 0) AS remainPrice,
                                            COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) AS remainingStock,
                                            COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) AS OnlyremainingStock,
                                            COALESCE(ROUND(siLu.mfProductPrice,2), 0) AS lastPrice,
                                            COALESCE(siLu.mfProductQty,'No In') AS lastUpdatedQty,
                                            COALESCE(siLu.totalPrice, 0) AS totalPrice,
                                            COALESCE(
                                                DATE_FORMAT(siLu.mfStockInDate, '%d-%m-%Y'),
                                                "No Update"
                                            ) AS lastUpdatedStockInDate,
                                            CASE WHEN COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) >= p.minMfProductQty THEN 'In-Stock' WHEN COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) < p.minMfProductQty AND COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) != 0 THEN 'Low-Stock' ELSE 'Out-Stock'
                                        END AS stockStatus
                                        FROM
                                            factory_manufactureProduct_data AS p
                                        LEFT JOIN(
                                            SELECT
                                                factory_mfProductStockIn_data.mfProductId,
                                                ROUND(SUM(
                                                    factory_mfProductStockIn_data.mfProductQty
                                                ),2) AS total_quantity,
                                                ROUND(SUM(
                                                    factory_mfProductStockIn_data.totalPrice
                                                ),2) AS total_siPrice
                                            FROM
                                                factory_mfProductStockIn_data
                                            GROUP BY
                                                factory_mfProductStockIn_data.mfProductId
                                        ) AS si
                                        ON
                                            p.mfProductId = si.mfProductId
                                        LEFT JOIN(
                                            SELECT
                                                factory_mfProductStockOut_data.mfProductId,
                                                ROUND(SUM(
                                                    factory_mfProductStockOut_data.mfProductQty
                                                ),2) AS total_quantity,
                                                ROUND(SUM(
                                                    factory_mfProductStockOut_data.mfProductOutPrice
                                                ),2) AS total_soPrice
                                            FROM
                                                factory_mfProductStockOut_data
                                            GROUP BY
                                                factory_mfProductStockOut_data.mfProductId
                                        ) AS so
                                        ON
                                            p.mfProductId = so.mfProductId
                                        LEFT JOIN(
                                            SELECT
                                                mfProductId,
                                                mfStockInDate,
                                                CONCAT(mfStockInDisplayQty,' ',mfStockInDisplayUnit) AS mfProductQty,
                                                mfProductPrice,
                                                totalPrice
                                            FROM
                                                factory_mfProductStockIn_data
                                            WHERE (mfProductId, mfStockInCreationDate) IN(
                                                SELECT
                                                    mfProductId,
                                                    MAX(mfStockInCreationDate) As lastDate
                                                FROM
                                                    factory_mfProductStockIn_data
                                                GROUP BY
                                                    mfProductId
                                            )
                                        ) AS siLu
                                        ON
                                            p.mfProductId = siLu.mfProductId`;

            if (req.query.mfProductStatus == 1) {
                sql_queries_getdetails = `${sql_querry_staticQuery}
                                                WHERE p.mfProductCategoryId = '${data.mfProductCategoryId}' AND COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) >= p.minMfProductQty 
                                                ORDER BY p.mfProductName`;
            } else if (req.query.mfProductStatus == 2) {
                sql_queries_getdetails = `${sql_querry_staticQuery}
                                                WHERE p.mfProductCategoryId = '${data.mfProductCategoryId}' AND COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) < p.minMfProductQty AND COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) != 0
                                                ORDER BY p.mfProductName`;
            } else if (req.query.mfProductStatus == 3) {
                sql_queries_getdetails = `${sql_querry_staticQuery}
                                                WHERE p.mfProductCategoryId = '${data.mfProductCategoryId}' AND COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) = 0
                                                ORDER BY p.mfProductName`;
            } else if (req.query.startDate && req.query.endDate) {
                sql_queries_getdetails = `${sql_querry_getMwSiSO}
                                              LEFT JOIN(
                                                SELECT
                                                    factory_mfProductStockIn_data.mfProductId,
                                                    ROUND(SUM(
                                                        factory_mfProductStockIn_data.mfProductQty
                                                    ),2) AS total_quantity,
                                                    ROUND(SUM(
                                                        factory_mfProductStockIn_data.totalPrice
                                                    )) AS totalExpense
                                                FROM
                                                    factory_mfProductStockIn_data
                                                WHERE
                                                 factory_mfProductStockIn_data.mfStockInDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')
                                                GROUP BY
                                                    factory_mfProductStockIn_data.mfProductId
                                            ) AS simw
                                            ON
                                            p.mfProductId = simw.mfProductId
                                        LEFT JOIN(
                                            SELECT
                                                factory_mfProductStockOut_data.mfProductId,
                                                ROUND(SUM(
                                                    factory_mfProductStockOut_data.mfProductQty
                                                ),2) AS total_quantity,
                                                ROUND(SUM(
                                                        factory_mfProductStockOut_data.mfProductOutPrice
                                                )) AS totalStockOutPrice
                                            FROM
                                                factory_mfProductStockOut_data
                                            WHERE
                                               factory_mfProductStockOut_data.mfStockOutDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')
                                            GROUP BY
                                                factory_mfProductStockOut_data.mfProductId
                                        ) AS somw
                                        ON
                                        p.mfProductId = somw.mfProductId
                                        WHERE p.mfProductCategoryId = '${data.mfProductCategoryId}'
                                        ORDER BY p.mfProductName`;
            } else {
                sql_queries_getdetails = `${sql_querry_getMwSiSO}
                                              LEFT JOIN(
                                                SELECT
                                                    factory_mfProductStockIn_data.mfProductId,
                                                    ROUND(SUM(
                                                        factory_mfProductStockIn_data.mfProductQty
                                                    ),2) AS total_quantity,
                                                    ROUND(SUM(
                                                        factory_mfProductStockIn_data.totalPrice
                                                    )) AS totalExpense
                                                FROM
                                                    factory_mfProductStockIn_data
                                                WHERE
                                                    factory_mfProductStockIn_data.mfStockInDate BETWEEN STR_TO_DATE('${firstDay}','%b %d %Y') AND STR_TO_DATE('${lastDay}','%b %d %Y')
                                                GROUP BY
                                                    factory_mfProductStockIn_data.mfProductId
                                            ) AS simw
                                            ON
                                            p.mfProductId = simw.mfProductId
                                        LEFT JOIN(
                                            SELECT
                                                factory_mfProductStockOut_data.mfProductId,
                                                ROUND(SUM(
                                                    factory_mfProductStockOut_data.mfProductQty
                                                ),2) AS total_quantity,
                                                ROUND(SUM(
                                                    factory_mfProductStockOut_data.mfProductOutPrice
                                                )) AS totalStockOutPrice
                                            FROM
                                                factory_mfProductStockOut_data
                                            WHERE
                                                factory_mfProductStockOut_data.mfStockOutDate BETWEEN STR_TO_DATE('${firstDay}','%b %d %Y') AND STR_TO_DATE('${lastDay}','%b %d %Y')
                                            GROUP BY
                                                factory_mfProductStockOut_data.mfProductId
                                        ) AS somw
                                        ON
                                        p.mfProductId = somw.mfProductId
                                        WHERE p.mfProductCategoryId = '${data.mfProductCategoryId}'
                                        ORDER BY p.mfProductName`;
            }

            pool.query(sql_queries_getdetails, async (err, rows) => {
                if (err) return res.status(404).send(err);
                const datas = Object.values(JSON.parse(JSON.stringify(rows)));
                processDatas(datas)
                    .then((data) => {
                        const rows = datas ? datas.map((element, index) => data[index] && data[index].convertedQuantity ? { ...element, remainingStock: data[index].convertedQuantity } : { ...element, remainingStock: element.remainingStock + ' ' + element.minMfProductUnit },
                            // console.log(data[index] && data[index].convertedQuantity)
                        ) : []
                        let newData = [];
                        Promise.all(
                            rows ? rows.map(async (element, index) => {
                                let newElement = element;
                                return await newConversationAsync(element.purchese, element.mfProductId, element.minMfProductUnit)
                                    .then(async (res) => {
                                        newElement = { ...newElement, purchese: res }
                                        return await newConversationAsync(element.totalUsed, element.mfProductId, element.minMfProductUnit)
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
                                    worksheet.getCell('A1').value = `Product List From ${(req.query.startDate).slice(4, 15)} To ${(req.query.endDate).slice(4, 15)}`;
                                } else {
                                    worksheet.mergeCells('A1', 'N1');
                                    worksheet.getCell('A1').value = `Product List From ${firstDay} To ${lastDay}`;
                                }

                                const headersNameList = ['S no.', 'Product Name', 'પ્રોડક્ટ નામ', 'Total StockIn', 'Total Expense', 'Total Used', 'Total Used Price', 'Remaining Stock', 'Only Min Remaining Stock', 'Remaining Price', 'Last StockIn', 'Last Price', 'Last Updated Price', 'Min Product Qty', 'Stock Status', 'LastIn DATE'];
                                const columnsArray = [
                                    { key: "s_no", width: 10, },
                                    { key: "mfProductName", width: 30 },
                                    { key: "gujProductName", width: 30 },
                                    { key: "purchese", width: 40 },
                                    { key: "totalExpense", width: 20 },
                                    { key: "totalUsed", width: 40 },
                                    { key: "totalStockOutPrice", width: 20 },
                                    { key: "remainingStock", width: 40 },
                                    { key: "OnlyremainingStock", width: 40 },
                                    { key: "remainPrice", width: 20 },
                                    { key: "lastUpdatedQty", width: 20 },
                                    { key: "totalPrice", width: 20 },
                                    { key: "lastPrice", width: 20 },
                                    { key: "minMfProductQty", width: 20 },
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
                                    worksheetInStock.getCell('A1').value = `In-Stock Product List From ${(req.query.startDate).slice(4, 15)} To ${(req.query.endDate).slice(4, 15)}`;
                                } else {
                                    worksheetInStock.mergeCells('A1', 'N1');
                                    worksheetInStock.getCell('A1').value = `In-Stock Product List From ${firstDay} To ${lastDay}`;
                                }

                                /*Column headers*/
                                worksheetInStock.getRow(2).values = headersNameList;

                                // Column for data in excel. key must match data key
                                worksheetInStock.columns = columnsArray;
                                const inStockProducts = rows.filter(mf => mf.stockStatus === 'In-Stock');
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
                                    worksheetLowStock.getCell('A1').value = `Low-Stock Product List From ${(req.query.startDate).slice(4, 15)} To ${(req.query.endDate).slice(4, 15)}`;
                                } else {
                                    worksheetLowStock.mergeCells('A1', 'N1');
                                    worksheetLowStock.getCell('A1').value = `Low-Stock Product List From ${firstDay} To ${lastDay}`;
                                }

                                /*Column headers*/
                                worksheetLowStock.getRow(2).values = headersNameList;

                                // Column for data in excel. key must match data key
                                worksheetLowStock.columns = columnsArray;

                                worksheetInStock.columns = columnsArray;
                                const lowStockProducts = rows.filter(mf => mf.stockStatus === 'Low-Stock');
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
                                    worksheetOutStock.getCell('A1').value = `Out-Stock Product List From ${(req.query.startDate).slice(4, 15)} To ${(req.query.endDate).slice(4, 15)}`;
                                } else {
                                    worksheetOutStock.mergeCells('A1', 'N1');
                                    worksheetOutStock.getCell('A1').value = `Out-Stock Product List From ${firstDay} To ${lastDay}`;
                                }

                                /*Column headers*/
                                worksheetOutStock.getRow(2).values = headersNameList;

                                // Column for data in excel. key must match data key
                                worksheetOutStock.columns = columnsArray;

                                const outStockProducts = rows.filter(mf => mf.stockStatus === 'Out-Stock');
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
                                    worksheetChkStock.getCell('A1').value = `Product List From ${(req.query.startDate).slice(4, 15)} To ${(req.query.endDate).slice(4, 15)}`;
                                } else {
                                    worksheetChkStock.mergeCells('A1', 'F1');
                                    worksheetChkStock.getCell('A1').value = `Product List From ${firstDay} To ${lastDay}`;
                                }

                                /*Column headers*/
                                worksheetChkStock.getRow(2).values = ['Sr. No', 'Product Name', 'પ્રોડક્ટ નામ', 'Remain Stock', 'Min Qty', 'Status'];

                                // Column for data in excel. key must match data key
                                worksheetChkStock.columns = [
                                    { key: "s_no", width: 10, },
                                    { key: "mfProductName", width: 30 },
                                    { key: "gujProductName", width: 30 },
                                    { key: "remainingStock", width: 40 },
                                    { key: "minMfProductQty", width: 20 },
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
            return res.status(404).send("Department Not Found");
        }
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

// Export PDF For Product List

const exportPdfForMfProductData = (req, res) => {
    try {
        let token;
        token = req.headers.authorization ? req.headers.authorization.split(" ")[1] : null;
        if (token) {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const departmentId = decoded.id.categoryId ? decoded.id.categoryId : null;
            if (departmentId) {
                var date = new Date(), y = date.getFullYear(), m = (date.getMonth());
                var firstDay = new Date(y, m, 1).toString().slice(4, 15);
                var lastDay = new Date(y, m + 1, 0).toString().slice(4, 15);

                const data = {
                    startDate: (req.query.startDate ? req.query.startDate : '').slice(4, 15),
                    endDate: (req.query.endDate ? req.query.endDate : '').slice(4, 15),
                    mfProductStatus: req.query.productStatus,
                    mfProductCategoryId: departmentId
                }
                const sql_querry_staticQuery = `SELECT
                                                p.mfProductId,
                                                UCASE(p.mfProductName) AS mfProductName,
                                                mfGujaratiProductName AS gujProductName,
                                                CONCAT(p.minMfProductQty,' ',p.minMfProductUnit) AS minMfProductQty,
                                                p.minMfProductUnit,
                                                CONCAT(p.productionTime,' ','Day') AS productionTime,
                                                p.isExpired,
                                                CONCAT(p.expiredDays,' ','Day') AS expiredDays,
                                                COALESCE(si.total_quantity, 0) AS purchese,
                                                COALESCE(so.total_quantity, 0) AS totalUsed,
                                                COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) AS remainingStock,
                                                COALESCE(ROUND(siLu.mfProductPrice,2), 0) AS lastPrice,
                                                COALESCE(siLu.mfProductQty,'No In') AS lastUpdatedQty,
                                                COALESCE(siLu.totalPrice, 0) AS totalPrice,
                                                COALESCE(
                                                    DATE_FORMAT(siLu.mfStockInDate, '%d-%m-%Y'),
                                                    "No Update"
                                                ) AS lastUpdatedStockInDate,
                                                CASE WHEN COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) >= p.minMfProductQty THEN 'In-Stock' WHEN COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) < p.minMfProductQty AND COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) != 0 THEN 'Low-Stock' ELSE 'Out-Stock'
                                            END AS stockStatus
                                            FROM
                                                factory_manufactureProduct_data AS p
                                            LEFT JOIN(
                                                SELECT
                                                    factory_mfProductStockIn_data.mfProductId,
                                                    ROUND(SUM(
                                                        factory_mfProductStockIn_data.mfProductQty
                                                    ),2) AS total_quantity
                                                FROM
                                                    factory_mfProductStockIn_data
                                                GROUP BY
                                                    factory_mfProductStockIn_data.mfProductId
                                            ) AS si
                                            ON
                                                p.mfProductId = si.mfProductId
                                            LEFT JOIN(
                                                SELECT
                                                    factory_mfProductStockOut_data.mfProductId,
                                                    ROUND(SUM(
                                                        factory_mfProductStockOut_data.mfProductQty
                                                    ),2) AS total_quantity
                                                FROM
                                                    factory_mfProductStockOut_data
                                                GROUP BY
                                                    factory_mfProductStockOut_data.mfProductId
                                            ) AS so
                                            ON
                                                p.mfProductId = so.mfProductId
                                            LEFT JOIN(
                                                SELECT
                                                    mfProductId,
                                                    mfStockInDate,
                                                    COALESCE(CONCAT(mfStockInDisplayQty,' ',mfStockInDisplayUnit),'No IN') AS mfProductQty,
                                                    mfProductPrice,
                                                    totalPrice
                                                FROM
                                                    factory_mfProductStockIn_data
                                                WHERE (mfProductId, mfStockInCreationDate) IN(
                                                    SELECT
                                                        mfProductId,
                                                        MAX(mfStockInCreationDate)
                                                    FROM
                                                        factory_mfProductStockIn_data
                                                    GROUP BY
                                                        mfProductId
                                                )
                                            ) AS siLu
                                            ON
                                                p.mfProductId = siLu.mfProductId`;
                const sql_querry_getMwSiSO = `SELECT
                                                p.mfProductId,
                                                UCASE(p.mfProductName) AS mfProductName,
                                                mfGujaratiProductName AS gujProductName,
                                                CONCAT(p.minMfProductQty,' ',p.minMfProductUnit) AS minMfProductQty,
                                                p.minMfProductUnit,
                                                CONCAT(p.productionTime,' ','Day') AS productionTime,
                                                p.isExpired,
                                                CONCAT(p.expiredDays,' ','Day') AS expiredDays,
                                                COALESCE(simw.total_quantity, 0) AS purchese,
                                                COALESCE(somw.total_quantity, 0) AS totalUsed,
                                                COALESCE(simw.totalExpense,0) AS totalExpense,
                                                COALESCE(somw.totalStockOutPrice,0) AS totalStockOutPrice,
                                                COALESCE(si.total_siPrice, 0) - COALESCE(so.total_soPrice, 0) AS remainPrice,
                                                COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) AS remainingStock,
                                                COALESCE(ROUND(siLu.mfProductPrice,2), 0) AS lastPrice,
                                                COALESCE(siLu.mfProductQty,'No In') AS lastUpdatedQty,
                                                COALESCE(siLu.totalPrice, 0) AS totalPrice,
                                                COALESCE(
                                                    DATE_FORMAT(siLu.mfStockInDate, '%d-%m-%Y'),
                                                    "No Update"
                                                ) AS lastUpdatedStockInDate,
                                                CASE WHEN COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) >= p.minMfProductQty THEN 'In-Stock' WHEN COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) < p.minMfProductQty AND COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) != 0 THEN 'Low-Stock' ELSE 'Out-Stock'
                                            END AS stockStatus
                                            FROM
                                                factory_manufactureProduct_data AS p
                                            LEFT JOIN(
                                                SELECT
                                                    factory_mfProductStockIn_data.mfProductId,
                                                    ROUND(SUM(
                                                        factory_mfProductStockIn_data.mfProductQty
                                                    ),2) AS total_quantity,
                                                    ROUND(SUM(
                                                        factory_mfProductStockIn_data.totalPrice
                                                    ),2) AS total_siPrice
                                                FROM
                                                    factory_mfProductStockIn_data
                                                GROUP BY
                                                    factory_mfProductStockIn_data.mfProductId
                                            ) AS si
                                            ON
                                                p.mfProductId = si.mfProductId
                                            LEFT JOIN(
                                                SELECT
                                                    factory_mfProductStockOut_data.mfProductId,
                                                    ROUND(SUM(
                                                        factory_mfProductStockOut_data.mfProductQty
                                                    ),2) AS total_quantity,
                                                    ROUND(SUM(
                                                        factory_mfProductStockOut_data.mfProductOutPrice
                                                    ),2) AS total_soPrice
                                                FROM
                                                    factory_mfProductStockOut_data
                                                GROUP BY
                                                    factory_mfProductStockOut_data.mfProductId
                                            ) AS so
                                            ON
                                                p.mfProductId = so.mfProductId
                                            LEFT JOIN(
                                                SELECT
                                                    mfProductId,
                                                    mfStockInDate,
                                                    CONCAT(mfStockInDisplayQty,' ',mfStockInDisplayUnit) AS mfProductQty,
                                                    mfProductPrice,
                                                    totalPrice
                                                FROM
                                                    factory_mfProductStockIn_data
                                                WHERE (mfProductId, mfStockInCreationDate) IN(
                                                    SELECT
                                                        mfProductId,
                                                        MAX(mfStockInCreationDate) As lastDate
                                                    FROM
                                                        factory_mfProductStockIn_data
                                                    GROUP BY
                                                        mfProductId
                                                )
                                            ) AS siLu
                                            ON
                                                p.mfProductId = siLu.mfProductId`;
                if (req.query.productStatus == 1) {
                    sql_queries_getdetails = `${sql_querry_staticQuery}
                                                WHERE p.mfProductCategoryId = '${data.mfProductCategoryId}' AND COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) >= p.minMfProductQty 
                                                ORDER BY p.mfProductName`;
                } else if (req.query.productStatus == 2) {
                    sql_queries_getdetails = `${sql_querry_staticQuery}
                                                WHERE p.mfProductCategoryId = '${data.mfProductCategoryId}' AND COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) < p.minMfProductQty AND COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) != 0
                                                ORDER BY p.mfProductName`;
                } else if (req.query.productStatus == 3) {
                    sql_queries_getdetails = `${sql_querry_staticQuery}
                                                WHERE p.mfProductCategoryId = '${data.mfProductCategoryId}' AND COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) = 0
                                                ORDER BY p.mfProductName`;
                } else if (req.query.startDate && req.query.endDate) {
                    sql_queries_getdetails = `${sql_querry_getMwSiSO}
                                              LEFT JOIN(
                                                SELECT
                                                    factory_mfProductStockIn_data.mfProductId,
                                                    ROUND(SUM(
                                                        factory_mfProductStockIn_data.mfProductQty
                                                    ),2) AS total_quantity,
                                                    ROUND(SUM(
                                                        factory_mfProductStockIn_data.totalPrice
                                                    )) AS totalExpense
                                                FROM
                                                    factory_mfProductStockIn_data
                                                WHERE
                                                 factory_mfProductStockIn_data.mfStockInDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')
                                                GROUP BY
                                                    factory_mfProductStockIn_data.mfProductId
                                            ) AS simw
                                            ON
                                            p.mfProductId = simw.mfProductId
                                        LEFT JOIN(
                                            SELECT
                                                factory_mfProductStockOut_data.mfProductId,
                                                ROUND(SUM(
                                                    factory_mfProductStockOut_data.mfProductQty
                                                ),2) AS total_quantity,
                                                ROUND(SUM(
                                                        factory_mfProductStockOut_data.mfProductOutPrice
                                                )) AS totalStockOutPrice
                                            FROM
                                                factory_mfProductStockOut_data
                                            WHERE
                                               factory_mfProductStockOut_data.mfStockOutDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')
                                            GROUP BY
                                                factory_mfProductStockOut_data.mfProductId
                                        ) AS somw
                                        ON
                                        p.mfProductId = somw.mfProductId
                                        WHERE p.mfProductCategoryId = '${data.mfProductCategoryId}'
                                        ORDER BY p.mfProductName`;
                } else {
                    sql_queries_getdetails = `${sql_querry_getMwSiSO}
                                              LEFT JOIN(
                                                SELECT
                                                    factory_mfProductStockIn_data.mfProductId,
                                                    ROUND(SUM(
                                                        factory_mfProductStockIn_data.mfProductQty
                                                    ),2) AS total_quantity,
                                                    ROUND(SUM(
                                                        factory_mfProductStockIn_data.totalPrice
                                                    )) AS totalExpense
                                                FROM
                                                    factory_mfProductStockIn_data
                                                WHERE
                                                    factory_mfProductStockIn_data.mfStockInDate BETWEEN STR_TO_DATE('${firstDay}','%b %d %Y') AND STR_TO_DATE('${lastDay}','%b %d %Y')
                                                GROUP BY
                                                    factory_mfProductStockIn_data.mfProductId
                                            ) AS simw
                                            ON
                                            p.mfProductId = simw.mfProductId
                                        LEFT JOIN(
                                            SELECT
                                                factory_mfProductStockOut_data.mfProductId,
                                                ROUND(SUM(
                                                    factory_mfProductStockOut_data.mfProductQty
                                                ),2) AS total_quantity,
                                                ROUND(SUM(
                                                    factory_mfProductStockOut_data.mfProductOutPrice
                                                )) AS totalStockOutPrice
                                            FROM
                                                factory_mfProductStockOut_data
                                            WHERE
                                               factory_mfProductStockOut_data.mfStockOutDate BETWEEN STR_TO_DATE('${firstDay}','%b %d %Y') AND STR_TO_DATE('${lastDay}','%b %d %Y')
                                            GROUP BY
                                                factory_mfProductStockOut_data.mfProductId
                                        ) AS somw
                                        ON
                                        p.mfProductId = somw.mfProductId
                                        WHERE p.mfProductCategoryId = '${data.mfProductCategoryId}'
                                        ORDER BY p.mfProductName`;
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
                                const rows = datas ? datas.map((element, index) => data[index] && data[index].convertedQuantity ? { ...element, remainingStock: data[index].convertedQuantity, allConversation: data[index].vikJson } : { ...element, remainingStock: element.remainingStock + ' ' + element.minMfProductUnit, allConversation: data[index].vikJson },
                                ) : []
                                let newData = [];
                                Promise.all(
                                    rows ? rows.map(async (element, index) => {
                                        let newElement = element;
                                        return await newConversationAsync(element.purchese, element.mfProductId, element.minMfProductUnit)
                                            .then(async (res) => {
                                                newElement = { ...newElement, purchese: res }
                                                return await newConversationAsync(element.totalUsed, element.mfProductId, element.minMfProductUnit)
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
                                        const extractedData = rows.map(mf => {
                                            return {
                                                "Product Name": mf.mfProductName,
                                                "Total Purchese": mf.purchese,
                                                "Total Used": mf.totalUsed,
                                                "Remaining": mf.remainingStock,
                                                "Last In Qty": mf.lastUpdatedQty,
                                                "Last Total Price": parseFloat(mf.totalPrice).toLocaleString('en-IN'),
                                                "Raw Material Price": mf.lastPrice,
                                                "Last In Date": mf.lastUpdatedStockInDate,
                                                "Status": mf.stockStatus
                                            };
                                        });
                                        const abc = extractedData;

                                        if (req.query.startDate && req.query.endDate) {
                                            tableHeading = `Product Data From ${(req.query.startDate).slice(4, 15)} To ${(req.query.endDate).slice(4, 15)}`;
                                        } else {
                                            tableHeading = `Product Data From ${firstDay} To ${lastDay}`;
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
                return res.status(404).send("Department Not Found");
            }
        } else {
            return res.status(401).send("Please Login Firest.....!");
        }
    } catch (error) {
        console.error('An error occurd', error);
        res.status(500).send('Internal Server Error');
    }
}

// Export Other Table

// Export Excel For Out Categiry Wise Mf Product Details

const exportExcelForOutCategoryWiseMfProductData = (req, res) => {
    try {
        let token;
        token = req.headers.authorization ? req.headers.authorization.split(" ")[1] : null;
        if (token) {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const departmentId = decoded.id.categoryId ? decoded.id.categoryId : null;
            if (departmentId) {
                const data = {
                    startDate: (req.query.startDate ? req.query.startDate : '').slice(4, 15),
                    endDate: (req.query.endDate ? req.query.endDate : '').slice(4, 15),
                    outCategoryId: req.query.outCategoryId,
                    branchId: req.query.branchId
                }
                console.log(data.outCategoryId, 'Milan');
                if (req.query.outCategoryId == 'Branch' && req.query.branchId) {
                    sql_queries_getdetails = `SELECT
                                                  mfpd.mfProductId AS mfProductId,
                                                  mfpd.mfProductName AS mfProductName,
                                                  mfpd.minMfProductUnit AS minMfProductUnit,
                                                  COALESCE(isid.qty, 0) AS remainingStock,
                                                  COALESCE(mfsod.costPrice, 0) AS costPrice,
                                                  COALESCE(isid.selAmt, 0) AS sellAmt,
                                                  (COALESCE(isid.selAmt, 0))-(COALESCE(mfsod.costPrice, 0)) AS profit
                                              FROM
                                                  factory_manufactureProduct_data AS mfpd
                                                LEFT JOIN(
                                                        SELECT
                                                            mfso.mfProductId,
                                                            SUM(mfso.mfProductOutPrice) AS costPrice
                                                        FROM
                                                            factory_mfProductStockOut_data AS mfso
                                                        WHERE
                                                            mfso.mfProductOutCategory = '${data.outCategoryId}' AND mfso.mfStockOutId IN(
                                                            SELECT
                                                                COALESCE(isd.stockInId, NULL)
                                                            FROM
                                                                inventory_stockIn_data AS isd
                                                            WHERE
                                                                isd.branchId = '${data.branchId}'
                                                        ) AND 
                                                        ${req.query.startDate && req.query.endDate ? `mfso.mfStockOutDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')` : `mfso.mfStockOutDate >= DATE_SUB(CURDATE(), INTERVAL 1 MONTH) AND mfso.mfStockOutDate <= CURDATE()`}
                                                    GROUP BY
                                                        mfso.mfProductId) AS mfsod
                                                    ON
                                                        mfpd.mfProductId = mfsod.mfProductId
                                                LEFT JOIN(
                                                    SELECT
                                                        isi.productId,
                                                        SUM(isi.productQty) AS qty,
                                                        SUM(isi.totalPrice) AS selAmt
                                                    FROM
                                                        inventory_stockIn_data AS isi
                                                    WHERE
                                                        isi.stockInId IN(
                                                        SELECT
                                                            COALESCE(msod.mfStockOutId, NULL)
                                                        FROM
                                                            factory_mfProductStockOut_data AS msod
                                                        WHERE
                                                            msod.mfProductOutCategory = '${data.outCategoryId}'
                                                    ) AND isi.branchId = '${data.branchId}' AND 
                                                    ${req.query.startDate && req.query.endDate ? `isi.stockInDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')` : `isi.stockInDate >= DATE_SUB(CURDATE(), INTERVAL 1 MONTH) AND isi.stockInDate <= CURDATE()`}
                                                GROUP BY
                                                    isi.productId) AS isid
                                                ON
                                                    mfpd.mfProductId = isid.productId
                                                WHERE mfpd.mfProductCategoryId = '${departmentId}'
                                                ORDER BY mfpd.mfProductName ASC`;
                } else if (req.query.outCategoryId) {
                    sql_queries_getdetails = `SELECT
                                                        mfpd.mfProductId AS mfProductId,
                                                        mfpd.mfProductName AS mfProductName,
                                                        mfpd.minMfProductUnit AS minMfProductUnit,
                                                        COALESCE(mfsod.qty, 0) AS remainingStock,
                                                        COALESCE(mfsod.costPrice, 0) AS costPrice,
                                                        COALESCE(fdwod.sellAmt,isid.selAmt,autoWast.autoPrice,0) AS sellAmt,
                                                        (COALESCE(fdwod.sellAmt,isid.selAmt,autoWast.autoPrice,0))-(COALESCE(mfsod.costPrice, 0)) AS profit
                                                      FROM
                                                          factory_manufactureProduct_data AS mfpd
                                                        LEFT JOIN(
                                                            SELECT
                                                                mfsodAutoWast.mfProductId,
                                                                SUM(mfsodAutoWast.mfProductOutPrice) AS autoPrice
                                                            FROM
                                                                factory_mfProductStockOut_data AS mfsodAutoWast
                                                            WHERE
                                                                mfsodAutoWast.mfProductOutCategory IN ('${data.outCategoryId == 'Auto' ? 'Auto' : null}') AND
                                                                ${req.query.startDate && req.query.endDate ? `mfsodAutoWast.mfStockOutDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')` : ` mfsodAutoWast.mfStockOutDate >= DATE_SUB(CURDATE(), INTERVAL 1 MONTH) AND mfsodAutoWast.mfStockOutDate <= CURDATE()`}
                                                            GROUP BY
                                                                mfsodAutoWast.mfProductId) AS autoWast
                                                            ON
                                                                mfpd.mfProductId = autoWast.mfProductId
                                                        LEFT JOIN(
                                                            SELECT
                                                                mfso.mfProductId,
                                                                SUM(mfso.mfProductQty) AS qty,
                                                                SUM(mfso.mfProductOutPrice) AS costPrice
                                                            FROM
                                                                factory_mfProductStockOut_data AS mfso
                                                            WHERE
                                                                mfso.mfProductOutCategory = '${data.outCategoryId}' AND
                                                                ${req.query.startDate && req.query.endDate ? `mfso.mfStockOutDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')` : `mfso.mfStockOutDate >= DATE_SUB(CURDATE(), INTERVAL 1 MONTH) AND mfso.mfStockOutDate <= CURDATE()`}
                                                            GROUP BY
                                                                mfso.mfProductId) AS mfsod
                                                            ON
                                                                mfpd.mfProductId = mfsod.mfProductId
                                                        LEFT JOIN(
                                                            SELECT
                                                                fdow.mfProductId,
                                                                SUM(fdow.sellAmount) AS sellAmt
                                                            FROM
                                                                factory_distributorWiseOut_data AS fdow
                                                            WHERE
                                                                fdow.mfStockOutId IN(
                                                                SELECT
                                                                    COALESCE(msod.mfStockOutId, NULL)
                                                                FROM
                                                                    factory_mfProductStockOut_data AS msod
                                                                WHERE
                                                                    msod.mfProductOutCategory = '${data.outCategoryId}'
                                                            ) AND 
                                                            ${req.query.startDate && req.query.endDate ? `fdow.sellDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')` : `fdow.sellDate >= DATE_SUB(CURDATE(), INTERVAL 1 MONTH) AND fdow.sellDate <= CURDATE()`}
                                                        GROUP BY
                                                            fdow.mfProductId) AS fdwod
                                                        ON
                                                            mfpd.mfProductId = fdwod.mfProductId
                                                        LEFT JOIN(
                                                            SELECT
                                                                isi.productId,
                                                                SUM(isi.totalPrice) AS selAmt
                                                            FROM
                                                                inventory_stockIn_data AS isi
                                                            WHERE
                                                                isi.stockInId IN(
                                                                SELECT
                                                                    COALESCE(msod.mfStockOutId, NULL)
                                                                FROM
                                                                    factory_mfProductStockOut_data AS msod
                                                                WHERE
                                                                    msod.mfProductOutCategory = '${data.outCategoryId}'
                                                            ) AND 
                                                            ${req.query.startDate && req.query.endDate ? `isi.stockInDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')` : `isi.stockInDate >= DATE_SUB(CURDATE(), INTERVAL 1 MONTH) AND isi.stockInDate <= CURDATE()`}
                                                        GROUP BY
                                                            isi.productId) AS isid
                                                        ON
                                                            mfpd.mfProductId = isid.productId
                                                        WHERE mfpd.mfProductCategoryId = '${departmentId}'
                                                        ORDER BY mfpd.mfProductName ASC`;
                } else {
                    sql_queries_getdetails = `SELECT
                                                          mfpd.mfProductId AS mfProductId,
                                                          mfpd.mfProductName AS mfProductName,
                                                          mfpd.minMfProductUnit AS minMfProductUnit,
                                                          COALESCE(mfsod.qty, 0) AS remainingStock,
                                                          COALESCE(mfsod.costPrice, 0) AS costPrice,
                                                          ROUND(COALESCE(fdwod.sellAmt,0) + COALESCE(isid.selAmt,0) + COALESCE(autoWast.autoPrice,0)) AS sellAmt,
                                                          (ROUND(COALESCE(fdwod.sellAmt,0) + COALESCE(isid.selAmt,0)+ COALESCE(autoWast.autoPrice,0)))-(COALESCE(mfsod.costPrice, 0)) AS profit
                                                      FROM
                                                          factory_manufactureProduct_data AS mfpd
                                                      LEFT JOIN(
                                                            SELECT
                                                                mfsodAutoWast.mfProductId,
                                                                SUM(mfsodAutoWast.mfProductOutPrice) AS autoPrice
                                                            FROM
                                                                factory_mfProductStockOut_data AS mfsodAutoWast
                                                            WHERE
                                                                mfsodAutoWast.mfProductOutCategory IN ('Auto') AND
                                                                ${req.query.startDate && req.query.endDate ? `mfsodAutoWast.mfStockOutDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')` : ` mfsodAutoWast.mfStockOutDate >= DATE_SUB(CURDATE(), INTERVAL 1 MONTH) AND mfsodAutoWast.mfStockOutDate <= CURDATE()`}
                                                            GROUP BY
                                                                mfsodAutoWast.mfProductId) AS autoWast
                                                            ON
                                                                mfpd.mfProductId = autoWast.mfProductId
                                                      LEFT JOIN(
                                                            SELECT
                                                                mfso.mfProductId,
                                                                SUM(mfso.mfProductQty) AS qty,
                                                                SUM(mfso.mfProductOutPrice) AS costPrice
                                                            FROM
                                                                factory_mfProductStockOut_data AS mfso
                                                            WHERE
                                                                ${req.query.startDate && req.query.endDate ? `mfso.mfStockOutDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')` : `mfso.mfStockOutDate >= DATE_SUB(CURDATE(), INTERVAL 1 MONTH) AND mfso.mfStockOutDate <= CURDATE()`}
                                                            GROUP BY
                                                                mfso.mfProductId) AS mfsod
                                                            ON
                                                                mfpd.mfProductId = mfsod.mfProductId
                                                      LEFT JOIN(
                                                          SELECT
                                                              fdow.mfProductId,
                                                              SUM(fdow.sellAmount) AS sellAmt
                                                          FROM
                                                              factory_distributorWiseOut_data AS fdow
                                                          WHERE
                                                              fdow.mfStockOutId IN(
                                                              SELECT
                                                                  COALESCE(msod.mfStockOutId, NULL)
                                                              FROM
                                                                  factory_mfProductStockOut_data AS msod
                                                          ) AND 
                                                          ${req.query.startDate && req.query.endDate ? `fdow.sellDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')` : `fdow.sellDate >= DATE_SUB(CURDATE(), INTERVAL 1 MONTH) AND fdow.sellDate <= CURDATE()`}
                                                      GROUP BY
                                                          fdow.mfProductId) AS fdwod
                                                      ON
                                                          mfpd.mfProductId = fdwod.mfProductId
                                                      LEFT JOIN(
                                                          SELECT
                                                              isi.productId,
                                                              SUM(isi.totalPrice) AS selAmt
                                                          FROM
                                                              inventory_stockIn_data AS isi
                                                          WHERE
                                                              isi.stockInId IN(
                                                              SELECT
                                                                  COALESCE(msod.mfStockOutId, NULL)
                                                              FROM
                                                                  factory_mfProductStockOut_data AS msod
                                                          ) AND 
                                                          ${req.query.startDate && req.query.endDate ? `isi.stockInDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')` : `isi.stockInDate >= DATE_SUB(CURDATE(), INTERVAL 1 MONTH) AND isi.stockInDate <= CURDATE()`}
                                                      GROUP BY
                                                          isi.productId) AS isid
                                                      ON
                                                          mfpd.mfProductId = isid.productId
                                                      WHERE mfpd.mfProductCategoryId = '${departmentId}'
                                                      ORDER BY mfpd.mfProductName ASC`;
                }
                pool.query(sql_queries_getdetails, (err, rows, fields) => {
                    if (err) {
                        console.error("An error occurd in SQL Queery", err);
                        return res.status(500).send('Database Error');;
                    } else {
                        if (rows.length == 0) {
                            return res.status(200).send('No Data Found');
                        } else {
                            const datas = Object.values(JSON.parse(JSON.stringify(rows)))
                            processDatas(datas)
                                .then(async (data) => {
                                    const rows = datas ? datas.map((element, index) => data[index] && data[index].convertedQuantity ? { ...element, remainingStock: data[index].convertedQuantity, allConversation: data[index].vikJson } : { ...element, remainingStock: element.remainingStock + ' ' + element.productUnit, allConversation: data[index].vikJson },
                                    ) : []
                                    const workbook = new excelJS.Workbook();  // Create a new workbook
                                    const worksheet = workbook.addWorksheet("Profit And Sell Report"); // New Worksheet

                                    if (req.query.startDate && req.query.endDate) {
                                        worksheet.mergeCells('A1', 'F1');
                                        worksheet.getCell('A1').value = `Product Profit & Sell From ${(req.query.startDate).slice(4, 15)} To ${(req.query.endDate).slice(4, 15)}`;
                                    } else {
                                        worksheet.mergeCells('A1', 'F1');
                                        worksheet.getCell('A1').value = `Product Profit & Sell`;
                                    }

                                    /*Column headers*/
                                    worksheet.getRow(2).values = ['S no.', 'Product', 'Quantity', 'Total Cost', 'Sell Amount', 'Profit'];

                                    // Column for data in excel. key must match data key
                                    worksheet.columns = [
                                        { key: "s_no", width: 10, },
                                        { key: "mfProductName", width: 20 },
                                        { key: "remainingStock", width: 30 },
                                        { key: "costPrice", width: 20 },
                                        { key: "sellAmt", width: 10 },
                                        { key: "profit", width: 20 }
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
                                    worksheet.getRow(arr.length + 3).values = ['Total:', '', '', { formula: `SUM(D3:D${arr.length + 2})` }, { formula: `SUM(E3:E${arr.length + 2})` }, { formula: `SUM(F3:F${arr.length + 2})` }];

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
                                }).catch(error => {
                                    console.error('Error in processing datas:', error);
                                    return res.status(500).send('Internal Error');
                                });
                        }
                    }
                });
            } else {
                return res.status(404).send("Department Not Found");
            }
        } else {
            return res.status(401).send("Please Login Firest.....!");
        }
    } catch (error) {
        console.error('An error occurd', error);
        res.status(500).send('Internal Server Error');
    }
}

// Export PDF For Out Categiry Wise Mf Product Details

async function createPDFOtherTable(res, datas, sumFooterArray, tableHeading) {
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

const exportPdfForOutCategoryWiseMfProductData = (req, res) => {
    try {
        let token;
        token = req.headers.authorization ? req.headers.authorization.split(" ")[1] : null;
        if (token) {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const departmentId = decoded.id.categoryId ? decoded.id.categoryId : null;
            if (departmentId) {
                const data = {
                    startDate: (req.query.startDate ? req.query.startDate : '').slice(4, 15),
                    endDate: (req.query.endDate ? req.query.endDate : '').slice(4, 15),
                    outCategoryId: req.query.outCategoryId,
                    branchId: req.query.branchId
                }

                if (req.query.outCategoryId == 'Branch' && req.query.branchId) {
                    sql_queries_getdetails = `SELECT
                                                  mfpd.mfProductId AS mfProductId,
                                                  mfpd.mfProductName AS mfProductName,
                                                  mfpd.minMfProductUnit AS minMfProductUnit,
                                                  COALESCE(isid.qty, 0) AS remainingStock,
                                                  COALESCE(mfsod.costPrice, 0) AS costPrice,
                                                  COALESCE(isid.selAmt, 0) AS sellAmt,
                                                  (COALESCE(isid.selAmt, 0))-(COALESCE(mfsod.costPrice, 0)) AS profit
                                              FROM
                                                  factory_manufactureProduct_data AS mfpd
                                                LEFT JOIN(
                                                        SELECT
                                                            mfso.mfProductId,
                                                            SUM(mfso.mfProductOutPrice) AS costPrice
                                                        FROM
                                                            factory_mfProductStockOut_data AS mfso
                                                        WHERE
                                                            mfso.mfProductOutCategory = '${data.outCategoryId}' AND mfso.mfStockOutId IN(
                                                            SELECT
                                                                COALESCE(isd.stockInId, NULL)
                                                            FROM
                                                                inventory_stockIn_data AS isd
                                                            WHERE
                                                                isd.branchId = '${data.branchId}'
                                                        ) AND 
                                                        ${req.query.startDate && req.query.endDate ? `mfso.mfStockOutDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')` : `mfso.mfStockOutDate >= DATE_SUB(CURDATE(), INTERVAL 1 MONTH) AND mfso.mfStockOutDate <= CURDATE()`}
                                                    GROUP BY
                                                        mfso.mfProductId) AS mfsod
                                                    ON
                                                        mfpd.mfProductId = mfsod.mfProductId
                                                LEFT JOIN(
                                                    SELECT
                                                        isi.productId,
                                                        SUM(isi.productQty) AS qty,
                                                        SUM(isi.totalPrice) AS selAmt
                                                    FROM
                                                        inventory_stockIn_data AS isi
                                                    WHERE
                                                        isi.stockInId IN(
                                                        SELECT
                                                            COALESCE(msod.mfStockOutId, NULL)
                                                        FROM
                                                            factory_mfProductStockOut_data AS msod
                                                        WHERE
                                                            msod.mfProductOutCategory = '${data.outCategoryId}'
                                                    ) AND isi.branchId = '${data.branchId}' AND 
                                                    ${req.query.startDate && req.query.endDate ? `isi.stockInDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')` : `isi.stockInDate >= DATE_SUB(CURDATE(), INTERVAL 1 MONTH) AND isi.stockInDate <= CURDATE()`}
                                                GROUP BY
                                                    isi.productId) AS isid
                                                ON
                                                    mfpd.mfProductId = isid.productId
                                                WHERE mfpd.mfProductCategoryId = '${departmentId}'
                                                ORDER BY mfpd.mfProductName ASC`;
                } else if (req.query.outCategoryId) {
                    sql_queries_getdetails = `SELECT
                                                        mfpd.mfProductId AS mfProductId,
                                                        mfpd.mfProductName AS mfProductName,
                                                        mfpd.minMfProductUnit AS minMfProductUnit,
                                                        COALESCE(mfsod.qty, 0) AS remainingStock,
                                                        COALESCE(mfsod.costPrice, 0) AS costPrice,
                                                        COALESCE(fdwod.sellAmt,isid.selAmt,autoWast.autoPrice,0) AS sellAmt,
                                                        (COALESCE(fdwod.sellAmt,isid.selAmt,autoWast.autoPrice,0))-(COALESCE(mfsod.costPrice, 0)) AS profit
                                                      FROM
                                                          factory_manufactureProduct_data AS mfpd
                                                        LEFT JOIN(
                                                            SELECT
                                                                mfsodAutoWast.mfProductId,
                                                                SUM(mfsodAutoWast.mfProductOutPrice) AS autoPrice
                                                            FROM
                                                                factory_mfProductStockOut_data AS mfsodAutoWast
                                                            WHERE
                                                                mfsodAutoWast.mfProductOutCategory IN ('${data.outCategoryId == 'Auto' ? 'Auto' : null}') AND
                                                                ${req.query.startDate && req.query.endDate ? `mfsodAutoWast.mfStockOutDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')` : ` mfsodAutoWast.mfStockOutDate >= DATE_SUB(CURDATE(), INTERVAL 1 MONTH) AND mfsodAutoWast.mfStockOutDate <= CURDATE()`}
                                                            GROUP BY
                                                                mfsodAutoWast.mfProductId) AS autoWast
                                                            ON
                                                                mfpd.mfProductId = autoWast.mfProductId
                                                        LEFT JOIN(
                                                            SELECT
                                                                mfso.mfProductId,
                                                                SUM(mfso.mfProductQty) AS qty,
                                                                SUM(mfso.mfProductOutPrice) AS costPrice
                                                            FROM
                                                                factory_mfProductStockOut_data AS mfso
                                                            WHERE
                                                                mfso.mfProductOutCategory = '${data.outCategoryId}' AND
                                                                ${req.query.startDate && req.query.endDate ? `mfso.mfStockOutDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')` : `mfso.mfStockOutDate >= DATE_SUB(CURDATE(), INTERVAL 1 MONTH) AND mfso.mfStockOutDate <= CURDATE()`}
                                                            GROUP BY
                                                                mfso.mfProductId) AS mfsod
                                                            ON
                                                                mfpd.mfProductId = mfsod.mfProductId
                                                        LEFT JOIN(
                                                            SELECT
                                                                fdow.mfProductId,
                                                                SUM(fdow.sellAmount) AS sellAmt
                                                            FROM
                                                                factory_distributorWiseOut_data AS fdow
                                                            WHERE
                                                                fdow.mfStockOutId IN(
                                                                SELECT
                                                                    COALESCE(msod.mfStockOutId, NULL)
                                                                FROM
                                                                    factory_mfProductStockOut_data AS msod
                                                                WHERE
                                                                    msod.mfProductOutCategory = '${data.outCategoryId}'
                                                            ) AND 
                                                            ${req.query.startDate && req.query.endDate ? `fdow.sellDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')` : `fdow.sellDate >= DATE_SUB(CURDATE(), INTERVAL 1 MONTH) AND fdow.sellDate <= CURDATE()`}
                                                        GROUP BY
                                                            fdow.mfProductId) AS fdwod
                                                        ON
                                                            mfpd.mfProductId = fdwod.mfProductId
                                                        LEFT JOIN(
                                                            SELECT
                                                                isi.productId,
                                                                SUM(isi.totalPrice) AS selAmt
                                                            FROM
                                                                inventory_stockIn_data AS isi
                                                            WHERE
                                                                isi.stockInId IN(
                                                                SELECT
                                                                    COALESCE(msod.mfStockOutId, NULL)
                                                                FROM
                                                                    factory_mfProductStockOut_data AS msod
                                                                WHERE
                                                                    msod.mfProductOutCategory = '${data.outCategoryId}'
                                                            ) AND 
                                                            ${req.query.startDate && req.query.endDate ? `isi.stockInDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')` : `isi.stockInDate >= DATE_SUB(CURDATE(), INTERVAL 1 MONTH) AND isi.stockInDate <= CURDATE()`}
                                                        GROUP BY
                                                            isi.productId) AS isid
                                                        ON
                                                            mfpd.mfProductId = isid.productId
                                                        WHERE mfpd.mfProductCategoryId = '${departmentId}'
                                                        ORDER BY mfpd.mfProductName ASC`;
                } else {
                    sql_queries_getdetails = `SELECT
                                                          mfpd.mfProductId AS mfProductId,
                                                          mfpd.mfProductName AS mfProductName,
                                                          mfpd.minMfProductUnit AS minMfProductUnit,
                                                          COALESCE(mfsod.qty, 0) AS remainingStock,
                                                          COALESCE(mfsod.costPrice, 0) AS costPrice,
                                                          ROUND(COALESCE(fdwod.sellAmt,0) + COALESCE(isid.selAmt,0) + COALESCE(autoWast.autoPrice,0)) AS sellAmt,
                                                          (ROUND(COALESCE(fdwod.sellAmt,0) + COALESCE(isid.selAmt,0)+ COALESCE(autoWast.autoPrice,0)))-(COALESCE(mfsod.costPrice, 0)) AS profit
                                                      FROM
                                                          factory_manufactureProduct_data AS mfpd
                                                      LEFT JOIN(
                                                            SELECT
                                                                mfsodAutoWast.mfProductId,
                                                                SUM(mfsodAutoWast.mfProductOutPrice) AS autoPrice
                                                            FROM
                                                                factory_mfProductStockOut_data AS mfsodAutoWast
                                                            WHERE
                                                                mfsodAutoWast.mfProductOutCategory IN ('Auto') AND
                                                                ${req.query.startDate && req.query.endDate ? `mfsodAutoWast.mfStockOutDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')` : ` mfsodAutoWast.mfStockOutDate >= DATE_SUB(CURDATE(), INTERVAL 1 MONTH) AND mfsodAutoWast.mfStockOutDate <= CURDATE()`}
                                                            GROUP BY
                                                                mfsodAutoWast.mfProductId) AS autoWast
                                                            ON
                                                                mfpd.mfProductId = autoWast.mfProductId
                                                      LEFT JOIN(
                                                            SELECT
                                                                mfso.mfProductId,
                                                                SUM(mfso.mfProductQty) AS qty,
                                                                SUM(mfso.mfProductOutPrice) AS costPrice
                                                            FROM
                                                                factory_mfProductStockOut_data AS mfso
                                                            WHERE
                                                                ${req.query.startDate && req.query.endDate ? `mfso.mfStockOutDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')` : `mfso.mfStockOutDate >= DATE_SUB(CURDATE(), INTERVAL 1 MONTH) AND mfso.mfStockOutDate <= CURDATE()`}
                                                            GROUP BY
                                                                mfso.mfProductId) AS mfsod
                                                            ON
                                                                mfpd.mfProductId = mfsod.mfProductId
                                                      LEFT JOIN(
                                                          SELECT
                                                              fdow.mfProductId,
                                                              SUM(fdow.sellAmount) AS sellAmt
                                                          FROM
                                                              factory_distributorWiseOut_data AS fdow
                                                          WHERE
                                                              fdow.mfStockOutId IN(
                                                              SELECT
                                                                  COALESCE(msod.mfStockOutId, NULL)
                                                              FROM
                                                                  factory_mfProductStockOut_data AS msod
                                                          ) AND 
                                                          ${req.query.startDate && req.query.endDate ? `fdow.sellDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')` : `fdow.sellDate >= DATE_SUB(CURDATE(), INTERVAL 1 MONTH) AND fdow.sellDate <= CURDATE()`}
                                                      GROUP BY
                                                          fdow.mfProductId) AS fdwod
                                                      ON
                                                          mfpd.mfProductId = fdwod.mfProductId
                                                      LEFT JOIN(
                                                          SELECT
                                                              isi.productId,
                                                              SUM(isi.totalPrice) AS selAmt
                                                          FROM
                                                              inventory_stockIn_data AS isi
                                                          WHERE
                                                              isi.stockInId IN(
                                                              SELECT
                                                                  COALESCE(msod.mfStockOutId, NULL)
                                                              FROM
                                                                  factory_mfProductStockOut_data AS msod
                                                          ) AND 
                                                          ${req.query.startDate && req.query.endDate ? `isi.stockInDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')` : `isi.stockInDate >= DATE_SUB(CURDATE(), INTERVAL 1 MONTH) AND isi.stockInDate <= CURDATE()`}
                                                      GROUP BY
                                                          isi.productId) AS isid
                                                      ON
                                                          mfpd.mfProductId = isid.productId
                                                      WHERE mfpd.mfProductCategoryId = '${departmentId}'
                                                      ORDER BY mfpd.mfProductName ASC`;
                }
                pool.query(sql_queries_getdetails, (err, rows, fields) => {
                    if (err) {
                        console.error("An error occurd in SQL Queery", err);
                        return res.status(500).send('Database Error');;
                    } else {
                        if (rows.length == 0) {
                            return res.status(400).send('No Data Found');
                        } else {
                            const datas = Object.values(JSON.parse(JSON.stringify(rows)))
                            processDatas(datas)
                                .then(async (data) => {
                                    const rows = datas ? datas.map((element, index) => data[index] && data[index].convertedQuantity ? { ...element, remainingStock: data[index].convertedQuantity, allConversation: data[index].vikJson } : { ...element, remainingStock: element.remainingStock + ' ' + element.productUnit, allConversation: data[index].vikJson },
                                    ) : []
                                    const abc = rows.map(e => {
                                        return {
                                            "Product Name": e.mfProductName,
                                            "Used Qty": e.remainingStock,
                                            "Cost": e.costPrice,
                                            "Sell Amount": e.sellAmt,
                                            "Profit": e.profit
                                        };
                                    });
                                    const cost = abc.reduce((total, item) => total + (item['Cost'] || 0), 0);;
                                    const sell = abc.reduce((total, item) => total + (item['Sell Amount'] || 0), 0);;
                                    const profit = abc.reduce((total, item) => total + (item['Profit'] || 0), 0);;
                                    const sumFooterArray = ['Total', '', '', parseFloat(cost).toLocaleString('en-IN'), parseFloat(sell).toLocaleString('en-IN'), parseFloat(profit).toLocaleString('en-IN')];
                                    if (req.query.startMonth && req.query.endMonth) {
                                        tableHeading = `Product Profit & Sell From ${(req.query.startDate).slice(4, 15)} To ${(req.query.endDate).slice(4, 15)}`;
                                    } else {
                                        tableHeading = `Product Profit & Sell Report`;
                                    }

                                    createPDFOtherTable(res, abc, sumFooterArray, tableHeading)
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
                    }
                })
            } else {
                return res.status(404).send("Department Not Found");
            }
        } else {
            return res.status(401).send("Please Login Firest.....!");
        }
    } catch (error) {
        console.error('An error occurd', error);
        res.status(500).send('Internal Server Error');
    }
}

module.exports = {
    getManufactureProductTable,
    addMfProductData,
    removeMfProductData,
    updateMfProductData,
    getMfUnitPreferenceById,
    getMfProductListCounter,
    getStaticsOutCategoryWiseMfProductData,
    getmfProductDetailsById,
    getMfProductCountDetailsById,
    getOutCategoryWiseMfProductData,
    getOutCategoryWiseUsedByProduct,
    getDistridutorWiseSellByMfProductId,
    exportExcelSheetForMfProduct,
    exportPdfForMfProductData,
    exportExcelForOutCategoryWiseMfProductData,
    exportPdfForOutCategoryWiseMfProductData
}