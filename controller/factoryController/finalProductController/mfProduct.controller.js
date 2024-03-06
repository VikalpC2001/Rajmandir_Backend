const pool = require('../../../database');
const jwt = require("jsonwebtoken");
const { processDatas } = require("./mfConversation.controller");
const { newConversationAsync } = require("./mfConversation.controller");
const { computeConversionFactors } = require("./mfConversation.controller");

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
                ...data[0][0], // Copy the first object as it contains the rm information
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

const getOutCategoryWiseMfProductData = (req, res) => {
    try {
        let token;
        token = req.headers.authorization ? req.headers.authorization.split(" ")[1] : null;
        if (token) {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const departmentId = decoded.id.categoryId ? decoded.id.categoryId : null;
            console.log(departmentId, 'l;l;l;l')
            const page = req.query.page;
            const numPerPage = req.query.numPerPage;
            const skip = (page - 1) * numPerPage;
            const limit = skip + ',' + numPerPage;
            if (departmentId) {
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
                                                          COALESCE(isid.selAmt, 0) AS sellAmt
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
                                                        COALESCE(fdwod.sellAmt,isid.selAmt,mfsod.costPrice,0) AS sellAmt
                                                      FROM
                                                          factory_manufactureProduct_data AS mfpd
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
                                                          ROUND(COALESCE(fdwod.sellAmt,0) + COALESCE(isid.selAmt,0) + COALESCE(mfsod.costPrice,0)) AS sellAmt 
                                                      FROM
                                                          factory_manufactureProduct_data AS mfpd
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
                                console.log(rows);
                                console.log(numRows);
                                console.log("Total Page :-", numPages);
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
                                        return res.status(200).send({ "mfProductId": mfProductId, "mfProductName": data.productName, "msg": "Product Added Successfully" });
                                    });
                                } else {
                                    return res.status(200).send({ "mfProductID": mfProductId, "mfProductName": data.productName, "msg": "Product Added Successfully" });
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
        var mfProductId = req.query.mfProductId.trim();
        const supplierId = 'Rajmandir'
        req.query.mfProductId = pool.query(`SELECT mfProductId FROM factory_manufactureProduct_data WHERE mfProductId = '${mfProductId}'`, (err, row) => {
            if (err) {
                console.error("An error occurd in SQL Queery", err);
                return res.status(500).send('Database Error');
            }
            if (row && row.length) {
                const sql_querry_removedetails = `DELETE FROM factory_manufactureProduct_data WHERE mfProductId = '${mfProductId}';
                                                  DELETE FROM inventory_supplierProducts_data WHERE supplierId = '${supplierId}' AND mfProductId = '${mfProductId}'`;
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
                                                     minProductUnit = '${data.minProductQty}'
                                                 WHERE inventory_product_data.mfProductId = '${mfProductId}'`;
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
            return res.status(401).send("Please Login Firest.....!");
        }
    } catch (error) {
        console.error('An error occurd', error);
        res.status(500).json('Internal Server Error');
    }
}

module.exports = {
    getManufactureProductTable,
    addMfProductData,
    removeMfProductData,
    updateMfProductData,
    getMfProductListCounter,
    getmfProductDetailsById,
    getMfProductCountDetailsById,
    getOutCategoryWiseMfProductData,
    getOutCategoryWiseUsedByProduct,
    getDistridutorWiseSellByMfProductId

}