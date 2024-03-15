const pool = require('../../database');
const excelJS = require("exceljs");
const jwt = require("jsonwebtoken");
const { jsPDF } = require('jspdf');
require('jspdf-autotable');
const { processDatas } = require("../inventoryController/conversation.controller");
const { newConversationAsync } = require("../inventoryController/conversation.controller");
const { computeConversionFactors } = require("../inventoryController/conversation.controller");

// Get Product Counter Details

const getProductCountDetailsById = (req, res) => {
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
                    productId: req.query.productId
                }
                const sql_querry_StatickCCount = `SELECT
                                                       p.minProductQty,
                                                       p.minProductUnit,
                                                       COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) AS remainingStock,
                                                       COALESCE(ROUND(siLu.productPrice,2), 0) AS lastPrice,
                                                       COALESCE(si.total_siPrice, 0) - COALESCE(so.total_soPrice, 0) AS remainPrice
                                                   FROM
                                                       inventory_product_data AS p
                                                   LEFT JOIN(
                                                       SELECT
                                                           inventory_stockIn_data.productId,
                                                           ROUND(SUM(
                                                               inventory_stockIn_data.productQty
                                                           ),2) AS total_quantity,
                                                           ROUND(SUM(
                                                            inventory_stockIn_data.totalPrice
                                                           )) AS total_siPrice
                                                       FROM
                                                           inventory_stockIn_data
                                                        WHERE inventory_stockIn_data.branchId = '${branchId}'
                                                       GROUP BY
                                                           inventory_stockIn_data.productId
                                                   ) AS si
                                                   ON
                                                       p.productId = si.productId
                                                   LEFT JOIN(
                                                       SELECT
                                                           inventory_stockOut_data.productId,
                                                           ROUND(SUM(
                                                               inventory_stockOut_data.productQty
                                                           ),2) AS total_quantity,
                                                           ROUND(SUM(
                                                               inventory_stockOut_data.stockOutPrice
                                                           )) AS total_soPrice
                                                       FROM
                                                           inventory_stockOut_data
                                                        WHERE inventory_stockOut_data.branchId = '${branchId}'
                                                       GROUP BY
                                                           inventory_stockOut_data.productId
                                                   ) AS so
                                                   ON
                                                       p.productId = so.productId
                                                   LEFT JOIN(
                                                       SELECT
                                                           productId,
                                                           stockInDate,
                                                           productQty,
                                                           productPrice
                                                       FROM
                                                           inventory_stockIn_data
                                                       WHERE inventory_stockIn_data.branchId = '${branchId}' AND
                                                           (productId, stockInCreationDate) IN(
                                                           SELECT
                                                               productId,
                                                               MAX(stockInCreationDate)
                                                           FROM
                                                               inventory_stockIn_data
                                                           GROUP BY
                                                               productId
                                                       )
                                                   ) AS siLu
                                                   ON
                                                       p.productId = siLu.productId
                                                  WHERE p.productId = '${data.productId}'`;
                if (req.query.startDate && req.query.endDate) {
                    sql_querry_getProductCount = `SELECT COALESCE(ROUND(SUM(productQty),2),0) AS purchase, COALESCE(ROUND(SUM(totalPrice)),0) AS totalRs FROM inventory_stockIn_data WHERE inventory_stockIn_data.productId = '${data.productId}' AND inventory_stockIn_data.branchId = '${branchId}' AND inventory_stockIn_data.stockInDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y');
                                                  SELECT COALESCE(ROUND(SUM(productQty),2),0) AS used, COALESCE(ROUND(SUM(stockOutPrice)),0) AS totalUsedPrice FROM inventory_stockOut_data WHERE inventory_stockOut_data.productId = '${data.productId}' AND inventory_stockOut_data.branchId = '${branchId}' AND inventory_stockOut_data.stockOutDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y');
                                          ${sql_querry_StatickCCount}`;
                } else {
                    sql_querry_getProductCount = `SELECT COALESCE(ROUND(SUM(productQty),2),0) AS purchase, COALESCE(ROUND(SUM(totalPrice)),0) AS totalRs FROM inventory_stockIn_data WHERE inventory_stockIn_data.productId = '${data.productId}' AND inventory_stockIn_data.branchId = '${branchId}' AND inventory_stockIn_data.stockInDate BETWEEN STR_TO_DATE('${firstDay}','%b %d %Y') AND STR_TO_DATE('${lastDay}','%b %d %Y');
                                                  SELECT COALESCE(ROUND(SUM(productQty),2),0) AS used, COALESCE(ROUND(SUM(stockOutPrice)),0) AS totalUsedPrice FROM inventory_stockOut_data WHERE inventory_stockOut_data.productId = '${data.productId}' AND inventory_stockOut_data.branchId = '${branchId}' AND inventory_stockOut_data.stockOutDate BETWEEN STR_TO_DATE('${firstDay}','%b %d %Y') AND STR_TO_DATE('${lastDay}','%b %d %Y');
                                          ${sql_querry_StatickCCount}`;
                }
                pool.query(sql_querry_getProductCount, (err, results) => {
                    if (err) {
                        console.error("An error occurd in SQL Queery", err);
                        return res.status(500).send('Database Error');
                    }
                    else {
                        const datas = [
                            {
                                productId: req.query.productId,
                                remainingStock: results[0][0].purchase,
                                minProductUnit: results[2][0].minProductUnit
                            },
                            {
                                productId: req.query.productId,
                                remainingStock: results[1][0].used,
                                minProductUnit: results[2][0].minProductUnit
                            },
                            {
                                productId: req.query.productId,
                                remainingStock: results[2][0].remainingStock,
                                minProductUnit: results[2][0].minProductUnit
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
                                let minProductQty = results[2][0].minProductQty;

                                convertedQuantities.push(
                                    { totalRs: totalRs },
                                    { totalUsedPrice: totalUsedPrice },
                                    { remainUsedPrice: remainUsedPrice },
                                    { lastPrice: lastPrice },
                                    { minProductQty: minProductQty },
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
                return res.status(401).send("BranchId Not Found");
            }
        } else {
            return res.status(401).send("Please Login Firest.....!");
        }
    } catch (error) {
        console.error('An error occurd', error);
        res.status(500).json('Internal Server Error');
    }
}

// Get Product wise Supplier Api

const getSupplierByProductId = (req, res) => {
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
                    productId: req.query.productId
                }
                if (req.query.startDate && req.query.endDate) {
                    var sql_querry_getSupplierByProductId = `SELECT
                                                                inventory_supplier_data.supplierNickName,
                                                                ispd.productId,
                                                                ipd.minProductUnit,
                                                                COALESCE(si.quantity,0) AS remainingStock,
                                                                COALESCE(si.expense,0) AS expense
                                                            FROM
                                                                inventory_supplierProducts_data AS ispd
                                                            INNER JOIN inventory_product_data AS ipd ON ipd.productId = ispd.productId
                                                            INNER JOIN inventory_supplier_data ON inventory_supplier_data.supplierId = ispd.supplierId
                                                            LEFT JOIN
                                                                (
                                                                    SELECT
                                                                        inventory_stockIn_data.supplierId,
                                                                        ROUND(SUM(
                                                                            inventory_stockIn_data.productQty
                                                                        ),2) AS quantity,
                                                                        ROUND(SUM(
                                                                            inventory_stockIn_data.totalPrice
                                                                        )) AS expense
                                                                    FROM
                                                                        inventory_stockIn_data
                                                                    WHERE
                                                                        inventory_stockIn_data.branchId = '${branchId}' AND productId = '${data.productId}' AND inventory_stockIn_data.stockInDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')
                                                                    GROUP BY
                                                                        inventory_stockIn_data.supplierId
                                                                ) AS si
                                                                ON
                                                                    ispd.supplierId = si.supplierId
                                                            WHERE ispd.productId = '${data.productId}'
                                                            ORDER BY si.expense DESC`;
                } else {
                    var sql_querry_getSupplierByProductId = `SELECT
                                                                inventory_supplier_data.supplierNickName,
                                                                ispd.productId,
                                                                ipd.minProductUnit,
                                                                COALESCE(si.quantity,0) AS remainingStock,
                                                                COALESCE(si.expense,0) AS expense
                                                            FROM
                                                                inventory_supplierProducts_data AS ispd
                                                            INNER JOIN inventory_product_data AS ipd ON ipd.productId = ispd.productId
                                                            INNER JOIN inventory_supplier_data ON inventory_supplier_data.supplierId = ispd.supplierId
                                                            LEFT JOIN
                                                                (
                                                                    SELECT
                                                                        inventory_stockIn_data.supplierId,
                                                                        ROUND(SUM(
                                                                            inventory_stockIn_data.productQty
                                                                        ),2) AS quantity,
                                                                        ROUND(SUM(
                                                                            inventory_stockIn_data.totalPrice
                                                                        )) AS expense
                                                                    FROM
                                                                        inventory_stockIn_data
                                                                    WHERE
                                                                        inventory_stockIn_data.branchId = '${branchId}' AND productId = '${data.productId}' AND inventory_stockIn_data.stockInDate BETWEEN STR_TO_DATE('${firstDay}','%b %d %Y') AND STR_TO_DATE('${lastDay}','%b %d %Y')
                                                                    GROUP BY
                                                                        inventory_stockIn_data.supplierId
                                                                ) AS si
                                                                ON
                                                                    ispd.supplierId = si.supplierId
                                                            WHERE ispd.productId = '${data.productId}'
                                                            ORDER BY si.expense DESC`;
                }
                console.log(sql_querry_getSupplierByProductId)
                pool.query(sql_querry_getSupplierByProductId, (err, result) => {
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
                return res.status(401).send("BranchId Not Found");
            }
        } else {
            return res.status(401).send("Please Login Firest.....!");
        }
    } catch (error) {
        console.error('An error occurd', error);
        res.status(500).json('Internal Server Error');
    }
}

// Product List API

const getProductList = (req, res) => {
    try {
        let token;
        token = req.headers.authorization ? req.headers.authorization.split(" ")[1] : null;
        if (token) {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const branchId = decoded && decoded.id && decoded.id.branchId ? decoded.id.branchId : null;
            if (branchId) {
                req.query.productStatus
                const sql_querry_getProductListwithStatus = `SELECT
                                                         p.productId,
                                                         UPPER(p.productName) AS productName,
                                                         p.minProductQty,
                                                         p.minProductUnit,
                                                         COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) AS remainingStock,
                                                         COALESCE(siLu.productPrice, 0) AS lastPrice,
                                                         COALESCE(siLu.productQty, 0) AS lastUpdatedQty,
                                                         COALESCE(
                                                             DATE_FORMAT(siLu.stockInDate, '%d-%m-%Y'),
                                                             "No Update"
                                                         ) AS lastUpdatedStockInDate,
                                                         CASE WHEN COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) >= p.minProductQty THEN 'In Stock' WHEN COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) < p.minProductQty AND COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) != 0 THEN 'Under Stocked' ELSE 'Out of Stock'
                                                     END AS stockStatus
                                                     FROM
                                                         inventory_product_data AS p
                                                     LEFT JOIN(
                                                         SELECT inventory_stockIn_data.productId,
                                                             ROUND(SUM(
                                                                 inventory_stockIn_data.productQty
                                                             ),2) AS total_quantity
                                                         FROM
                                                             inventory_stockIn_data
                                                        WHERE inventory_stockIn_data.branchId = '${branchId}'
                                                         GROUP BY
                                                             inventory_stockIn_data.productId
                                                     ) AS si
                                                     ON
                                                         p.productId = si.productId
                                                     LEFT JOIN(
                                                         SELECT inventory_stockOut_data.productId,
                                                             ROUND(SUM(
                                                                 inventory_stockOut_data.productQty
                                                             ),2) AS total_quantity
                                                         FROM
                                                             inventory_stockOut_data
                                                         WHERE inventory_stockOut_data.branchId = '${branchId}'
                                                         GROUP BY
                                                             inventory_stockOut_data.productId
                                                     ) AS so
                                                     ON
                                                         p.productId = so.productId
                                                     LEFT JOIN(
                                                         SELECT productId,
                                                             stockInDate,
                                                             productQty,
                                                             productPrice
                                                         FROM
                                                             inventory_stockIn_data
                                                         WHERE inventory_stockIn_data.branchId = '${branchId}' AND
                                                             (productId, stockInCreationDate) IN(
                                                             SELECT
                                                                 productId,
                                                                 MAX(stockInCreationDate)
                                                             FROM
                                                                 inventory_stockIn_data
                                                             GROUP BY
                                                                 productId
                                                         )
                                                     ) AS siLu
                                                     ON
                                                         p.productId = siLu.productId`;
                if (req.query.productStatus == 1) {
                    sql_querry_getProductList = `${sql_querry_getProductListwithStatus}
                                            WHERE COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) >= p.minProductQty 
                                            ORDER BY p.productName`;
                } else if (req.query.productStatus == 2) {
                    sql_querry_getProductList = `${sql_querry_getProductListwithStatus}
                                            WHERE COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) < p.minProductQty AND COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) != 0 
                                            ORDER BY p.productName`;
                } else if (req.query.productStatus == 3) {
                    sql_querry_getProductList = `${sql_querry_getProductListwithStatus}
                                            WHERE COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) = 0
                                            ORDER BY p.productName`;
                } else {
                    sql_querry_getProductList = `${sql_querry_getProductListwithStatus}
                                            ORDER BY p.productName`;
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
                return res.status(401).send("BranchId Not Found");
            }
        } else {
            return res.status(401).send("Please Login Firest.....!");
        }
    } catch (error) {
        console.error('An error occurd', error);
        res.status(500).json('Internal Server Error');
    }
}

// Product List Counter

const getProductListCounter = (req, res) => {
    try {
        let token;
        token = req.headers.authorization ? req.headers.authorization.split(" ")[1] : null;
        if (token) {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const branchId = decoded && decoded.id && decoded.id.branchId ? decoded.id.branchId : null;
            if (branchId) {
                const productCategory = req && req.query.productCategory ? req.query.productCategory : null;
                var sql_querry_joins = `LEFT JOIN
                                    (
                                        SELECT
                                            inventory_stockIn_data.productId,
                                            ROUND(SUM(inventory_stockIn_data.productQty),2) AS total_quantity
                                        FROM
                                            inventory_stockIn_data
                                        WHERE inventory_stockIn_data.branchId = '${branchId}'
                                        GROUP BY
                                            inventory_stockIn_data.productId
                                    ) AS si ON p.productId = si.productId
                                  LEFT JOIN
                                    (
                                        SELECT
                                            inventory_stockOut_data.productId,
                                            ROUND(SUM(inventory_stockOut_data.productQty),2) AS total_quantity
                                        FROM
                                            inventory_stockOut_data
                                        WHERE inventory_stockOut_data.branchId = '${branchId}'
                                        GROUP BY
                                            inventory_stockOut_data.productId
                                    ) AS so ON p.productId = so.productId`;
                if (productCategory) {
                    sql_querry_getProductList = `SELECT COUNT(*) AS inStockProduct
                                        FROM
                                            inventory_product_data AS p
                                        ${sql_querry_joins}
                                        WHERE p.productCategoryId = '${productCategory}' AND COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) >= p.minProductQty;
                                        SELECT COUNT(*) AS underStockedProduct
                                        FROM
                                            inventory_product_data AS p
                                        ${sql_querry_joins}
                                           WHERE p.productCategoryId = '${productCategory}' AND COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) < p.minProductQty AND COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) != 0;
                                           SELECT COUNT(*) AS outOfStockProduct
                                        FROM
                                            inventory_product_data AS p
                                        ${sql_querry_joins}
                                        WHERE p.productCategoryId = '${productCategory}' AND p.productCategoryId = '${productCategory}' AND COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) = 0;
                                        SELECT COUNT(*) AS allProduct
                                        FROM
                                            inventory_product_data AS p
                                        ${sql_querry_joins}
                                        WHERE p.productCategoryId = '${productCategory}'`;
                } else {
                    sql_querry_getProductList = `SELECT COUNT(*) AS inStockProduct
                                        FROM
                                            inventory_product_data AS p
                                        ${sql_querry_joins}
                                        WHERE COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) >= p.minProductQty;
                                        SELECT COUNT(*) AS underStockedProduct
                                        FROM
                                            inventory_product_data AS p
                                        ${sql_querry_joins}
                                           WHERE COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) < p.minProductQty AND COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) != 0;
                                           SELECT COUNT(*) AS outOfStockProduct
                                        FROM
                                            inventory_product_data AS p
                                        ${sql_querry_joins}
                                        WHERE COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) = 0;
                                        SELECT COUNT(*) AS allProduct
                                        FROM
                                            inventory_product_data AS p
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
                            instockProduct: data[0][0].inStockProduct,
                            underStockedProduct: data[1][0].underStockedProduct,
                            outOfStock: data[2][0].outOfStockProduct,
                            allProduct: data[3][0].allProduct
                        }
                        return res.status(200).send(count);
                    }
                })
            } else {
                return res.status(401).send("BranchId Not Found");
            }
        } else {
            return res.status(401).send("Please Login Firest.....!");
        }
    } catch (error) {
        console.error('An error occurd', error);
        res.status(500).json('Internal Server Error');
    }
}

// Add Product API

const addProduct = async (req, res) => {
    try {
        const uid1 = new Date();
        const productId = String("product_" + uid1.getTime());
        const priorityArray = req.body.priorityArray;
        const data = {
            productCategoryId: req.body.productCategoryId,
            productName: req.body.productName.trim(),
            gujaratiProductName: req.body.gujaratiProductName,
            minProductQty: req.body.minProductQty,
            minProductUnit: req.body.minProductUnit.trim(),
            leadTime: req.body.leadTime ? req.body.leadTime : 0,
            isExpired: req.body.isExpired ? req.body.isExpired : false,
            expiredDays: req.body.expiredDays ? req.body.expiredDays : 0
        }
        console.log(">>?>?>?>", data.productName);
        if (!data.productName || !data.productCategoryId || !data.minProductQty || !data.minProductUnit) {
            return res.status(400).send("Please Fill All The Fields");
        } else {
            req.body.productName = pool.query(`SELECT productName FROM inventory_product_data WHERE productName = '${data.productName}'`, function (err, row) {
                if (err) {
                    console.error("An error occurd in SQL Queery", err);
                    return res.status(500).send('Database Error');
                }
                if (row && row.length) {
                    return res.status(400).send('Product is Already In Use');
                } else {
                    const sql_querry_addUser = `INSERT INTO inventory_product_data(productId, productCategoryId, productName, gujaratiProductName, minProductQty, minProductUnit, leadTime, isExpired, expiredDays)
                                                VALUES('${productId}', '${data.productCategoryId}', '${data.productName}',  ${data.gujaratiProductName ? `'${data.gujaratiProductName}'` : null},  ${data.minProductQty}, '${data.minProductUnit}', ${data.leadTime}, ${data.isExpired}, ${data.isExpired ? `${data.expiredDays}` : 0})`;
                    pool.query(sql_querry_addUser, (err, result) => {
                        if (err) {
                            console.error("An error occurd in SQL Queery", err);
                            return res.status(500).send('Database Error');
                        }
                        if (priorityArray.length != 0 && priorityArray) {
                            let addPriorityData = priorityArray.map((item, index) => {
                                let uniqueId = `PriorityId_${Date.now() + index}`; // Generating a unique ID using current timestamp
                                let priorityNumber = index + 1; // Define Priority Number
                                return `('${uniqueId}', '${productId}', ${priorityNumber}, '${item.bigUnitName}', ${item.unitNumber}, '${item.smallUnitName}')`;
                            }).join(', ');
                            console.log(addPriorityData);
                            const sql_querry_addPriority = `INSERT INTO product_unit_preference (preferenceId, productId, priorityNumber, bigUnitName, unitNumber, smallUnitName)
                                                            VALUES ${addPriorityData}`;
                            pool.query(sql_querry_addPriority, (err, result) => {
                                if (err) {
                                    console.error("An error occurd in SQL Queery", err);
                                    return res.status(500).send('Database Error');
                                }
                                return res.status(200).send("Product Added Successfully");
                            });
                        } else {
                            return res.status(200).send("Product Added Successfully");
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

// get Product Details Table

const getProductDetailsTable = (req, res) => {
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
                const data = {
                    startDate: (req.query.startDate ? req.query.startDate : '').slice(4, 15),
                    endDate: (req.query.endDate ? req.query.endDate : '').slice(4, 15),
                    productStatus: req.query.productStatus,
                    searchProduct: req.query.searchProduct,
                    productCategory: req.query.productCategory
                }
                const sql_querry_staticQuery = `SELECT
                                                p.productId,
                                                UCASE(p.productName) AS productName,
                                                p.minProductQty,
                                                p.minProductUnit,
                                                CONCAT(p.leadTime,' ','Day') AS leadTime,
                                                p.isExpired,
                                                CONCAT(p.expiredDays,' ','Day') AS expiredDays,
                                                COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) AS remainingStock,
                                                COALESCE(siLu.productPrice, 0) AS lastPrice,
                                                COALESCE(siLu.productQty, 0) AS lastUpdatedQty,
                                                COALESCE(
                                                    DATE_FORMAT(siLu.stockInDate, '%d-%m-%Y'),
                                                    "No Update"
                                                ) AS lastUpdatedStockInDate,
                                                CASE WHEN COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) >= p.minProductQty THEN 'In-Stock' WHEN COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) < p.minProductQty AND COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) != 0 THEN 'Low-Stock' ELSE 'Out-Stock'
                                            END AS stockStatus
                                            FROM
                                                inventory_product_data AS p
                                            LEFT JOIN(
                                                SELECT
                                                    inventory_stockIn_data.productId,
                                                    ROUND(SUM(
                                                        inventory_stockIn_data.productQty
                                                    ),2) AS total_quantity
                                                FROM
                                                    inventory_stockIn_data
                                                WHERE branchId = '${branchId}'
                                                GROUP BY
                                                    inventory_stockIn_data.productId
                                            ) AS si
                                            ON
                                                p.productId = si.productId
                                            LEFT JOIN(
                                                SELECT
                                                    inventory_stockOut_data.productId,
                                                    ROUND(SUM(
                                                        inventory_stockOut_data.productQty
                                                    ),2) AS total_quantity
                                                FROM
                                                    inventory_stockOut_data
                                                WHERE branchId = '${branchId}'
                                                GROUP BY
                                                    inventory_stockOut_data.productId
                                            ) AS so
                                            ON
                                                p.productId = so.productId
                                            LEFT JOIN(
                                                SELECT
                                                    productId,
                                                    stockInDate,
                                                    productQty,
                                                    productPrice
                                                FROM
                                                    inventory_stockIn_data
                                                WHERE branchId = '${branchId}' AND
                                                    (productId, stockInCreationDate) IN(
                                                    SELECT
                                                        productId,
                                                        MAX(stockInCreationDate)
                                                    FROM
                                                        inventory_stockIn_data
                                                    GROUP BY
                                                        productId
                                                )
                                            ) AS siLu
                                            ON
                                                p.productId = siLu.productId`;
                const sql_querry_getMwSiSO = `SELECT
                                                p.productId,
                                                UCASE(p.productName) AS productName,
                                                p.minProductQty,
                                                p.minProductUnit,
                                                CONCAT(p.leadTime,' ','Day') AS leadTime,
                                                p.isExpired,
                                                CONCAT(p.expiredDays,' ','Day') AS expiredDays,
                                                COALESCE(simw.total_quantity, 0) AS purchese,
                                                COALESCE(somw.total_quantity, 0) AS totalUsed,
                                                COALESCE(simw.totalExpense,0) AS totalExpense,
                                                COALESCE(somw.totalStockOutPrice,0) AS totalStockOutPrice,
                                                COALESCE(si.total_siPrice, 0) - COALESCE(so.total_soPrice, 0) AS remainPrice,
                                                COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) AS remainingStock,
                                                COALESCE(siLu.productPrice, 0) AS lastPrice,
                                                COALESCE(siLu.productQty, 0) AS lastUpdatedQty,
                                                COALESCE(
                                                    DATE_FORMAT(siLu.stockInDate, '%d-%m-%Y'),
                                                    "No Update"
                                                ) AS lastUpdatedStockInDate,
                                                CASE WHEN COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) >= p.minProductQty THEN 'In-Stock' WHEN COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) < p.minProductQty AND COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) != 0 THEN 'Low-Stock' ELSE 'Out-Stock'
                                            END AS stockStatus
                                            FROM
                                                inventory_product_data AS p
                                            LEFT JOIN(
                                                SELECT
                                                    inventory_stockIn_data.productId,
                                                    ROUND(SUM(
                                                        inventory_stockIn_data.productQty
                                                    ),2) AS total_quantity,
                                                    ROUND(SUM(
                                                        inventory_stockIn_data.totalPrice
                                                    ),2) AS total_siPrice
                                                FROM
                                                    inventory_stockIn_data
                                                WHERE branchId = '${branchId}'
                                                GROUP BY
                                                    inventory_stockIn_data.productId
                                            ) AS si
                                            ON
                                                p.productId = si.productId
                                            LEFT JOIN(
                                                SELECT
                                                    inventory_stockOut_data.productId,
                                                    ROUND(SUM(
                                                        inventory_stockOut_data.productQty
                                                    ),2) AS total_quantity,
                                                    ROUND(SUM(
                                                        inventory_stockOut_data.stockOutPrice
                                                    ),2) AS total_soPrice
                                                FROM
                                                    inventory_stockOut_data
                                                WHERE branchId = '${branchId}'
                                                GROUP BY
                                                    inventory_stockOut_data.productId
                                            ) AS so
                                            ON
                                                p.productId = so.productId
                                            LEFT JOIN(
                                                SELECT
                                                    productId,
                                                    stockInDate,
                                                    productQty,
                                                    productPrice
                                                FROM
                                                    inventory_stockIn_data
                                                WHERE branchId = '${branchId}' AND
                                                    (productId, stockInCreationDate) IN(
                                                    SELECT
                                                        productId,
                                                        MAX(stockInCreationDate) As lastDate
                                                    FROM
                                                        inventory_stockIn_data
                                                    GROUP BY
                                                        productId
                                                )
                                            ) AS siLu
                                            ON
                                                p.productId = siLu.productId`;
                const sql_querry_joins = `LEFT JOIN
                                                    (
                                                        SELECT
                                                            inventory_stockIn_data.productId,
                                                            ROUND(SUM(inventory_stockIn_data.productQty),2) AS total_quantity
                                                        FROM
                                                            inventory_stockIn_data
                                                        WHERE branchId = '${branchId}'
                                                        GROUP BY
                                                            inventory_stockIn_data.productId
                                                    ) AS si ON p.productId = si.productId
                                          LEFT JOIN
                                                    (
                                                        SELECT
                                                            inventory_stockOut_data.productId,
                                                            ROUND(SUM(inventory_stockOut_data.productQty),2) AS total_quantity
                                                        FROM
                                                            inventory_stockOut_data
                                                        WHERE branchId = '${branchId}'
                                                        GROUP BY
                                                            inventory_stockOut_data.productId
                                                    ) AS so ON p.productId = so.productId`;
                if (req.query.productCategory) {
                    if (req.query.productStatus == 1) {
                        sql_get_pagination = `SELECT COUNT(*) AS numRows FROM inventory_product_data AS p
                                                ${sql_querry_joins}
                                                WHERE p.productCategoryId = '${data.productCategory}' AND COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) >= p.minProductQty`;
                    } else if (req.query.productStatus == 2) {
                        sql_get_pagination = `SELECT COUNT(*) AS numRows FROM inventory_product_data AS p
                                                ${sql_querry_joins}
                                                WHERE p.productCategoryId = '${data.productCategory}' AND COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) < p.minProductQty AND COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) != 0`;
                    } else if (req.query.productStatus == 3) {
                        sql_get_pagination = `SELECT COUNT(*) AS numRows FROM inventory_product_data AS p
                                                ${sql_querry_joins}
                                                WHERE p.productCategoryId = '${data.productCategory}' AND COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) = 0`;
                    } else if (req.query.startDate && req.query.endDate && req.query.searchProduct) {
                        sql_get_pagination = `SELECT COUNT(*) AS numRows FROM inventory_product_data AS p
                                        ${sql_querry_joins}
                                        LEFT JOIN(
                                            SELECT
                                                inventory_stockIn_data.productId,
                                                ROUND(SUM(
                                                    inventory_stockIn_data.productQty
                                                ),2) AS total_quantity,
                                                ROUND(SUM(
                                                    inventory_stockIn_data.totalPrice
                                                )) AS totalExpense
                                            FROM
                                                inventory_stockIn_data
                                            WHERE
                                                inventory_stockIn_data.branchId = '${branchId}' AND inventory_stockIn_data.stockInDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')
                                            GROUP BY
                                                inventory_stockIn_data.productId
                                        ) AS simw
                                        ON
                                            p.productId = simw.productId
                                        LEFT JOIN(
                                            SELECT
                                                inventory_stockOut_data.productId,
                                                ROUND(SUM(
                                                    inventory_stockOut_data.productQty
                                                ),2) AS total_quantity
                                            FROM
                                                inventory_stockOut_data
                                            WHERE
                                                inventory_stockOut_data.branchId = '${branchId}' AND inventory_stockOut_data.stockOutDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')
                                            GROUP BY
                                                inventory_stockOut_data.productId
                                        ) AS somw
                                        ON
                                            p.productId = somw.productId
                                        WHERE p.productCategoryId = '${data.productCategory}' AND p.productName LIKE '%` + data.searchProduct + `%'`;
                    } else if (req.query.startDate && req.query.endDate) {
                        sql_get_pagination = `SELECT COUNT(*) AS numRows FROM inventory_product_data AS p
                                        ${sql_querry_joins}
                                        LEFT JOIN(
                                            SELECT
                                                inventory_stockIn_data.productId,
                                                ROUND(SUM(
                                                    inventory_stockIn_data.productQty
                                                ),2) AS total_quantity,
                                                ROUND(SUM(
                                                    inventory_stockIn_data.totalPrice
                                                )) AS totalExpense
                                            FROM
                                                inventory_stockIn_data
                                            WHERE
                                                inventory_stockIn_data.branchId = '${branchId}' AND inventory_stockIn_data.stockInDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')
                                            GROUP BY
                                                inventory_stockIn_data.productId
                                        ) AS simw
                                        ON
                                            p.productId = simw.productId
                                        LEFT JOIN(
                                            SELECT
                                                inventory_stockOut_data.productId,
                                                ROUND(SUM(
                                                    inventory_stockOut_data.productQty
                                                ),2) AS total_quantity
                                            FROM
                                                inventory_stockOut_data
                                            WHERE
                                                inventory_stockOut_data.branchId = '${branchId}' AND inventory_stockOut_data.stockOutDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')
                                            GROUP BY
                                                inventory_stockOut_data.productId
                                        ) AS somw
                                        ON
                                            p.productId = somw.productId
                                        WHERE p.productCategoryId = '${data.productCategory}'`;
                    } else if (req.query.searchProduct) {
                        sql_get_pagination = `SELECT COUNT(*) AS numRows FROM inventory_product_data AS p
                                        ${sql_querry_joins}
                                        LEFT JOIN(
                                            SELECT
                                                inventory_stockIn_data.productId,
                                                ROUND(SUM(
                                                    inventory_stockIn_data.productQty
                                                ),2) AS total_quantity,
                                                ROUND(SUM(
                                                    inventory_stockIn_data.totalPrice
                                                )) AS totalExpense
                                            FROM
                                                inventory_stockIn_data
                                            WHERE
                                                inventory_stockIn_data.branchId = '${branchId}' AND inventory_stockIn_data.stockInDate BETWEEN STR_TO_DATE('${firstDay}','%b %d %Y') AND STR_TO_DATE('${lastDay}','%b %d %Y')
                                            GROUP BY
                                                inventory_stockIn_data.productId
                                        ) AS simw
                                        ON
                                            p.productId = simw.productId
                                        LEFT JOIN(
                                            SELECT
                                                inventory_stockOut_data.productId,
                                                ROUND(SUM(
                                                    inventory_stockOut_data.productQty
                                                ),2) AS total_quantity
                                            FROM
                                                inventory_stockOut_data
                                            WHERE
                                                inventory_stockOut_data.branchId = '${branchId}' AND inventory_stockOut_data.stockOutDate BETWEEN STR_TO_DATE('${firstDay}','%b %d %Y') AND STR_TO_DATE('${lastDay}','%b %d %Y')
                                            GROUP BY
                                                inventory_stockOut_data.productId
                                        ) AS somw
                                        ON
                                            p.productId = somw.productId
                                        WHERE p.productCategoryId = '${data.productCategory}' AND p.productName LIKE '%` + data.searchProduct + `%'`;
                    } else {
                        sql_get_pagination = `SELECT COUNT(*) AS numRows
                                        FROM
                                        inventory_product_data AS p
                                        ${sql_querry_joins}
                                        LEFT JOIN(
                                            SELECT
                                                inventory_stockIn_data.productId,
                                                ROUND(SUM(
                                                    inventory_stockIn_data.productQty
                                                ),2) AS total_quantity,
                                                ROUND(SUM(
                                                    inventory_stockIn_data.totalPrice
                                                )) AS totalExpense
                                            FROM
                                                inventory_stockIn_data
                                            WHERE
                                                inventory_stockIn_data.branchId = '${branchId}' AND inventory_stockIn_data.stockInDate BETWEEN STR_TO_DATE('${firstDay}','%b %d %Y') AND STR_TO_DATE('${lastDay}','%b %d %Y')
                                            GROUP BY
                                                inventory_stockIn_data.productId
                                        ) AS simw
                                        ON
                                            p.productId = simw.productId
                                        LEFT JOIN(
                                            SELECT
                                                inventory_stockOut_data.productId,
                                                ROUND(SUM(
                                                    inventory_stockOut_data.productQty
                                                ),2) AS total_quantity
                                            FROM
                                                inventory_stockOut_data
                                            WHERE
                                                inventory_stockOut_data.branchId = '${branchId}' AND inventory_stockOut_data.stockOutDate BETWEEN STR_TO_DATE('${firstDay}','%b %d %Y') AND STR_TO_DATE('${lastDay}','%b %d %Y')
                                            GROUP BY
                                                inventory_stockOut_data.productId
                                        ) AS somw
                                        ON
                                            p.productId = somw.productId
                                        WHERE p.productCategoryId = '${data.productCategory}'`;
                    }
                } else {
                    if (req.query.productStatus == 1) {
                        sql_get_pagination = `SELECT COUNT(*) AS numRows FROM inventory_product_data AS p
                                        ${sql_querry_joins}
                                        WHERE COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) >= p.minProductQty`;
                    } else if (req.query.productStatus == 2) {
                        sql_get_pagination = `SELECT COUNT(*) AS numRows FROM inventory_product_data AS p
                                        ${sql_querry_joins}
                                        WHERE COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) < p.minProductQty AND COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) != 0`;
                    } else if (req.query.productStatus == 3) {
                        sql_get_pagination = `SELECT COUNT(*) AS numRows FROM inventory_product_data AS p
                                        ${sql_querry_joins}
                                        WHERE COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) = 0`;
                    } else if (req.query.startDate && req.query.endDate && req.query.searchProduct) {
                        sql_get_pagination = `SELECT COUNT(*) AS numRows FROM inventory_product_data AS p
                                        ${sql_querry_joins}
                                        LEFT JOIN(
                                            SELECT
                                                inventory_stockIn_data.productId,
                                                ROUND(SUM(
                                                    inventory_stockIn_data.productQty
                                                ),2) AS total_quantity,
                                                ROUND(SUM(
                                                    inventory_stockIn_data.totalPrice
                                                )) AS totalExpense
                                            FROM
                                                inventory_stockIn_data
                                            WHERE
                                                inventory_stockIn_data.branchId = '${branchId}' AND inventory_stockIn_data.stockInDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')
                                            GROUP BY
                                                inventory_stockIn_data.productId
                                        ) AS simw
                                        ON
                                            p.productId = simw.productId
                                        LEFT JOIN(
                                            SELECT
                                                inventory_stockOut_data.productId,
                                                ROUND(SUM(
                                                    inventory_stockOut_data.productQty
                                                ),2) AS total_quantity
                                            FROM
                                                inventory_stockOut_data
                                            WHERE
                                                inventory_stockOut_data.branchId = '${branchId}' AND inventory_stockOut_data.stockOutDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')
                                            GROUP BY
                                                inventory_stockOut_data.productId
                                        ) AS somw
                                        ON
                                            p.productId = somw.productId
                                        WHERE p.productName LIKE '%` + data.searchProduct + `%'`;
                    } else if (req.query.startDate && req.query.endDate) {
                        sql_get_pagination = `SELECT COUNT(*) AS numRows FROM inventory_product_data AS p
                                        ${sql_querry_joins}
                                        LEFT JOIN(
                                            SELECT
                                                inventory_stockIn_data.productId,
                                                ROUND(SUM(
                                                    inventory_stockIn_data.productQty
                                                ),2) AS total_quantity,
                                                ROUND(SUM(
                                                    inventory_stockIn_data.totalPrice
                                                )) AS totalExpense
                                            FROM
                                                inventory_stockIn_data
                                            WHERE
                                                inventory_stockIn_data.branchId = '${branchId}' AND inventory_stockIn_data.stockInDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')
                                            GROUP BY
                                                inventory_stockIn_data.productId
                                        ) AS simw
                                        ON
                                            p.productId = simw.productId
                                        LEFT JOIN(
                                            SELECT
                                                inventory_stockOut_data.productId,
                                                ROUND(SUM(
                                                    inventory_stockOut_data.productQty
                                                ),2) AS total_quantity
                                            FROM
                                                inventory_stockOut_data
                                            WHERE
                                                inventory_stockOut_data.branchId = '${branchId}' AND inventory_stockOut_data.stockOutDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')
                                            GROUP BY
                                                inventory_stockOut_data.productId
                                        ) AS somw
                                        ON
                                            p.productId = somw.productId`;
                    } else if (req.query.searchProduct) {
                        sql_get_pagination = `SELECT COUNT(*) AS numRows FROM inventory_product_data AS p
                                        ${sql_querry_joins}
                                        LEFT JOIN(
                                            SELECT
                                                inventory_stockIn_data.productId,
                                                ROUND(SUM(
                                                    inventory_stockIn_data.productQty
                                                ),2) AS total_quantity,
                                                ROUND(SUM(
                                                    inventory_stockIn_data.totalPrice
                                                )) AS totalExpense
                                            FROM
                                                inventory_stockIn_data
                                            WHERE
                                                inventory_stockIn_data.branchId = '${branchId}' AND inventory_stockIn_data.stockInDate BETWEEN STR_TO_DATE('${firstDay}','%b %d %Y') AND STR_TO_DATE('${lastDay}','%b %d %Y')
                                            GROUP BY
                                                inventory_stockIn_data.productId
                                        ) AS simw
                                        ON
                                            p.productId = simw.productId
                                        LEFT JOIN(
                                            SELECT
                                                inventory_stockOut_data.productId,
                                                ROUND(SUM(
                                                    inventory_stockOut_data.productQty
                                                ),2) AS total_quantity
                                            FROM
                                                inventory_stockOut_data
                                            WHERE
                                                inventory_stockOut_data.branchId = '${branchId}' AND inventory_stockOut_data.stockOutDate BETWEEN STR_TO_DATE('${firstDay}','%b %d %Y') AND STR_TO_DATE('${lastDay}','%b %d %Y')
                                            GROUP BY
                                                inventory_stockOut_data.productId
                                        ) AS somw
                                        ON
                                            p.productId = somw.productId
                                        WHERE p.productName LIKE '%` + data.searchProduct + `%'`;
                    } else {
                        sql_get_pagination = `SELECT COUNT(*) AS numRows
                                        FROM
                                        inventory_product_data AS p
                                        ${sql_querry_joins}
                                        LEFT JOIN(
                                            SELECT
                                                inventory_stockIn_data.productId,
                                                ROUND(SUM(
                                                    inventory_stockIn_data.productQty
                                                ),2) AS total_quantity,
                                                ROUND(SUM(
                                                    inventory_stockIn_data.totalPrice
                                                )) AS totalExpense
                                            FROM
                                                inventory_stockIn_data
                                            WHERE
                                                inventory_stockIn_data.branchId = '${branchId}' AND inventory_stockIn_data.stockInDate BETWEEN STR_TO_DATE('${firstDay}','%b %d %Y') AND STR_TO_DATE('${lastDay}','%b %d %Y')
                                            GROUP BY
                                                inventory_stockIn_data.productId
                                        ) AS simw
                                        ON
                                            p.productId = simw.productId
                                        LEFT JOIN(
                                            SELECT
                                                inventory_stockOut_data.productId,
                                                ROUND(SUM(
                                                    inventory_stockOut_data.productQty
                                                ),2) AS total_quantity
                                            FROM
                                                inventory_stockOut_data
                                            WHERE
                                                inventory_stockOut_data.branchId = '${branchId}' AND inventory_stockOut_data.stockOutDate BETWEEN STR_TO_DATE('${firstDay}','%b %d %Y') AND STR_TO_DATE('${lastDay}','%b %d %Y')
                                            GROUP BY
                                                inventory_stockOut_data.productId
                                        ) AS somw
                                        ON
                                            p.productId = somw.productId`;
                    }
                }
                pool.query(sql_get_pagination, (err, rows, fields) => {
                    if (err) {
                        console.error("An error occurd in SQL Queery", err);
                        return res.status(500).send('Database Error');
                    } else {
                        const numRows = rows[0].numRows;
                        const numPages = Math.ceil(numRows / numPerPage);
                        if (req.query.productCategory) {
                            if (req.query.productStatus == 1) {
                                sql_queries_getdetails = `${sql_querry_staticQuery}
                                                WHERE p.productCategoryId = '${data.productCategory}' AND COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) >= p.minProductQty 
                                                ORDER BY p.productName LIMIT ${limit}`;
                            } else if (req.query.productStatus == 2) {
                                sql_queries_getdetails = `${sql_querry_staticQuery}
                                                WHERE p.productCategoryId = '${data.productCategory}' AND COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) < p.minProductQty AND COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) != 0
                                                ORDER BY p.productName LIMIT ${limit}`;
                            } else if (req.query.productStatus == 3) {
                                sql_queries_getdetails = `${sql_querry_staticQuery}
                                                WHERE p.productCategoryId = '${data.productCategory}' AND COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) = 0
                                                ORDER BY p.productName LIMIT ${limit}`;
                            } else if (req.query.startDate && req.query.endDate && req.query.searchProduct) {
                                sql_queries_getdetails = `${sql_querry_getMwSiSO}
                                              LEFT JOIN(
                                                SELECT
                                                    inventory_stockIn_data.productId,
                                                    ROUND(SUM(
                                                        inventory_stockIn_data.productQty
                                                    ),2) AS total_quantity,
                                                    ROUND(SUM(
                                                        inventory_stockIn_data.totalPrice
                                                    )) AS totalExpense
                                                FROM
                                                    inventory_stockIn_data
                                                WHERE
                                                    inventory_stockIn_data.branchId = '${branchId}' AND inventory_stockIn_data.stockInDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')
                                                GROUP BY
                                                    inventory_stockIn_data.productId
                                            ) AS simw
                                            ON
                                            p.productId = simw.productId
                                        LEFT JOIN(
                                            SELECT
                                                inventory_stockOut_data.productId,
                                                ROUND(SUM(
                                                    inventory_stockOut_data.productQty
                                                ),2) AS total_quantity,
                                                ROUND(SUM(
                                                    inventory_stockOut_data.stockOutPrice
                                                )) AS totalStockOutPrice
                                            FROM
                                                inventory_stockOut_data
                                            WHERE
                                                inventory_stockOut_data.branchId = '${branchId}' AND inventory_stockOut_data.stockOutDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')
                                            GROUP BY
                                                inventory_stockOut_data.productId
                                        ) AS somw
                                        ON
                                        p.productId = somw.productId 
                                        WHERE p.productCategoryId = '${data.productCategory}' AND p.productName LIKE '%` + data.searchProduct + `%'
                                        ORDER BY p.productName LIMIT ${limit}`
                            } else if (req.query.startDate && req.query.endDate) {
                                sql_queries_getdetails = `${sql_querry_getMwSiSO}
                                              LEFT JOIN(
                                                SELECT
                                                    inventory_stockIn_data.productId,
                                                    ROUND(SUM(
                                                        inventory_stockIn_data.productQty
                                                    ),2) AS total_quantity,
                                                    ROUND(SUM(
                                                        inventory_stockIn_data.totalPrice
                                                    )) AS totalExpense
                                                FROM
                                                    inventory_stockIn_data
                                                WHERE
                                                 inventory_stockIn_data.branchId = '${branchId}' AND inventory_stockIn_data.stockInDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')
                                                GROUP BY
                                                    inventory_stockIn_data.productId
                                            ) AS simw
                                            ON
                                            p.productId = simw.productId
                                        LEFT JOIN(
                                            SELECT
                                                inventory_stockOut_data.productId,
                                                ROUND(SUM(
                                                    inventory_stockOut_data.productQty
                                                ),2) AS total_quantity,
                                                ROUND(SUM(
                                                        inventory_stockOut_data.stockOutPrice
                                                )) AS totalStockOutPrice
                                            FROM
                                                inventory_stockOut_data
                                            WHERE
                                               inventory_stockOut_data.branchId = '${branchId}' AND inventory_stockOut_data.stockOutDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')
                                            GROUP BY
                                                inventory_stockOut_data.productId
                                        ) AS somw
                                        ON
                                        p.productId = somw.productId
                                        WHERE p.productCategoryId = '${data.productCategory}'
                                        ORDER BY p.productName LIMIT ${limit}`
                            } else if (req.query.searchProduct) {
                                sql_queries_getdetails = `${sql_querry_getMwSiSO}
                                              LEFT JOIN(
                                                SELECT
                                                    inventory_stockIn_data.productId,
                                                    ROUND(SUM(
                                                        inventory_stockIn_data.productQty
                                                    ),2) AS total_quantity,
                                                    ROUND(SUM(
                                                        inventory_stockIn_data.totalPrice
                                                    )) AS totalExpense
                                                FROM
                                                    inventory_stockIn_data
                                                WHERE
                                                    inventory_stockIn_data.branchId = '${branchId}' AND inventory_stockIn_data.stockInDate BETWEEN STR_TO_DATE('${firstDay}','%b %d %Y') AND STR_TO_DATE('${lastDay}','%b %d %Y')
                                                GROUP BY
                                                    inventory_stockIn_data.productId
                                            ) AS simw
                                            ON
                                            p.productId = simw.productId
                                        LEFT JOIN(
                                            SELECT
                                                inventory_stockOut_data.productId,
                                                ROUND(SUM(
                                                    inventory_stockOut_data.productQty
                                                ),2) AS total_quantity,
                                                ROUND(SUM(
                                                    inventory_stockOut_data.stockOutPrice
                                                )) AS totalStockOutPrice
                                            FROM
                                                inventory_stockOut_data
                                            WHERE
                                                inventory_stockOut_data.branchId = '${branchId}' AND inventory_stockOut_data.stockOutDate BETWEEN STR_TO_DATE('${firstDay}','%b %d %Y') AND STR_TO_DATE('${lastDay}','%b %d %Y')
                                            GROUP BY
                                                inventory_stockOut_data.productId
                                        ) AS somw
                                        ON
                                        p.productId = somw.productId
                                        WHERE p.productCategoryId = '${data.productCategory}' AND p.productName LIKE '%` + data.searchProduct + `%'
                                        ORDER BY p.productName LIMIT ${limit}`
                            } else {
                                sql_queries_getdetails = `${sql_querry_getMwSiSO}
                                              LEFT JOIN(
                                                SELECT
                                                    inventory_stockIn_data.productId,
                                                    ROUND(SUM(
                                                        inventory_stockIn_data.productQty
                                                    ),2) AS total_quantity,
                                                    ROUND(SUM(
                                                        inventory_stockIn_data.totalPrice
                                                    )) AS totalExpense
                                                FROM
                                                    inventory_stockIn_data
                                                WHERE
                                                    inventory_stockIn_data.branchId = '${branchId}' AND inventory_stockIn_data.stockInDate BETWEEN STR_TO_DATE('${firstDay}','%b %d %Y') AND STR_TO_DATE('${lastDay}','%b %d %Y')
                                                GROUP BY
                                                    inventory_stockIn_data.productId
                                            ) AS simw
                                            ON
                                            p.productId = simw.productId
                                        LEFT JOIN(
                                            SELECT
                                                inventory_stockOut_data.productId,
                                                ROUND(SUM(
                                                    inventory_stockOut_data.productQty
                                                ),2) AS total_quantity,
                                                ROUND(SUM(
                                                    inventory_stockOut_data.stockOutPrice
                                                )) AS totalStockOutPrice
                                            FROM
                                                inventory_stockOut_data
                                            WHERE
                                                inventory_stockOut_data.branchId = '${branchId}' AND inventory_stockOut_data.stockOutDate BETWEEN STR_TO_DATE('${firstDay}','%b %d %Y') AND STR_TO_DATE('${lastDay}','%b %d %Y')
                                            GROUP BY
                                                inventory_stockOut_data.productId
                                        ) AS somw
                                        ON
                                        p.productId = somw.productId
                                        WHERE p.productCategoryId = '${data.productCategory}'
                                        ORDER BY p.productName LIMIT ${limit}`
                            }
                        } else {
                            if (req.query.productStatus == 1) {
                                sql_queries_getdetails = `${sql_querry_staticQuery}
                                                WHERE COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) >= p.minProductQty 
                                                ORDER BY p.productName LIMIT ${limit}`;
                            } else if (req.query.productStatus == 2) {
                                sql_queries_getdetails = `${sql_querry_staticQuery}
                                                WHERE COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) < p.minProductQty AND COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) != 0
                                                ORDER BY p.productName LIMIT ${limit}`;
                            } else if (req.query.productStatus == 3) {
                                sql_queries_getdetails = `${sql_querry_staticQuery}
                                                WHERE COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) = 0
                                                ORDER BY p.productName LIMIT ${limit}`;
                            } else if (req.query.startDate && req.query.endDate && req.query.searchProduct) {
                                sql_queries_getdetails = `${sql_querry_getMwSiSO}
                                              LEFT JOIN(
                                                SELECT
                                                    inventory_stockIn_data.productId,
                                                    ROUND(SUM(
                                                        inventory_stockIn_data.productQty
                                                    ),2) AS total_quantity,
                                                    ROUND(SUM(
                                                        inventory_stockIn_data.totalPrice
                                                    )) AS totalExpense
                                                FROM
                                                    inventory_stockIn_data
                                                WHERE
                                                    inventory_stockIn_data.branchId = '${branchId}' AND inventory_stockIn_data.stockInDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')
                                                GROUP BY
                                                    inventory_stockIn_data.productId
                                            ) AS simw
                                            ON
                                            p.productId = simw.productId
                                        LEFT JOIN(
                                            SELECT
                                                inventory_stockOut_data.productId,
                                                ROUND(SUM(
                                                    inventory_stockOut_data.productQty
                                                ),2) AS total_quantity,
                                                ROUND(SUM(
                                                    inventory_stockOut_data.stockOutPrice
                                                )) AS totalStockOutPrice
                                            FROM
                                                inventory_stockOut_data
                                            WHERE
                                                inventory_stockOut_data.branchId = '${branchId}' AND inventory_stockOut_data.stockOutDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')
                                            GROUP BY
                                                inventory_stockOut_data.productId
                                        ) AS somw
                                        ON
                                        p.productId = somw.productId 
                                        WHERE p.productName LIKE '%` + data.searchProduct + `%'
                                        ORDER BY p.productName LIMIT ${limit}`
                            } else if (req.query.startDate && req.query.endDate) {
                                sql_queries_getdetails = `${sql_querry_getMwSiSO}
                                              LEFT JOIN(
                                                SELECT
                                                    inventory_stockIn_data.productId,
                                                    ROUND(SUM(
                                                        inventory_stockIn_data.productQty
                                                    ),2) AS total_quantity,
                                                    ROUND(SUM(
                                                        inventory_stockIn_data.totalPrice
                                                    )) AS totalExpense
                                                FROM
                                                    inventory_stockIn_data
                                                WHERE
                                                 inventory_stockIn_data.branchId = '${branchId}' AND inventory_stockIn_data.stockInDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')
                                                GROUP BY
                                                    inventory_stockIn_data.productId
                                            ) AS simw
                                            ON
                                            p.productId = simw.productId
                                        LEFT JOIN(
                                            SELECT
                                                inventory_stockOut_data.productId,
                                                ROUND(SUM(
                                                    inventory_stockOut_data.productQty
                                                ),2) AS total_quantity,
                                                ROUND(SUM(
                                                        inventory_stockOut_data.stockOutPrice
                                                )) AS totalStockOutPrice
                                            FROM
                                                inventory_stockOut_data
                                            WHERE
                                               inventory_stockOut_data.branchId = '${branchId}' AND inventory_stockOut_data.stockOutDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')
                                            GROUP BY
                                                inventory_stockOut_data.productId
                                        ) AS somw
                                        ON
                                        p.productId = somw.productId
                                        ORDER BY p.productName LIMIT ${limit}`
                            } else if (req.query.searchProduct) {
                                sql_queries_getdetails = `${sql_querry_getMwSiSO}
                                              LEFT JOIN(
                                                SELECT
                                                    inventory_stockIn_data.productId,
                                                    ROUND(SUM(
                                                        inventory_stockIn_data.productQty
                                                    ),2) AS total_quantity,
                                                    ROUND(SUM(
                                                        inventory_stockIn_data.totalPrice
                                                    )) AS totalExpense
                                                FROM
                                                    inventory_stockIn_data
                                                WHERE
                                                    inventory_stockIn_data.branchId = '${branchId}' AND inventory_stockIn_data.stockInDate BETWEEN STR_TO_DATE('${firstDay}','%b %d %Y') AND STR_TO_DATE('${lastDay}','%b %d %Y')
                                                GROUP BY
                                                    inventory_stockIn_data.productId
                                            ) AS simw
                                            ON
                                            p.productId = simw.productId
                                        LEFT JOIN(
                                            SELECT
                                                inventory_stockOut_data.productId,
                                                ROUND(SUM(
                                                    inventory_stockOut_data.productQty
                                                ),2) AS total_quantity,
                                                ROUND(SUM(
                                                    inventory_stockOut_data.stockOutPrice
                                                )) AS totalStockOutPrice
                                            FROM
                                                inventory_stockOut_data
                                            WHERE
                                                inventory_stockOut_data.branchId = '${branchId}' AND inventory_stockOut_data.stockOutDate BETWEEN STR_TO_DATE('${firstDay}','%b %d %Y') AND STR_TO_DATE('${lastDay}','%b %d %Y')
                                            GROUP BY
                                                inventory_stockOut_data.productId
                                        ) AS somw
                                        ON
                                        p.productId = somw.productId
                                        WHERE p.productName LIKE '%` + data.searchProduct + `%'
                                        ORDER BY p.productName LIMIT ${limit}`
                            } else {
                                sql_queries_getdetails = `${sql_querry_getMwSiSO}
                                              LEFT JOIN(
                                                SELECT
                                                    inventory_stockIn_data.productId,
                                                    ROUND(SUM(
                                                        inventory_stockIn_data.productQty
                                                    ),2) AS total_quantity,
                                                    ROUND(SUM(
                                                        inventory_stockIn_data.totalPrice
                                                    )) AS totalExpense
                                                FROM
                                                    inventory_stockIn_data
                                                WHERE
                                                    inventory_stockIn_data.branchId = '${branchId}' AND inventory_stockIn_data.stockInDate BETWEEN STR_TO_DATE('${firstDay}','%b %d %Y') AND STR_TO_DATE('${lastDay}','%b %d %Y')
                                                GROUP BY
                                                    inventory_stockIn_data.productId
                                            ) AS simw
                                            ON
                                            p.productId = simw.productId
                                        LEFT JOIN(
                                            SELECT
                                                inventory_stockOut_data.productId,
                                                ROUND(SUM(
                                                    inventory_stockOut_data.productQty
                                                ),2) AS total_quantity,
                                                ROUND(SUM(
                                                    inventory_stockOut_data.stockOutPrice
                                                )) AS totalStockOutPrice
                                            FROM
                                                inventory_stockOut_data
                                            WHERE
                                                inventory_stockOut_data.branchId = '${branchId}' AND inventory_stockOut_data.stockOutDate BETWEEN STR_TO_DATE('${firstDay}','%b %d %Y') AND STR_TO_DATE('${lastDay}','%b %d %Y')
                                            GROUP BY
                                                inventory_stockOut_data.productId
                                        ) AS somw
                                        ON
                                        p.productId = somw.productId
                                        ORDER BY p.productName LIMIT ${limit}`
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
                                            const rows = datas ? datas.map((element, index) => data[index] && data[index].convertedQuantity ? { ...element, remainingStock: data[index].convertedQuantity, allConversation: data[index].vikJson } : { ...element, remainingStock: element.remainingStock + ' ' + element.minProductUnit, allConversation: data[index].vikJson },
                                                // console.log(data[index] && data[index].convertedQuantity)
                                            ) : []
                                            let newData = [];
                                            Promise.all(
                                                rows ? rows.map(async (element, index) => {
                                                    let newElement = element;
                                                    return await newConversationAsync(element.purchese, element.productId, element.minProductUnit)
                                                        .then(async (res) => {
                                                            newElement = { ...newElement, purchese: res }
                                                            return await newConversationAsync(element.totalUsed, element.productId, element.minProductUnit)
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
                return res.status(401).send("BranchId Not Found");
            }
        } else {
            return res.status(401).send("Please Login Firest.....!");
        }
    } catch (error) {
        console.error('An error occurd', error);
        res.status(500).send('Internal Server Error');
    }
}

// Remove Product API

const removeProduct = async (req, res) => {
    try {
        let token;
        token = req.headers ? req.headers.authorization.split(" ")[1] : null;
        if (token) {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const factoryId = process.env.RAJ_MANDIR_FACTORY_ID;
            const userRights = decoded.id.rights;
            console.log(userRights, userRights == 1, 'fdfsaf');
            if (userRights == 1) {
                var productId = req.query.productId.trim();
                req.query.productId = pool.query(`SELECT productId FROM inventory_product_data WHERE productId = '${productId}';
                                                  SELECT productId FROM inventory_supplierProducts_data WHERE supplierId = '${factoryId}' AND productId = '${productId}'`, (err, row) => {
                    if (err) {
                        console.error("An error occurd in SQL Queery", err);
                        return res.status(500).send('Database Error');
                    }
                    if (row && row[0].length) {
                        if (row && row[1].length) {
                            return res.status(400).send('You Can Not Delete Factory Product');
                        } else {
                            const sql_querry_removedetails = `DELETE FROM inventory_product_data WHERE productId = '${productId}'`;
                            pool.query(sql_querry_removedetails, (err, data) => {
                                if (err) {
                                    console.error("An error occurd in SQL Queery", err);
                                    return res.status(500).send('Database Error');
                                }
                                return res.status(200).send("Product Deleted Successfully");
                            })
                        }
                    } else {
                        return res.send('ProductId Not Found');
                    }
                })
            } else {
                return res.status(400).send("You Are Not Authorised...!");
            }
        } else {
            res.status(401).send("Please Login Firest.....!");
        }
    } catch (error) {
        console.error('An error occurd', error);
        res.status(500).send('Internal Server Error');
    }
}

// Update Product API

const updateProduct = async (req, res) => {
    try {
        let token;
        token = req.headers ? req.headers.authorization.split(" ")[1] : null;
        if (token) {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const factoryId = process.env.RAJ_MANDIR_FACTORY_ID;
            const userRights = decoded.id.rights;
            console.log(userRights, userRights == 1, 'fdfsaf');
            if (userRights == 1) {
                const productId = req.body.productId;
                const priorityArray = req.body.priorityArray;
                const data = {
                    productCategoryId: req.body.productCategoryId,
                    productName: req.body.productName.trim(),
                    gujaratiProductName: req.body.gujaratiProductName,
                    minProductQty: req.body.minProductQty,
                    minProductUnit: req.body.minProductUnit.trim(),
                    leadTime: req.body.leadTime ? req.body.leadTime : 0,
                    isExpired: req.body.isExpired,
                    expiredDays: req.body.expiredDays ? req.body.expiredDays : 0
                }
                if (!productId || !data.productName || !data.minProductQty || !data.minProductUnit) {
                    return res.status(400).send("Please Fill All The Fields");
                }
                const sql_querry_updatedetails = `UPDATE inventory_product_data SET 
                                                      productCategoryId = '${data.productCategoryId}',
                                                      productName = '${data.productName}',
                                                      gujaratiProductName = ${data.gujaratiProductName ? `'${data.gujaratiProductName}'` : null},
                                                      minProductQty = ${data.minProductQty},
                                                      minProductUnit = '${data.minProductUnit}',
                                                      leadTime = ${data.leadTime},
                                                      isExpired = ${data.isExpired},
                                                      expiredDays = ${data.isExpired ? `${data.expiredDays}` : 0}
                                                  WHERE productId = '${productId}'`;
                pool.query(sql_querry_updatedetails, (err, data) => {
                    if (err) {
                        console.error("An error occurd in SQL Queery", err);
                        return res.status(500).send('Database Error');
                    }
                    sql_querry_removePriorityArray = `DELETE FROM product_unit_preference WHERE productId = '${productId}'`;
                    pool.query(sql_querry_removePriorityArray, (err, result) => {
                        if (err) {
                            console.error("An error occurd in SQL Queery", err);
                            return res.status(500).send('Database Error');
                        }
                        if (priorityArray.length != 0 && priorityArray) {
                            let addPriorityData = priorityArray.map((item, index) => {
                                let uniqueId = `PriorityId_${Date.now() + index}`; // Generating a unique ID using current timestamp
                                let priorityNumber = index + 1; // Define Priority Number
                                return `('${uniqueId}', '${productId}', ${priorityNumber}, '${item.bigUnitName}', ${item.unitNumber}, '${item.smallUnitName}')`;
                            }).join(', ');
                            console.log(addPriorityData);
                            const sql_querry_addPriority = `INSERT INTO product_unit_preference (preferenceId, productId, priorityNumber, bigUnitName, unitNumber, smallUnitName)
                                                    VALUES ${addPriorityData}`;
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
                return res.status(400).send("You Are Not Authorised...!");
            }
        } else {
            res.status(401).send("Please Login Firest.....!");
        }
    } catch (error) {
        console.error('An error occurd', error);
        res.status(500).send('Internal Server Error');
    }
}

// Get Product Details By Id

const getProductDetailsById = (req, res) => {
    try {
        const productId = req.query.productId;
        if (!productId) {
            return res.status(404).send('ProductId Not Found');
        }
        sql_queries_getdetails = `SELECT productId, productCategoryId, productName, gujaratiProductName, minProductQty, minProductUnit, leadTime, isExpired, expiredDays FROM inventory_product_data WHERE productId = '${productId}';
                                  SELECT priorityNumber, bigUnitName, unitNumber, smallUnitName FROM product_unit_preference WHERE productId = '${productId}'`;
        pool.query(sql_queries_getdetails, (err, data) => {
            if (err) {
                console.error("An error occurd in SQL Queery", err);
                return res.status(500).send('Database Error');
            }
            const unitNames = data[1].map(item => item.bigUnitName);
            unitNames.splice(0, 0, data[0][0].minProductUnit);
            const mergedObject = {
                ...data[0][0], // Copy the first object as it contains the product information
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

const getCategoryWiseUsedByProduct = (req, res) => {
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

                const data = {
                    startDate: (req.query.startDate ? req.query.startDate : '').slice(4, 15),
                    endDate: (req.query.endDate ? req.query.endDate : '').slice(4, 15),
                    productId: req.query.productId
                }
                if (req.query.startDate && req.query.endDate) {
                    sql_queries_getCategoryUsed = `SELECT
                                                        iscd.stockOutCategoryName,
                                                        ipd.productId,
                                                        ipd.minProductUnit,
                                                        COALESCE(so.usedQty, 0) AS remainingStock,
                                                        COALESCE(so.usedPrice,0) AS usedPrice
                                                    FROM
                                                        inventory_stockOutCategory_data AS iscd
                                                    LEFT JOIN(
                                                        SELECT
                                                            inventory_stockOut_data.stockOutCategory,
                                                            ROUND(SUM(
                                                                inventory_stockOut_data.productQty
                                                            ),2) AS usedQty,
                                                            ROUND(SUM(
                                                                inventory_stockOut_data.stockOutPrice
                                                            )) AS usedPrice
                                                        FROM
                                                            inventory_stockOut_data
                                                        WHERE
                                                            inventory_stockOut_data.branchId = '${branchId}' AND inventory_stockOut_data.productId = '${data.productId}' AND inventory_stockOut_data.stockOutDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')
                                                        GROUP BY
                                                            inventory_stockOut_data.stockOutCategory
                                                    ) AS so
                                                    ON
                                                        iscd.stockOutCategoryId = so.stockOutCategory
                                                    LEFT JOIN inventory_product_data AS ipd ON ipd.productId = '${data.productId}'
                                                    ORDER BY so.usedQty DESC`;
                } else {
                    sql_queries_getCategoryUsed = `SELECT
                                                    iscd.stockOutCategoryName,
                                                    ipd.productId,
                                                    ipd.minProductUnit,
                                                    COALESCE(so.usedQty, 0) AS remainingStock,
                                                    COALESCE(so.usedPrice,0) AS usedPrice
                                                FROM
                                                    inventory_stockOutCategory_data AS iscd
                                                LEFT JOIN(
                                                    SELECT
                                                        inventory_stockOut_data.stockOutCategory,
                                                        ROUND(SUM(
                                                            inventory_stockOut_data.productQty
                                                        ),2) AS usedQty,
                                                        ROUND(SUM(
                                                            inventory_stockOut_data.stockOutPrice
                                                        )) AS usedPrice
                                                    FROM
                                                        inventory_stockOut_data
                                                    WHERE
                                                        inventory_stockOut_data.branchId = '${branchId}' AND inventory_stockOut_data.productId = '${data.productId}' AND inventory_stockOut_data.stockOutDate BETWEEN STR_TO_DATE('${firstDay}','%b %d %Y') AND STR_TO_DATE('${lastDay}','%b %d %Y')
                                                    GROUP BY
                                                        inventory_stockOut_data.stockOutCategory
                                                ) AS so
                                                ON
                                                  iscd.stockOutCategoryId = so.stockOutCategory
                                                LEFT JOIN inventory_product_data AS ipd ON ipd.productId = '${data.productId}'
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
                return res.status(401).send("BranchId Not Found");
            }
        } else {
            return res.status(401).send("Please Login Firest.....!");
        }
    } catch (error) {
        console.error('An error occurd', error);
        res.status(500).json('Internal Server Error');
    }
}

// Get Unit Conversation Details By Product Id

const getUnitPreferenceById = (req, res) => {
    try {
        const productId = req.query.productId;
        if (!productId) {
            return res.status(404), send('ProductId Not Found');
        }
        sql_get_preference = `SELECT
                                    bigUnitName AS largerUnit, unitNumber AS value, smallUnitName AS smallerUnit
                                FROM
                                    product_unit_preference AS pup
                                WHERE
                                    pup.productId = '${productId}'
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

// Export Excel Query for Product Table

const exportExcelSheetForProductTable = (req, res) => {
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
                productCategory: req.query.productCategory
            }
            const sql_querry_staticQuery = `SELECT
                                                p.productId,
                                                UCASE(p.productName) AS productName,
                                                gujaratiProductName AS gujProductName,
                                                CONCAT(p.minProductQty,' ',p.minProductUnit) AS minProductQty,
                                                p.minProductUnit,
                                                CONCAT(p.leadTime,' ','Day') AS leadTime,
                                                p.isExpired,
                                                CONCAT(p.expiredDays,' ','Day') AS expiredDays,
                                                COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) AS remainingStock,
                                                COALESCE(ROUND(siLu.productPrice,2), 0) AS lastPrice,
                                                COALESCE(siLu.productQty,'No In') AS lastUpdatedQty,
                                                COALESCE(siLu.totalPrice, 0) AS totalPrice,
                                                COALESCE(
                                                    DATE_FORMAT(siLu.stockInDate, '%d-%m-%Y'),
                                                    "No Update"
                                                ) AS lastUpdatedStockInDate,
                                                CASE WHEN COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) >= p.minProductQty THEN 'In-Stock' WHEN COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) < p.minProductQty AND COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) != 0 THEN 'Low-Stock' ELSE 'Out-Stock'
                                            END AS stockStatus
                                            FROM
                                                inventory_product_data AS p
                                            LEFT JOIN(
                                                SELECT
                                                    inventory_stockIn_data.productId,
                                                    ROUND(SUM(
                                                        inventory_stockIn_data.productQty
                                                    ),2) AS total_quantity
                                                FROM
                                                    inventory_stockIn_data
                                                WHERE branchId = '${branchId}'
                                                GROUP BY
                                                    inventory_stockIn_data.productId
                                            ) AS si
                                            ON
                                                p.productId = si.productId
                                            LEFT JOIN(
                                                SELECT
                                                    inventory_stockOut_data.productId,
                                                    ROUND(SUM(
                                                        inventory_stockOut_data.productQty
                                                    ),2) AS total_quantity
                                                FROM
                                                    inventory_stockOut_data
                                                WHERE branchId = '${branchId}'
                                                GROUP BY
                                                    inventory_stockOut_data.productId
                                            ) AS so
                                            ON
                                                p.productId = so.productId
                                            LEFT JOIN(
                                                SELECT
                                                    productId,
                                                    stockInDate,
                                                    COALESCE(CONCAT(stockInDisplayQty,' ',stockInDisplayUnit),'No IN') AS productQty,
                                                    productPrice,
                                                    totalPrice
                                                FROM
                                                    inventory_stockIn_data
                                                WHERE branchId = '${branchId}' AND
                                                    (productId, stockInCreationDate) IN(
                                                    SELECT
                                                        productId,
                                                        MAX(stockInCreationDate)
                                                    FROM
                                                        inventory_stockIn_data
                                                    GROUP BY
                                                        productId
                                                )
                                            ) AS siLu
                                            ON
                                                p.productId = siLu.productId`;
            const sql_querry_getMwSiSO = `SELECT
                                                p.productId,
                                                UCASE(p.productName) AS productName,
                                                gujaratiProductName AS gujProductName,
                                                CONCAT(p.minProductQty,' ',p.minProductUnit) AS minProductQty,
                                                p.minProductUnit,
                                                CONCAT(p.leadTime,' ','Day') AS leadTime,
                                                p.isExpired,
                                                CONCAT(p.expiredDays,' ','Day') AS expiredDays,
                                                COALESCE(simw.total_quantity, 0) AS purchese,
                                                COALESCE(somw.total_quantity, 0) AS totalUsed,
                                                COALESCE(simw.totalExpense,0) AS totalExpense,
                                                COALESCE(somw.totalStockOutPrice,0) AS totalStockOutPrice,
                                                COALESCE(si.total_siPrice, 0) - COALESCE(so.total_soPrice, 0) AS remainPrice,
                                                COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) AS remainingStock,
                                                COALESCE(ROUND(siLu.productPrice,2), 0) AS lastPrice,
                                                COALESCE(siLu.productQty,'No In') AS lastUpdatedQty,
                                                COALESCE(siLu.totalPrice, 0) AS totalPrice,
                                                COALESCE(
                                                    DATE_FORMAT(siLu.stockInDate, '%d-%m-%Y'),
                                                    "No Update"
                                                ) AS lastUpdatedStockInDate,
                                                CASE WHEN COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) >= p.minProductQty THEN 'In-Stock' WHEN COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) < p.minProductQty AND COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) != 0 THEN 'Low-Stock' ELSE 'Out-Stock'
                                            END AS stockStatus
                                            FROM
                                                inventory_product_data AS p
                                            LEFT JOIN(
                                                SELECT
                                                    inventory_stockIn_data.productId,
                                                    ROUND(SUM(
                                                        inventory_stockIn_data.productQty
                                                    ),2) AS total_quantity,
                                                    ROUND(SUM(
                                                        inventory_stockIn_data.totalPrice
                                                    ),2) AS total_siPrice
                                                FROM
                                                    inventory_stockIn_data
                                                WHERE branchId = '${branchId}'
                                                GROUP BY
                                                    inventory_stockIn_data.productId
                                            ) AS si
                                            ON
                                                p.productId = si.productId
                                            LEFT JOIN(
                                                SELECT
                                                    inventory_stockOut_data.productId,
                                                    ROUND(SUM(
                                                        inventory_stockOut_data.productQty
                                                    ),2) AS total_quantity,
                                                    ROUND(SUM(
                                                        inventory_stockOut_data.stockOutPrice
                                                    ),2) AS total_soPrice
                                                FROM
                                                    inventory_stockOut_data
                                                WHERE branchId = '${branchId}'
                                                GROUP BY
                                                    inventory_stockOut_data.productId
                                            ) AS so
                                            ON
                                                p.productId = so.productId
                                            LEFT JOIN(
                                                SELECT
                                                    productId,
                                                    stockInDate,
                                                    CONCAT(stockInDisplayQty,' ',stockInDisplayUnit) AS productQty,
                                                    productPrice,
                                                    totalPrice
                                                FROM
                                                    inventory_stockIn_data
                                                WHERE branchId = '${branchId}' AND
                                                    (productId, stockInCreationDate) IN(
                                                    SELECT
                                                        productId,
                                                        MAX(stockInCreationDate) As lastDate
                                                    FROM
                                                        inventory_stockIn_data
                                                    GROUP BY
                                                        productId
                                                )
                                            ) AS siLu
                                            ON
                                                p.productId = siLu.productId`;
            if (req.query.productCategory) {
                if (req.query.productStatus == 1) {
                    sql_queries_getdetails = `${sql_querry_staticQuery}
                                                WHERE p.productCategoryId = '${data.productCategory}' AND COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) >= p.minProductQty 
                                                ORDER BY p.productName`;
                } else if (req.query.productStatus == 2) {
                    sql_queries_getdetails = `${sql_querry_staticQuery}
                                                WHERE p.productCategoryId = '${data.productCategory}' AND COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) < p.minProductQty AND COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) != 0
                                                ORDER BY p.productName`;
                } else if (req.query.productStatus == 3) {
                    sql_queries_getdetails = `${sql_querry_staticQuery}
                                                WHERE p.productCategoryId = '${data.productCategory}' AND COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) = 0
                                                ORDER BY p.productName`;
                } else if (req.query.startDate && req.query.endDate) {
                    sql_queries_getdetails = `${sql_querry_getMwSiSO}
                                              LEFT JOIN(
                                                SELECT
                                                    inventory_stockIn_data.productId,
                                                    ROUND(SUM(
                                                        inventory_stockIn_data.productQty
                                                    ),2) AS total_quantity,
                                                    ROUND(SUM(
                                                        inventory_stockIn_data.totalPrice
                                                    )) AS totalExpense
                                                FROM
                                                    inventory_stockIn_data
                                                WHERE
                                                 inventory_stockIn_data.branchId = '${branchId}' AND inventory_stockIn_data.stockInDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')
                                                GROUP BY
                                                    inventory_stockIn_data.productId
                                            ) AS simw
                                            ON
                                            p.productId = simw.productId
                                        LEFT JOIN(
                                            SELECT
                                                inventory_stockOut_data.productId,
                                                ROUND(SUM(
                                                    inventory_stockOut_data.productQty
                                                ),2) AS total_quantity,
                                                ROUND(SUM(
                                                        inventory_stockOut_data.stockOutPrice
                                                )) AS totalStockOutPrice
                                            FROM
                                                inventory_stockOut_data
                                            WHERE
                                               inventory_stockOut_data.branchId = '${branchId}' AND inventory_stockOut_data.stockOutDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')
                                            GROUP BY
                                                inventory_stockOut_data.productId
                                        ) AS somw
                                        ON
                                        p.productId = somw.productId
                                        WHERE p.productCategoryId = '${data.productCategory}'
                                        ORDER BY p.productName`;
                } else {
                    sql_queries_getdetails = `${sql_querry_getMwSiSO}
                                              LEFT JOIN(
                                                SELECT
                                                    inventory_stockIn_data.productId,
                                                    ROUND(SUM(
                                                        inventory_stockIn_data.productQty
                                                    ),2) AS total_quantity,
                                                    ROUND(SUM(
                                                        inventory_stockIn_data.totalPrice
                                                    )) AS totalExpense
                                                FROM
                                                    inventory_stockIn_data
                                                WHERE
                                                    inventory_stockIn_data.branchId = '${branchId}' AND inventory_stockIn_data.stockInDate BETWEEN STR_TO_DATE('${firstDay}','%b %d %Y') AND STR_TO_DATE('${lastDay}','%b %d %Y')
                                                GROUP BY
                                                    inventory_stockIn_data.productId
                                            ) AS simw
                                            ON
                                            p.productId = simw.productId
                                        LEFT JOIN(
                                            SELECT
                                                inventory_stockOut_data.productId,
                                                ROUND(SUM(
                                                    inventory_stockOut_data.productQty
                                                ),2) AS total_quantity,
                                                ROUND(SUM(
                                                    inventory_stockOut_data.stockOutPrice
                                                )) AS totalStockOutPrice
                                            FROM
                                                inventory_stockOut_data
                                            WHERE
                                                inventory_stockOut_data.branchId = '${branchId}' AND inventory_stockOut_data.stockOutDate BETWEEN STR_TO_DATE('${firstDay}','%b %d %Y') AND STR_TO_DATE('${lastDay}','%b %d %Y')
                                            GROUP BY
                                                inventory_stockOut_data.productId
                                        ) AS somw
                                        ON
                                        p.productId = somw.productId
                                        WHERE p.productCategoryId = '${data.productCategory}'
                                        ORDER BY p.productName`;
                }
            } else {
                if (req.query.productStatus == 1) {
                    sql_queries_getdetails = `${sql_querry_staticQuery}
                                                WHERE COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) >= p.minProductQty 
                                                ORDER BY p.productName`;
                } else if (req.query.productStatus == 2) {
                    sql_queries_getdetails = `${sql_querry_staticQuery}
                                                WHERE COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) < p.minProductQty AND COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) != 0
                                                ORDER BY p.productName`;
                } else if (req.query.productStatus == 3) {
                    sql_queries_getdetails = `${sql_querry_staticQuery}
                                                WHERE COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) = 0
                                                ORDER BY p.productName`;
                } else if (req.query.startDate && req.query.endDate) {
                    sql_queries_getdetails = `${sql_querry_getMwSiSO}
                                              LEFT JOIN(
                                                SELECT
                                                    inventory_stockIn_data.productId,
                                                    ROUND(SUM(
                                                        inventory_stockIn_data.productQty
                                                    ),2) AS total_quantity,
                                                    ROUND(SUM(
                                                        inventory_stockIn_data.totalPrice
                                                    )) AS totalExpense
                                                FROM
                                                    inventory_stockIn_data
                                                WHERE
                                                 inventory_stockIn_data.branchId = '${branchId}' AND inventory_stockIn_data.stockInDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')
                                                GROUP BY
                                                    inventory_stockIn_data.productId
                                            ) AS simw
                                            ON
                                            p.productId = simw.productId
                                        LEFT JOIN(
                                            SELECT
                                                inventory_stockOut_data.productId,
                                                ROUND(SUM(
                                                    inventory_stockOut_data.productQty
                                                ),2) AS total_quantity,
                                                ROUND(SUM(
                                                        inventory_stockOut_data.stockOutPrice
                                                )) AS totalStockOutPrice
                                            FROM
                                                inventory_stockOut_data
                                            WHERE
                                               inventory_stockOut_data.branchId = '${branchId}' AND inventory_stockOut_data.stockOutDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')
                                            GROUP BY
                                                inventory_stockOut_data.productId
                                        ) AS somw
                                        ON
                                        p.productId = somw.productId
                                        ORDER BY p.productName`;
                } else {
                    sql_queries_getdetails = `${sql_querry_getMwSiSO}
                                              LEFT JOIN(
                                                SELECT
                                                    inventory_stockIn_data.productId,
                                                    ROUND(SUM(
                                                        inventory_stockIn_data.productQty
                                                    ),2) AS total_quantity,
                                                    ROUND(SUM(
                                                        inventory_stockIn_data.totalPrice
                                                    )) AS totalExpense
                                                FROM
                                                    inventory_stockIn_data
                                                WHERE
                                                    inventory_stockIn_data.branchId = '${branchId}' AND inventory_stockIn_data.stockInDate BETWEEN STR_TO_DATE('${firstDay}','%b %d %Y') AND STR_TO_DATE('${lastDay}','%b %d %Y')
                                                GROUP BY
                                                    inventory_stockIn_data.productId
                                            ) AS simw
                                            ON
                                            p.productId = simw.productId
                                        LEFT JOIN(
                                            SELECT
                                                inventory_stockOut_data.productId,
                                                ROUND(SUM(
                                                    inventory_stockOut_data.productQty
                                                ),2) AS total_quantity,
                                                ROUND(SUM(
                                                    inventory_stockOut_data.stockOutPrice
                                                )) AS totalStockOutPrice
                                            FROM
                                                inventory_stockOut_data
                                            WHERE
                                                inventory_stockOut_data.branchId = '${branchId}' AND inventory_stockOut_data.stockOutDate BETWEEN STR_TO_DATE('${firstDay}','%b %d %Y') AND STR_TO_DATE('${lastDay}','%b %d %Y')
                                            GROUP BY
                                                inventory_stockOut_data.productId
                                        ) AS somw
                                        ON
                                        p.productId = somw.productId
                                        ORDER BY p.productName`;
                }
            }
            pool.query(sql_queries_getdetails, async (err, rows) => {
                if (err) return res.status(404).send(err);
                const datas = Object.values(JSON.parse(JSON.stringify(rows)));
                processDatas(datas)
                    .then((data) => {
                        const rows = datas ? datas.map((element, index) => data[index] && data[index].convertedQuantity ? { ...element, remainingStock: data[index].convertedQuantity } : { ...element, remainingStock: element.remainingStock + ' ' + element.minProductUnit },
                            // console.log(data[index] && data[index].convertedQuantity)
                        ) : []
                        let newData = [];
                        Promise.all(
                            rows ? rows.map(async (element, index) => {
                                let newElement = element;
                                return await newConversationAsync(element.purchese, element.productId, element.minProductUnit)
                                    .then(async (res) => {
                                        newElement = { ...newElement, purchese: res }
                                        return await newConversationAsync(element.totalUsed, element.productId, element.minProductUnit)
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
                                    worksheet.getCell('A1').value = `Product List From ${data.startDate} To ${data.endDate}`;
                                } else {
                                    worksheet.mergeCells('A1', 'N1');
                                    worksheet.getCell('A1').value = `Product List From ${firstDay} To ${lastDay}`;
                                }

                                const headersNameList = ['S no.', 'Product Name', 'પ્રોડક્ટ નામ', 'Total StockIn', 'Total Expense', 'Total Used', 'Total Used Price', 'Remaining Stock', 'Remaining Price', 'Last StockIn', 'Last Price', 'Last Updated Price', 'Min ProductQty', 'Stock Status', 'LastIn DATE'];
                                const columnsArray = [
                                    { key: "s_no", width: 10, },
                                    { key: "productName", width: 30 },
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
                                    { key: "minProductQty", width: 20 },
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
                                    worksheetInStock.getCell('A1').value = `In-Stock Product List From ${data.startDate} To ${data.endDate}`;
                                } else {
                                    worksheetInStock.mergeCells('A1', 'N1');
                                    worksheetInStock.getCell('A1').value = `In-Stock Product List From ${firstDay} To ${lastDay}`;
                                }

                                /*Column headers*/
                                worksheetInStock.getRow(2).values = headersNameList;

                                // Column for data in excel. key must match data key
                                worksheetInStock.columns = columnsArray;
                                const inStockProducts = rows.filter(product => product.stockStatus === 'In-Stock');
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
                                    worksheetLowStock.getCell('A1').value = `Low-Stock Product List From ${data.startDate} To ${data.endDate}`;
                                } else {
                                    worksheetLowStock.mergeCells('A1', 'N1');
                                    worksheetLowStock.getCell('A1').value = `Low-Stock Product List From ${firstDay} To ${lastDay}`;
                                }

                                /*Column headers*/
                                worksheetLowStock.getRow(2).values = headersNameList;

                                // Column for data in excel. key must match data key
                                worksheetLowStock.columns = columnsArray;

                                worksheetInStock.columns = columnsArray;
                                const lowStockProducts = rows.filter(product => product.stockStatus === 'Low-Stock');
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
                                    worksheetOutStock.getCell('A1').value = `Out-Stock Product List From ${data.startDate} To ${data.endDate}`;
                                } else {
                                    worksheetOutStock.mergeCells('A1', 'N1');
                                    worksheetOutStock.getCell('A1').value = `Out-Stock Product List From ${firstDay} To ${lastDay}`;
                                }

                                /*Column headers*/
                                worksheetOutStock.getRow(2).values = headersNameList;

                                // Column for data in excel. key must match data key
                                worksheetOutStock.columns = columnsArray;

                                const outStockProducts = rows.filter(product => product.stockStatus === 'Out-Stock');
                                console.log(outStockProducts);
                                //Looping through User data
                                const arrstockOut = outStockProducts;
                                console.log(">>>", arr);
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
                                    worksheetChkStock.getCell('A1').value = `Product List From ${data.startDate} To ${data.endDate}`;
                                } else {
                                    worksheetChkStock.mergeCells('A1', 'F1');
                                    worksheetChkStock.getCell('A1').value = `Product List From ${firstDay} To ${lastDay}`;
                                }

                                /*Column headers*/
                                worksheetChkStock.getRow(2).values = ['Sr. No', 'Product Name', 'પ્રોડક્ટ નામ', 'Remain Stock', 'Min Qty', 'Status'];

                                // Column for data in excel. key must match data key
                                worksheetChkStock.columns = [
                                    { key: "s_no", width: 10, },
                                    { key: "productName", width: 30 },
                                    { key: "gujProductName", width: 30 },
                                    { key: "remainingStock", width: 40 },
                                    { key: "minProductQty", width: 20 },
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
            return res.status(401).send("BranchId Not Found");
        }
    } else {
        return res.status(401).send("Please Login Firest.....!");
    }
};

// Export PDF For Products List

async function createPDF(res, datas, tableHeading) {
    try {
        // Create a new PDF document
        console.log(';;;;;;', datas);
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
        // console.log(`PDF saved as ${pdfFilename}`);
    } catch (error) {
        console.error('An error occurd', error);
        res.status(500).json('Internal Server Error');
    }
}

const exportPdfForAllProductsData = (req, res) => {
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
                    productStatus: req.query.productStatus,
                    productCategory: req.query.productCategory
                }
                const sql_querry_staticQuery = `SELECT
                                                p.productId,
                                                UCASE(p.productName) AS productName,
                                                gujaratiProductName AS gujProductName,
                                                CONCAT(p.minProductQty,' ',p.minProductUnit) AS minProductQty,
                                                p.minProductUnit,
                                                CONCAT(p.leadTime,' ','Day') AS leadTime,
                                                p.isExpired,
                                                CONCAT(p.expiredDays,' ','Day') AS expiredDays,
                                                COALESCE(si.total_quantity, 0) AS purchese,
                                                COALESCE(so.total_quantity, 0) AS totalUsed,
                                                COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) AS remainingStock,
                                                COALESCE(ROUND(siLu.productPrice,2), 0) AS lastPrice,
                                                COALESCE(siLu.productQty,'No In') AS lastUpdatedQty,
                                                COALESCE(siLu.totalPrice, 0) AS totalPrice,
                                                COALESCE(
                                                    DATE_FORMAT(siLu.stockInDate, '%d-%m-%Y'),
                                                    "No Update"
                                                ) AS lastUpdatedStockInDate,
                                                CASE WHEN COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) >= p.minProductQty THEN 'In-Stock' WHEN COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) < p.minProductQty AND COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) != 0 THEN 'Low-Stock' ELSE 'Out-Stock'
                                            END AS stockStatus
                                            FROM
                                                inventory_product_data AS p
                                            LEFT JOIN(
                                                SELECT
                                                    inventory_stockIn_data.productId,
                                                    ROUND(SUM(
                                                        inventory_stockIn_data.productQty
                                                    ),2) AS total_quantity
                                                FROM
                                                    inventory_stockIn_data
                                                WHERE branchId = '${branchId}'
                                                GROUP BY
                                                    inventory_stockIn_data.productId
                                            ) AS si
                                            ON
                                                p.productId = si.productId
                                            LEFT JOIN(
                                                SELECT
                                                    inventory_stockOut_data.productId,
                                                    ROUND(SUM(
                                                        inventory_stockOut_data.productQty
                                                    ),2) AS total_quantity
                                                FROM
                                                    inventory_stockOut_data
                                                WHERE branchId = '${branchId}'
                                                GROUP BY
                                                    inventory_stockOut_data.productId
                                            ) AS so
                                            ON
                                                p.productId = so.productId
                                            LEFT JOIN(
                                                SELECT
                                                    productId,
                                                    stockInDate,
                                                    COALESCE(CONCAT(stockInDisplayQty,' ',stockInDisplayUnit),'No IN') AS productQty,
                                                    productPrice,
                                                    totalPrice
                                                FROM
                                                    inventory_stockIn_data
                                                WHERE branchId = '${branchId}' AND
                                                    (productId, stockInCreationDate) IN(
                                                    SELECT
                                                        productId,
                                                        MAX(stockInCreationDate)
                                                    FROM
                                                        inventory_stockIn_data
                                                    GROUP BY
                                                        productId
                                                )
                                            ) AS siLu
                                            ON
                                                p.productId = siLu.productId`;
                const sql_querry_getMwSiSO = `SELECT
                                                p.productId,
                                                UCASE(p.productName) AS productName,
                                                gujaratiProductName AS gujProductName,
                                                CONCAT(p.minProductQty,' ',p.minProductUnit) AS minProductQty,
                                                p.minProductUnit,
                                                CONCAT(p.leadTime,' ','Day') AS leadTime,
                                                p.isExpired,
                                                CONCAT(p.expiredDays,' ','Day') AS expiredDays,
                                                COALESCE(simw.total_quantity, 0) AS purchese,
                                                COALESCE(somw.total_quantity, 0) AS totalUsed,
                                                COALESCE(simw.totalExpense,0) AS totalExpense,
                                                COALESCE(somw.totalStockOutPrice,0) AS totalStockOutPrice,
                                                COALESCE(si.total_siPrice, 0) - COALESCE(so.total_soPrice, 0) AS remainPrice,
                                                COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) AS remainingStock,
                                                COALESCE(ROUND(siLu.productPrice,2), 0) AS lastPrice,
                                                COALESCE(siLu.productQty,'No In') AS lastUpdatedQty,
                                                COALESCE(siLu.totalPrice, 0) AS totalPrice,
                                                COALESCE(
                                                    DATE_FORMAT(siLu.stockInDate, '%d-%m-%Y'),
                                                    "No Update"
                                                ) AS lastUpdatedStockInDate,
                                                CASE WHEN COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) >= p.minProductQty THEN 'In-Stock' WHEN COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) < p.minProductQty AND COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) != 0 THEN 'Low-Stock' ELSE 'Out-Stock'
                                            END AS stockStatus
                                            FROM
                                                inventory_product_data AS p
                                            LEFT JOIN(
                                                SELECT
                                                    inventory_stockIn_data.productId,
                                                    ROUND(SUM(
                                                        inventory_stockIn_data.productQty
                                                    ),2) AS total_quantity,
                                                    ROUND(SUM(
                                                        inventory_stockIn_data.totalPrice
                                                    ),2) AS total_siPrice
                                                FROM
                                                    inventory_stockIn_data
                                                WHERE branchId = '${branchId}'
                                                GROUP BY
                                                    inventory_stockIn_data.productId
                                            ) AS si
                                            ON
                                                p.productId = si.productId
                                            LEFT JOIN(
                                                SELECT
                                                    inventory_stockOut_data.productId,
                                                    ROUND(SUM(
                                                        inventory_stockOut_data.productQty
                                                    ),2) AS total_quantity,
                                                    ROUND(SUM(
                                                        inventory_stockOut_data.stockOutPrice
                                                    ),2) AS total_soPrice
                                                FROM
                                                    inventory_stockOut_data
                                                WHERE branchId = '${branchId}'
                                                GROUP BY
                                                    inventory_stockOut_data.productId
                                            ) AS so
                                            ON
                                                p.productId = so.productId
                                            LEFT JOIN(
                                                SELECT
                                                    productId,
                                                    stockInDate,
                                                    CONCAT(stockInDisplayQty,' ',stockInDisplayUnit) AS productQty,
                                                    productPrice,
                                                    totalPrice
                                                FROM
                                                    inventory_stockIn_data
                                                WHERE branchId = '${branchId}' AND
                                                    (productId, stockInCreationDate) IN(
                                                    SELECT
                                                        productId,
                                                        MAX(stockInCreationDate) As lastDate
                                                    FROM
                                                        inventory_stockIn_data
                                                    GROUP BY
                                                        productId
                                                )
                                            ) AS siLu
                                            ON
                                                p.productId = siLu.productId`;
                if (req.query.productCategory) {
                    if (req.query.productStatus == 1) {
                        sql_queries_getdetails = `${sql_querry_staticQuery}
                                                WHERE p.productCategoryId = '${data.productCategory}' AND COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) >= p.minProductQty 
                                                ORDER BY p.productName`;
                    } else if (req.query.productStatus == 2) {
                        sql_queries_getdetails = `${sql_querry_staticQuery}
                                                WHERE p.productCategoryId = '${data.productCategory}' AND COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) < p.minProductQty AND COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) != 0
                                                ORDER BY p.productName`;
                    } else if (req.query.productStatus == 3) {
                        sql_queries_getdetails = `${sql_querry_staticQuery}
                                                WHERE p.productCategoryId = '${data.productCategory}' AND COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) = 0
                                                ORDER BY p.productName`;
                    } else if (req.query.startDate && req.query.endDate) {
                        sql_queries_getdetails = `${sql_querry_getMwSiSO}
                                              LEFT JOIN(
                                                SELECT
                                                    inventory_stockIn_data.productId,
                                                    ROUND(SUM(
                                                        inventory_stockIn_data.productQty
                                                    ),2) AS total_quantity,
                                                    ROUND(SUM(
                                                        inventory_stockIn_data.totalPrice
                                                    )) AS totalExpense
                                                FROM
                                                    inventory_stockIn_data
                                                WHERE
                                                 inventory_stockIn_data.branchId = '${branchId}' AND inventory_stockIn_data.stockInDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')
                                                GROUP BY
                                                    inventory_stockIn_data.productId
                                            ) AS simw
                                            ON
                                            p.productId = simw.productId
                                        LEFT JOIN(
                                            SELECT
                                                inventory_stockOut_data.productId,
                                                ROUND(SUM(
                                                    inventory_stockOut_data.productQty
                                                ),2) AS total_quantity,
                                                ROUND(SUM(
                                                        inventory_stockOut_data.stockOutPrice
                                                )) AS totalStockOutPrice
                                            FROM
                                                inventory_stockOut_data
                                            WHERE
                                               inventory_stockOut_data.branchId = '${branchId}' AND inventory_stockOut_data.stockOutDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')
                                            GROUP BY
                                                inventory_stockOut_data.productId
                                        ) AS somw
                                        ON
                                        p.productId = somw.productId
                                        WHERE p.productCategoryId = '${data.productCategory}'
                                        ORDER BY p.productName`;
                    } else {
                        sql_queries_getdetails = `${sql_querry_getMwSiSO}
                                              LEFT JOIN(
                                                SELECT
                                                    inventory_stockIn_data.productId,
                                                    ROUND(SUM(
                                                        inventory_stockIn_data.productQty
                                                    ),2) AS total_quantity,
                                                    ROUND(SUM(
                                                        inventory_stockIn_data.totalPrice
                                                    )) AS totalExpense
                                                FROM
                                                    inventory_stockIn_data
                                                WHERE
                                                    inventory_stockIn_data.branchId = '${branchId}' AND inventory_stockIn_data.stockInDate BETWEEN STR_TO_DATE('${firstDay}','%b %d %Y') AND STR_TO_DATE('${lastDay}','%b %d %Y')
                                                GROUP BY
                                                    inventory_stockIn_data.productId
                                            ) AS simw
                                            ON
                                            p.productId = simw.productId
                                        LEFT JOIN(
                                            SELECT
                                                inventory_stockOut_data.productId,
                                                ROUND(SUM(
                                                    inventory_stockOut_data.productQty
                                                ),2) AS total_quantity,
                                                ROUND(SUM(
                                                    inventory_stockOut_data.stockOutPrice
                                                )) AS totalStockOutPrice
                                            FROM
                                                inventory_stockOut_data
                                            WHERE
                                                inventory_stockOut_data.branchId = '${branchId}' AND inventory_stockOut_data.stockOutDate BETWEEN STR_TO_DATE('${firstDay}','%b %d %Y') AND STR_TO_DATE('${lastDay}','%b %d %Y')
                                            GROUP BY
                                                inventory_stockOut_data.productId
                                        ) AS somw
                                        ON
                                        p.productId = somw.productId
                                        WHERE p.productCategoryId = '${data.productCategory}'
                                        ORDER BY p.productName`;
                    }
                } else {
                    if (req.query.productStatus == 1) {
                        sql_queries_getdetails = `${sql_querry_staticQuery}
                                                WHERE COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) >= p.minProductQty 
                                                ORDER BY p.productName`;
                    } else if (req.query.productStatus == 2) {
                        sql_queries_getdetails = `${sql_querry_staticQuery}
                                                WHERE COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) < p.minProductQty AND COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) != 0
                                                ORDER BY p.productName`;
                    } else if (req.query.productStatus == 3) {
                        sql_queries_getdetails = `${sql_querry_staticQuery}
                                                WHERE COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) = 0
                                                ORDER BY p.productName`;
                    } else if (req.query.startDate && req.query.endDate) {
                        sql_queries_getdetails = `${sql_querry_getMwSiSO}
                                              LEFT JOIN(
                                                SELECT
                                                    inventory_stockIn_data.productId,
                                                    ROUND(SUM(
                                                        inventory_stockIn_data.productQty
                                                    ),2) AS total_quantity,
                                                    ROUND(SUM(
                                                        inventory_stockIn_data.totalPrice
                                                    )) AS totalExpense
                                                FROM
                                                    inventory_stockIn_data
                                                WHERE
                                                 inventory_stockIn_data.branchId = '${branchId}' AND inventory_stockIn_data.stockInDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')
                                                GROUP BY
                                                    inventory_stockIn_data.productId
                                            ) AS simw
                                            ON
                                            p.productId = simw.productId
                                        LEFT JOIN(
                                            SELECT
                                                inventory_stockOut_data.productId,
                                                ROUND(SUM(
                                                    inventory_stockOut_data.productQty
                                                ),2) AS total_quantity,
                                                ROUND(SUM(
                                                        inventory_stockOut_data.stockOutPrice
                                                )) AS totalStockOutPrice
                                            FROM
                                                inventory_stockOut_data
                                            WHERE
                                               inventory_stockOut_data.branchId = '${branchId}' AND inventory_stockOut_data.stockOutDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')
                                            GROUP BY
                                                inventory_stockOut_data.productId
                                        ) AS somw
                                        ON
                                        p.productId = somw.productId
                                        ORDER BY p.productName`;
                    } else {
                        sql_queries_getdetails = `${sql_querry_getMwSiSO}
                                              LEFT JOIN(
                                                SELECT
                                                    inventory_stockIn_data.productId,
                                                    ROUND(SUM(
                                                        inventory_stockIn_data.productQty
                                                    ),2) AS total_quantity,
                                                    ROUND(SUM(
                                                        inventory_stockIn_data.totalPrice
                                                    )) AS totalExpense
                                                FROM
                                                    inventory_stockIn_data
                                                WHERE
                                                    inventory_stockIn_data.branchId = '${branchId}' AND inventory_stockIn_data.stockInDate BETWEEN STR_TO_DATE('${firstDay}','%b %d %Y') AND STR_TO_DATE('${lastDay}','%b %d %Y')
                                                GROUP BY
                                                    inventory_stockIn_data.productId
                                            ) AS simw
                                            ON
                                            p.productId = simw.productId
                                        LEFT JOIN(
                                            SELECT
                                                inventory_stockOut_data.productId,
                                                ROUND(SUM(
                                                    inventory_stockOut_data.productQty
                                                ),2) AS total_quantity,
                                                ROUND(SUM(
                                                    inventory_stockOut_data.stockOutPrice
                                                )) AS totalStockOutPrice
                                            FROM
                                                inventory_stockOut_data
                                            WHERE
                                                inventory_stockOut_data.branchId = '${branchId}' AND inventory_stockOut_data.stockOutDate BETWEEN STR_TO_DATE('${firstDay}','%b %d %Y') AND STR_TO_DATE('${lastDay}','%b %d %Y')
                                            GROUP BY
                                                inventory_stockOut_data.productId
                                        ) AS somw
                                        ON
                                        p.productId = somw.productId
                                        ORDER BY p.productName`;
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
                                const rows = datas ? datas.map((element, index) => data[index] && data[index].convertedQuantity ? { ...element, remainingStock: data[index].convertedQuantity, allConversation: data[index].vikJson } : { ...element, remainingStock: element.remainingStock + ' ' + element.minProductUnit, allConversation: data[index].vikJson },
                                    // console.log(data[index] && data[index].convertedQuantity)
                                ) : []
                                let newData = [];
                                Promise.all(
                                    rows ? rows.map(async (element, index) => {
                                        let newElement = element;
                                        return await newConversationAsync(element.purchese, element.productId, element.minProductUnit)
                                            .then(async (res) => {
                                                newElement = { ...newElement, purchese: res }
                                                return await newConversationAsync(element.totalUsed, element.productId, element.minProductUnit)
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
                                        console.log(rows);
                                        const extractedData = rows.map(product => {
                                            return {
                                                "Product Name": product.productName,
                                                "Total Purchese": product.purchese,
                                                "Total Used": product.totalUsed,
                                                "Remaining": product.remainingStock,
                                                "Last In Qty": product.lastUpdatedQty,
                                                "Last Total Price": parseFloat(product.totalPrice).toLocaleString('en-IN'),
                                                "Product Price": product.lastPrice,
                                                "Last In Date": product.lastUpdatedStockInDate,
                                                "Status": product.stockStatus
                                            };
                                        });
                                        const abc = extractedData;

                                        if (req.query.startDate && req.query.endDate) {
                                            tableHeading = `Product Data From ${data.startDate} To ${data.endDate}`;
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
                return res.status(401).send("BranchId Not Found");
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
    addProduct,
    getProductListCounter,
    updateProduct,
    removeProduct,
    getProductList,
    getProductCountDetailsById,
    getSupplierByProductId,
    getProductDetailsTable,
    exportExcelSheetForProductTable,
    getProductDetailsById,
    getCategoryWiseUsedByProduct,
    getUnitPreferenceById,
    exportPdfForAllProductsData
}
