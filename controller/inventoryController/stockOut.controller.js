const pool = require('../../database');
const jwt = require("jsonwebtoken");
const excelJS = require("exceljs");
const { jsPDF } = require('jspdf');
require('jspdf-autotable');

// Function For Convert Units

function convertUnitsSmallToLarge(unit, qty, fromUnit, toUnit) {
    const unitsData = unit
    console.log('>>>>>', qty, fromUnit, toUnit);
    let result = qty;
    let conversionStarted = false; // To check if the conversion has started

    for (let i = 0; i < unitsData.length; i++) {
        const data = unitsData[i];

        // If we encounter the 'fromUnit', start the conversion
        if (fromUnit === data.smallerUnit || fromUnit === data.largerUnit) {
            conversionStarted = true;
        }

        if (conversionStarted) {
            if (fromUnit === data.smallerUnit) {
                result /= data.value;
                fromUnit = data.largerUnit; // Switch to the next larger unit for conversion
            } else if (toUnit === data.smallerUnit) {
                result *= data.value;
                toUnit = data.largerUnit; // Switch to the next larger unit for conversion
            }
        }

        // If we reach the 'toUnit', stop the conversion
        if (toUnit === data.largerUnit || toUnit === data.smallerUnit) {
            break;
        }
    }

    return result;
}

function convertUnits(unit, quantity, fromUnit, toUnit) {
    const unitsData = unit
    // Check if the units are the same
    const quantityStatic = quantity;
    const fromUnitStatic = fromUnit;
    const toUnitStatic = toUnit;
    if (fromUnit === toUnit) {
        return quantity;
    }

    let result = quantity;
    let conversionFactor = 1;

    // Find the conversion path from the larger unit to the smaller unit
    for (let i = 0; i < unitsData.length; i++) {
        if (unitsData[i].largerUnit === fromUnit) {
            conversionFactor *= unitsData[i].value;
            if (unitsData[i].smallerUnit === toUnit) {
                return result * conversionFactor;
            }
            fromUnit = unitsData[i].smallerUnit;
            i = -1; // Resetting to start from the beginning to check for further conversions
        }
    }
    return convertUnitsSmallToLarge(unit, quantityStatic, fromUnitStatic, toUnitStatic);
}

// StockOUT List API

const getStockOutList = async (req, res) => {
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
                const data = {
                    startDate: (req.query.startDate ? req.query.startDate : '').slice(4, 15),
                    endDate: (req.query.endDate ? req.query.endDate : '').slice(4, 15),
                    productId: req.query.productId
                }
                if (req.query.productId && req.query.startDate && req.query.endDate) {
                    sql_querry_getCountdetails = `SELECT count(*) as numRows FROM inventory_stockOut_data WHERE inventory_stockOut_data.branchId = '${branchId}' AND inventory_stockOut_data.productId = '${data.productId}' AND inventory_stockOut_data.stockOutDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')`;
                } else if (req.query.startDate && req.query.endDate) {
                    sql_querry_getCountdetails = `SELECT count(*) as numRows FROM inventory_stockOut_data WHERE inventory_stockOut_data.branchId = '${branchId}' AND inventory_stockOut_data.stockOutDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')`;
                } else if (req.query.productId) {
                    sql_querry_getCountdetails = `SELECT count(*) as numRows FROM inventory_stockOut_data WHERE inventory_stockOut_data.branchId = '${branchId}' AND inventory_stockOut_data.productId = '${data.productId}'`;
                } else {
                    sql_querry_getCountdetails = `SELECT count(*) as numRows FROM inventory_stockOut_data WHERE inventory_stockOut_data.branchId = '${branchId}'`;
                }
                pool.query(sql_querry_getCountdetails, (err, rows, fields) => {
                    if (err) {
                        console.error("An error occurd in SQL Queery", err);
                        return res.status(500).send('Database Error');
                    } else {
                        const numRows = rows[0].numRows;
                        const numPages = Math.ceil(numRows / numPerPage);
                        const commonQuery = `SELECT stockOutId, user_details.userName AS outBy, CONCAT(user_details.userFirstName,' ',user_details.userLastName) AS userName,inventory_product_data.productName AS productName, CONCAT(stockOutDisplayQty,' ',stockOutDisplayUnit) AS Quantity, ROUND(stockOutPrice) AS stockOutPrice, inventory_stockOutCategory_data.stockOutCategoryName AS stockOutCategoryName, stockOutComment, CONCAT(DATE_FORMAT(stockOutDate,'%d-%m-%Y'),' ',DATE_FORMAT(stockOutCreationDate, '%h:%i:%s %p')) AS stockOutDate 
                                                FROM inventory_stockOut_data
                                                INNER JOIN user_details ON user_details.userId = inventory_stockOut_data.userId
                                                INNER JOIN inventory_product_data ON inventory_product_data.productId = inventory_stockOut_data.productId
                                                INNER JOIN inventory_stockOutCategory_data ON inventory_stockOutCategory_data.stockOutCategoryId = inventory_stockOut_data.stockOutCategory`;
                        if (req.query.productId && req.query.startDate && req.query.endDate) {
                            sql_queries_getdetails = `${commonQuery}
                                                WHERE inventory_stockOut_data.branchId = '${branchId}' AND inventory_stockOut_data.productId = '${data.productId}' AND inventory_stockOut_data.stockOutDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')
                                                ORDER BY inventory_stockOut_data.stockOutDate DESC, inventory_stockOut_data.stockOutCreationDate DESC LIMIT ${limit}`;
                        } else if (req.query.startDate && req.query.endDate) {
                            sql_queries_getdetails = `${commonQuery}
                                                WHERE inventory_stockOut_data.branchId = '${branchId}' AND inventory_stockOut_data.stockOutDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')
                                                ORDER BY inventory_stockOut_data.stockOutDate DESC, inventory_stockOut_data.stockOutCreationDate DESC LIMIT ${limit}`;
                        } else if (req.query.productId) {
                            sql_queries_getdetails = `${commonQuery}
                                                WHERE inventory_stockOut_data.branchId = '${branchId}' AND inventory_stockOut_data.productId = '${data.productId}'
                                                ORDER BY inventory_stockOut_data.stockOutDate DESC, inventory_stockOut_data.stockOutCreationDate DESC LIMIT ${limit}`;
                        } else {
                            sql_queries_getdetails = `${commonQuery}
                                                WHERE inventory_stockOut_data.branchId = '${branchId}'
                                                ORDER BY inventory_stockOut_data.stockOutDate DESC, inventory_stockOut_data.stockOutCreationDate DESC LIMIT ${limit}`
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
                                    return res.status(200).send({ rows, numRows });
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
        res.status(500).json('Internal Server Error');
    }
}

// Add StockOut API

const addStockOutDetails = async (req, res) => {
    try {

        let token;
        token = req.headers ? req.headers.authorization.split(" ")[1] : null;
        if (token) {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const userId = decoded.id.id;
            const branchId = decoded.id.branchId;
            const uid1 = new Date();
            const stockOutId = String("stockOut_" + uid1.getTime());
            console.log("...", stockOutId);

            const productId = req.body.productId;
            const productQty = req.body.productQty;
            const productUnit = req.body.productUnit.trim();
            const stockOutCategory = req.body.stockOutCategory.trim();
            const stockOutComment = req.body.stockOutComment ? req.body.stockOutComment.trim() : null;
            const stockOutDate = new Date(req.body.stockOutDate ? req.body.stockOutDate : "10/10/1001").toString().slice(4, 15);

            if (!productId || !productQty || !productUnit || !stockOutCategory || !stockOutDate) {
                return res.status(400).send("Please Fill all the feilds");
            }
            else {
                const sql_queries_getNeedData = `SELECT bigUnitName AS largerUnit, unitNumber AS value, smallUnitName AS smallerUnit FROM product_unit_preference WHERE productId = '${productId}' ORDER BY product_unit_preference.priorityNumber ASC;
                                                 SELECT ipd.minProductUnit AS  minProductUnit, ipd.isExpired AS isExpired, ipd.expiredDays AS expiredDays FROM inventory_product_data AS ipd WHERE ipd.productId = '${productId}'`;
                pool.query(sql_queries_getNeedData, (err, result) => {
                    if (err) {
                        console.error("An error occurd in SQL Queery", err);
                        return res.status(500).send('Database Error');
                    }
                    const needData = {
                        unitsData: result && result[0] ? Object.values(JSON.parse(JSON.stringify(result[0]))) : null,
                        toUnit: result && result[1][0] && result[1][0].minProductUnit ? result[1][0].minProductUnit : null,
                        isExpired: result && result[1][0] && result[1][0].isExpired ? result[1][0].isExpired : 0,
                        expiredDays: result && result[1][0] && result[1][0].expiredDays ? result[1][0].expiredDays : 0
                    }
                    const productFinalQty = (needData.unitsData && needData.unitsData.length !== 0) ? convertUnits(needData.unitsData, productQty, productUnit, needData.toUnit) : productQty;
                    const get_remaining_stock = `SELECT COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) AS remainingStock FROM inventory_product_data AS p
                                                LEFT JOIN
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
                                                    ) AS so ON p.productId = so.productId
                                                WHERE p.productId = '${productId}'`;
                    pool.query(get_remaining_stock, (err, data) => {
                        if (err) {
                            console.error("An error occurd in SQL Queery", err);
                            return res.status(500).send('Database Error');
                        }
                        const remainStock = data[0].remainingStock
                        console.log("./././", remainStock);
                        if (remainStock < productFinalQty) {
                            return res.status(400).send(`You Can Not Stock Out more Then Remain Stock...!`);
                        } else {
                            sql_querry_getStockIndetail = `SELECT stockInId, productId, productQty, productPrice AS stockInPrice, remainingQty AS stockInQuantity FROM inventory_stockIn_data WHERE inventory_stockIn_data.productId = '${productId}' AND inventory_stockIn_data.branchId = '${branchId}' AND inventory_stockIn_data.remainingQty != 0 ORDER BY stockInDate ASC`;
                            pool.query(sql_querry_getStockIndetail, (err, data) => {
                                if (err) {
                                    console.error("An error occurd in SQL Queery", err);
                                    return res.status(500).send('Database Error');
                                }
                                const orignalStockInData = Object.values(JSON.parse(JSON.stringify(data)));
                                const stockInData = Object.values(JSON.parse(JSON.stringify(data)));
                                // console.log(">>>", Object.values(JSON.parse(JSON.stringify(data))));
                                const stockOutData = [
                                    { productId: req.body.productId, stockOutQuantity: productFinalQty }
                                ];

                                // Desired quantity
                                const desiredQuantity = stockOutData[0].stockOutQuantity;
                                console.log("joiii looo ?????", desiredQuantity);

                                // Calculate total stock out price
                                let remainingQuantity = desiredQuantity;
                                let totalStockOutPrice = 0;

                                // Sort stock in data by stock in price in ascending order
                                const sortedStockInData = stockInData
                                // const sortedStockInData = stockInData.sort((a, b) => a.stockInPrice - b.stockInPrice);
                                for (const stockOut of stockOutData) {
                                    let stockOutQuantity = stockOut.stockOutQuantity;

                                    for (const stockIn of sortedStockInData) {
                                        const { stockInQuantity, stockInPrice } = stockIn;

                                        if (stockInQuantity > 0) {
                                            const quantityToUse = Math.min(stockOutQuantity, stockInQuantity, remainingQuantity);
                                            const stockOutPrice = stockInPrice * quantityToUse;

                                            totalStockOutPrice += stockOutPrice;
                                            remainingQuantity -= quantityToUse;
                                            stockOutQuantity -= quantityToUse;
                                            stockIn.stockInQuantity -= quantityToUse;

                                            if (remainingQuantity <= 0) {
                                                break;
                                            }
                                        }
                                    }

                                    if (remainingQuantity <= 0) {
                                        break;
                                    }
                                }

                                // Print updated stockInData
                                console.log("Updated stockInData:", stockInData);
                                console.log("Total Stock Out Price:", totalStockOutPrice);
                                const stocokOutPrice = Number(totalStockOutPrice).toFixed(2);

                                const sopq = stockInData.filter((obj) => {
                                    if (obj.stockInQuantity != obj.productQty) {
                                        return obj;
                                    }
                                })

                                function generateUpdateQuery(data) {
                                    let query = 'UPDATE inventory_stockIn_data\nSET remainingQty = CASE\n';

                                    data.forEach((item) => {
                                        const { stockInId, stockInQuantity } = item;
                                        query += `    WHEN stockInId = '${stockInId}' THEN ROUND(${stockInQuantity},2)\n`;
                                    });

                                    query += '    ELSE remainingQty\nEND\n';

                                    const stockInIds = data.map((item) => `'${item.stockInId}'`).join(', ');
                                    query += `WHERE stockInId IN (${stockInIds});`;

                                    return query;
                                }

                                // console.log(generateUpdateQuery(sopq))
                                const sql_qurey_updatedRemainQty = generateUpdateQuery(sopq);
                                pool.query(sql_qurey_updatedRemainQty, (err, data) => {
                                    if (err) {
                                        console.error("An error occurd in SQL Queery", err);
                                        return res.status(500).send('Database Error');
                                    }
                                    const sql_querry_addStockOut = `INSERT INTO inventory_stockOut_data (stockOutId, branchId, userId, productId, productQty, stockOutPrice, stockOutDisplayQty, stockOutDisplayUnit, stockOutCategory, stockOutComment, stockOutDate)
                                                                    VALUES ('${stockOutId}', '${branchId}', '${userId}', '${productId}', ${productFinalQty}, ${stocokOutPrice}, ${productQty}, '${productUnit}', '${stockOutCategory}', NULLIF('${stockOutComment}','null'), STR_TO_DATE('${stockOutDate}','%b %d %Y'))`;
                                    pool.query(sql_querry_addStockOut, (err, data) => {
                                        if (err) {
                                            console.error("An error occurd in SQL Queery", err);
                                            return res.status(500).send('Database Error');
                                        }
                                        const sowsiId = sopq.map((obj) => {
                                            if (obj.stockInQuantity != obj.productQty) {
                                                return obj.stockInId;
                                            }
                                        })

                                        const remainingStockByIds = sowsiId.map(stockInId => {
                                            const stockIn = orignalStockInData.find(item => item.stockInId === stockInId);
                                            return stockIn ? stockIn.stockInQuantity : undefined;
                                        });

                                        const remainingStockByIds1 = sowsiId.map(stockInId => {
                                            const stockIn = stockInData.find(item => item.stockInId === stockInId);
                                            return stockIn ? stockIn.stockInQuantity : undefined;
                                        });

                                        console.log('orignalStockInData', remainingStockByIds);
                                        console.log('stockInData', remainingStockByIds1);

                                        const remainStockCutQty = remainingStockByIds.map((value, index) => value - remainingStockByIds1[index]);

                                        console.log(';;;;;;;;', stockInData)
                                        console.log('???????', orignalStockInData);
                                        console.log(">?>?>?<<<<.,,,", sowsiId);
                                        console.log("RRRRR", remainStockCutQty);

                                        // Use map to combine the arrays and format them
                                        const combinedData = sowsiId.map((id, index) => `('${stockOutId}','${id}',ROUND(${remainStockCutQty[index]},2))`);

                                        // Join the array elements into a single string
                                        const stockOutWiseStockInId = combinedData.join(',');

                                        // Output the resulting string
                                        console.log(stockOutWiseStockInId);

                                        sql_querry_addsowsiId = `INSERT INTO inventory_stockOutwiseStockInId_data (stockOutId, stockInId, cutProductQty) VALUES ${stockOutWiseStockInId}`;
                                        pool.query(sql_querry_addsowsiId, (err, data) => {
                                            if (err) {
                                                console.error("An error occurd in SQL Queery", err);
                                                return res.status(500).send('Database Error');
                                            }
                                            return res.status(200).send("Data Added Successfully");
                                        })
                                    })
                                })
                            })
                        }
                    })
                })
            }
        } else {
            res.status(401).send("Please Login Firest.....!");
        }
    } catch (error) {
        console.error('An error occurd', error);
        res.status(500).json('Internal Server Error');
    }
}

// Remove StockOut API

const removeStockOutTransaction = async (req, res) => {

    try {
        const stockOutId = req.query.stockOutId
        req.query.stockOutId = pool.query(`SELECT stockOutId, productQty FROM inventory_stockOut_data WHERE stockOutId = '${stockOutId}'`, (err, row) => {
            if (err) {
                console.error("An error occurd in SQL Queery", err);
                return res.status(500).send('Database Error');
            }
            const prevoiusQuantity = row[0].productQty;
            if (row && row.length) {
                sql_get_sowsoid = `SELECT
                                    inventory_stockIn_data.stockInId,
                                    productId,
                                    (
                                        inventory_stockIn_data.remainingQty + sowsid.cutProductQty
                                    ) AS productQty,
                                    productPrice AS stockInPrice,
                                    remainingQty AS remainingStock
                                FROM
                                    inventory_stockIn_data
                                INNER JOIN(
                                    SELECT
                                        inventory_stockOutwiseStockInId_data.stockInId,
                                        inventory_stockOutwiseStockInId_data.cutProductQty AS cutProductQty
                                    FROM
                                        inventory_stockOutwiseStockInId_data
                                    WHERE
                                        inventory_stockOutwiseStockInId_data.stockOutId = '${stockOutId}'
                                ) AS sowsid
                                ON
                                    inventory_stockIn_data.stockInId = sowsid.stockInId
                                WHERE
                                    inventory_stockIn_data.stockInId IN(
                                    SELECT
                                        COALESCE(
                                            inventory_stockOutwiseStockInId_data.stockInId,
                                            NULL
                                        )
                                    FROM
                                        inventory_stockOutwiseStockInId_data
                                    WHERE
                                        stockOutId = '${stockOutId}'
                                )
                                ORDER BY
                                    stockInCreationDate ASC`;
                console.log(">>><<<", sql_get_sowsoid);
                pool.query(sql_get_sowsoid, (err, data) => {
                    if (err) {
                        console.error("An error occurd in SQL Queery", err);
                        return res.status(500).send('Database Error');
                    }
                    const junoJson = Object.values(JSON.parse(JSON.stringify(data)))
                    console.log('junoo', junoJson)
                    console.log(">>>", Object.values(JSON.parse(JSON.stringify(data))));
                    const StockInData = Object.values(JSON.parse(JSON.stringify(data)));
                    console.log("::::::::", prevoiusQuantity - req.body.productQty);
                    const stockOutData = [
                        { productId: req.body.productId, stockOutQuantity: prevoiusQuantity }
                    ];

                    // const StockInData = [
                    //     { productId: 1, remainingStock: 5, productQty: 5, stockInPrice: 70 },
                    //     { productId: 1, remainingStock: 5, productQty: 5, stockInPrice: 60 },
                    //     { productId: 1, remainingStock: 2, productQty: 5, stockInPrice: 50 },
                    //     { productId: 1, remainingStock: 0, productQty: 5, stockInPrice: 40 },
                    //     { productId: 1, remainingStock: 0, productQty: 5, stockInPrice: 30 },
                    // ];

                    let desiredQuantity = stockOutData[0].stockOutQuantity; // Desired quantity to be inserted into the buckets
                    console.log("><?", desiredQuantity);
                    let totalCost = 0; // Total cost of filling the buckets

                    for (let i = 0; i < StockInData.length; i++) {
                        const stockIn = StockInData[i];
                        const availableSpace = stockIn.productQty - stockIn.remainingStock; // Calculate the available space for the product

                        if (desiredQuantity <= availableSpace) {
                            // If the desired quantity can fit completely in the current stock in entry
                            stockIn.remainingStock += desiredQuantity;
                            totalCost += desiredQuantity * stockIn.stockInPrice;
                            break; // Exit the loop since the desired quantity has been inserted
                        } else {
                            // If the desired quantity cannot fit completely in the current stock in entry
                            stockIn.remainingStock = stockIn.productQty;
                            totalCost += availableSpace * stockIn.stockInPrice;
                            desiredQuantity -= availableSpace;
                        }
                    }

                    console.log("Updated StockInData:", StockInData);
                    console.log("Total Cost of Filling: ", totalCost);

                    const sopq = StockInData.filter((obj) => {
                        if (obj.stockInQuantity != obj.productQty) {
                            return obj;
                        }
                    })

                    function generateUpdateQuery(data) {
                        let query = 'UPDATE inventory_stockIn_data\nSET remainingQty = CASE\n';

                        data.forEach((item) => {
                            const { stockInId, remainingStock } = item;
                            query += `    WHEN stockInId = '${stockInId}' THEN ROUND(${remainingStock},2)\n`;
                        });

                        query += '    ELSE remainingQty\nEND\n';

                        const stockInIds = data.map((item) => `'${item.stockInId}'`).join(', ');
                        query += `WHERE stockInId IN (${stockInIds});`;

                        return query;
                    }

                    console.log(generateUpdateQuery(sopq))
                    const sql_qurey_updatedRemainQty = generateUpdateQuery(sopq);
                    pool.query(sql_qurey_updatedRemainQty, (err, data) => {
                        if (err) {
                            console.error("An error occurd in SQL Queery", err);
                            return res.status(500).send('Database Error');
                        }
                        const sql_querry_removedetails = `DELETE FROM inventory_stockOut_data WHERE stockOutId = '${stockOutId}'`;
                        pool.query(sql_querry_removedetails, (err, data) => {
                            if (err) {
                                console.error("An error occurd in SQL Queery", err);
                                return res.status(500).send('Database Error');
                            }
                            return res.status(200).send("Transaction Deleted Successfully");
                        })
                    })
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

// Fill StockOut Transaction API

const fillStockOutTransaction = (req, res) => {
    try {
        const stockOutId = req.query.stockOutId
        sql_querry_fillUser = `SELECT inventory_stockOut_data.productId FROM inventory_stockOut_data 
                                WHERE stockOutId = '${stockOutId}'`;
        pool.query(sql_querry_fillUser, (err, data) => {
            if (err) {
                console.error("An error occurd in SQL Queery", err);
                return res.status(500).send('Database Error');
            }
            const productId = data[0].productId
            sql_get_remainStockWithdata = ` SELECT inventory_stockOut_data.productId, inventory_product_data.productName, stockOutDisplayQty AS productQty, stockOutDisplayUnit AS productUnit, stockOutCategory, stockOutComment, stockOutDate FROM inventory_stockOut_data 
                                                INNER JOIN inventory_product_data ON inventory_product_data.productId = inventory_stockOut_data.productId
                                                WHERE stockOutId = '${stockOutId}';
                                            SELECT COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) AS remainingStock FROM inventory_product_data AS p
                                                                     LEFT JOIN
                                                                    (
                                                                        SELECT
                                                                            inventory_stockIn_data.productId,
                                                                            ROUND(SUM(inventory_stockIn_data.productQty),2) AS total_quantity
                                                                        FROM
                                                                            inventory_stockIn_data
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
                                                                        GROUP BY
                                                                            inventory_stockOut_data.productId
                                                                    ) AS so ON p.productId = so.productId
                                                                WHERE p.productId = '${productId}'`;
            pool.query(sql_get_remainStockWithdata, (err, data) => {
                if (err) {
                    console.error("An error occurd in SQL Queery", err);
                    return res.status(500).send('Database Error');
                }
                const stockOutData = data[0][0];
                const remainStock = data[1][0].remainingStock + data[0][0].productQty;
                const fillData = {
                    ...stockOutData,
                    remainingStock: remainStock,
                }
                return res.status(200).send(fillData);
            })
        })
    } catch (error) {
        console.error('An error occurd', error);
        res.status(500).json('Internal Server Error');
    }
}

// Update StockOut API

const updateStockOutTransaction = async (req, res) => {
    try {
        let token;
        token = req.headers ? req.headers.authorization.split(" ")[1] : null;
        if (token) {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const userId = decoded.id.id;
            const branchId = decoded.id.branchId;
            const uid1 = new Date();
            const stockOutHistoryId = String("modifiedSO_" + uid1.getTime());
            console.log("...", stockOutHistoryId);
            const stockOutId = req.body.stockOutId;
            const productId = req.body.productId;
            const productQty = req.body.productQty;
            const productUnit = req.body.productUnit.trim();
            const stockOutCategory = req.body.stockOutCategory.trim();
            const stockOutComment = req.body.stockOutComment ? req.body.stockOutComment.trim() : null;
            const stockOutDate = new Date(req.body.stockOutDate ? req.body.stockOutDate : "10/10/1001").toString().slice(4, 15);
            const reason = req.body.reason ? req.body.reason : null;
            const currentModifyDate = new Date().toString().slice(4, 24)
            if (!productId || !productQty || !productUnit || !stockOutCategory || !stockOutDate || !reason) {
                return res.status(400).send("Please Fill all the feilds");
            } const sql_queries_getNeedData = `SELECT bigUnitName AS largerUnit, unitNumber AS value, smallUnitName AS smallerUnit FROM product_unit_preference WHERE productId = '${productId}' ORDER BY product_unit_preference.priorityNumber ASC;
                                                 SELECT ipd.minProductUnit AS  minProductUnit, ipd.isExpired AS isExpired, ipd.expiredDays AS expiredDays FROM inventory_product_data AS ipd WHERE ipd.productId = '${productId}'`;
            pool.query(sql_queries_getNeedData, (err, result) => {
                if (err) {
                    console.error("An error occurd in SQL Queery", err);
                    return res.status(500).send('Database Error');
                }
                const needData = {
                    unitsData: result && result[0] ? Object.values(JSON.parse(JSON.stringify(result[0]))) : null,
                    toUnit: result && result[1][0] && result[1][0].minProductUnit ? result[1][0].minProductUnit : null,
                    isExpired: result && result[1][0] && result[1][0].isExpired ? result[1][0].isExpired : 0,
                    expiredDays: result && result[1][0] && result[1][0].expiredDays ? result[1][0].expiredDays : 0
                }
                console.log(needData.unitsData);
                const productFinalQty = (needData.unitsData && needData.unitsData.length !== 0) ? convertUnits(needData.unitsData, productQty, productUnit, needData.toUnit) : productQty;
                get_remaining_stock = `SELECT COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) AS remainingStock FROM inventory_product_data AS p
                                             LEFT JOIN
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
                                            ) AS so ON p.productId = so.productId
                                        WHERE p.productId = '${productId}';
                                    SELECT productQty FROM inventory_stockOut_data WHERE stockOutId = '${stockOutId}'`;
                pool.query(get_remaining_stock, (err, remaindata) => {
                    if (err) {
                        console.error("An error occurd in SQL Queery", err);
                        return res.status(500).send('Database Error');
                    }
                    const remainStock = remaindata[0][0].remainingStock;
                    const previousQty = remaindata[1][0].productQty;
                    console.log("./././", remainStock + previousQty);
                    const remainIngUpdateStock = remainStock + previousQty;
                    if (remainIngUpdateStock < productFinalQty) {
                        return res.status(400).send(`You Can Not Stock Out more Then Remain Stock...!`);
                    } else {
                        const get_previous_data = `SELECT inventory_stockOut_data.productId, productQty, stockOutDisplayQty, stockOutDisplayUnit, stockOutPrice, inventory_stockOutCategory_data.stockOutCategoryName AS stockOutCategory, stockOutComment, DATE_FORMAT(stockOutDate,'%b %d %Y') AS stockOutDate, stockOutModificationDate FROM inventory_stockOut_data
                                                    INNER JOIN inventory_stockOutCategory_data ON inventory_stockOutCategory_data.stockOutCategoryId = inventory_stockOut_data.stockOutCategory
                                                    WHERE stockOutId = '${stockOutId}';
                                                    SELECT inventory_stockOutCategory_data.stockOutCategoryName FROM inventory_stockOutCategory_data
                                                    WHERE stockOutCategoryId = '${stockOutCategory}'`;
                        pool.query(get_previous_data, (err, data) => {
                            if (err) {
                                console.error("An error occurd in SQL Queery", err);
                                return res.status(500).send('Database Error');
                            }
                            const previousStockOutPrice = data[0][0].stockOutPrice;
                            const prevoiusQuantity = data[0][0].productQty;
                            const stockOutModificationDate = data[0][0].stockOutModificationDate ? new Date(data[0][0].stockOutModificationDate).toString().slice(4, 24) : new Date().toString().slice(4, 24);
                            const previousData = {
                                productQty: data[0][0].stockOutDisplayQty + ' ' + data[0][0].stockOutDisplayUnit,
                                stockOutCategory: data[0][0].stockOutCategory,
                                stockOutComment: data[0][0].stockOutComment ? data[0][0].stockOutComment : null,
                                stockOutDate: data[0][0].stockOutDate,
                            }
                            const newData = {
                                productQty: req.body.productQty + ' ' + req.body.productUnit,
                                stockOutCategory: data[1][0].stockOutCategoryName,
                                stockOutComment: req.body.stockOutComment,
                                stockOutDate: new Date(req.body.stockOutDate).toString().slice(4, 15)
                            }
                            let dataEdited = {}
                            console.log(">>>", previousData);
                            console.log('/////???', Object.keys(previousData));
                            console.log(">>>.....", newData);
                            const previousKey = Object.keys(previousData);
                            const updatedField = previousKey.filter((key) => {
                                if (previousData[key] != newData[key]) {
                                    dataEdited = { ...dataEdited, [key]: newData[key] }
                                    return key;
                                }
                            })
                            // if (updatedField.includes('productQty')) {
                            //     previousData.productQty = previousData.productQty + ' ' + previousData.productUnit;
                            //     newData.productQty = newData.productQty + ' ' + productUnit;
                            //     console.log('chavda', newData);
                            // }
                            // else if (updatedField.includes('productUnit')) {
                            //     previousData.productUnit = previousData.productQty + ' ' + previousData.productUnit;
                            //     newData.productUnit = newData.productQty + ' ' + productUnit;
                            //     console.log('chavda else', newData);
                            // }
                            // console.log('parmar out', newData);
                            if (updatedField == null || updatedField == '') {
                                return res.status(500).send('No Change');
                            }

                            sql_querry_getStockIndetail = `SELECT stockInId, productId, productQty, productPrice AS stockInPrice, remainingQty AS stockInQuantity FROM inventory_stockIn_data WHERE inventory_stockIn_data.productId = '${productId}' AND inventory_stockIn_data.branchId = '${branchId}' AND inventory_stockIn_data.remainingQty != 0 ORDER BY stockInDate ASC;
                                                           SELECT stockInId FROM inventory_stockOutwiseStockInId_data WHERE stockOutId = '${stockOutId}'`;
                            pool.query(sql_querry_getStockIndetail, (err, data) => {
                                if (err) {
                                    console.error("An error occurd in SQL Queery", err);
                                    return res.status(500).send('Database Error');
                                }
                                console.log(">>>???", prevoiusQuantity);
                                console.log(">>>", req.body.productQty);
                                console.log("jo loda", updatedField);
                                if (prevoiusQuantity < productFinalQty) {
                                    const orignalStockInData = Object.values(JSON.parse(JSON.stringify(data[0])));
                                    const stockInData = Object.values(JSON.parse(JSON.stringify(data[0])));
                                    const oldIdsArray = Object.values(JSON.parse(JSON.stringify(data[1])));
                                    console.log(">>>", Object.values(JSON.parse(JSON.stringify(data[1]))));
                                    console.log("::::::::", productFinalQty - prevoiusQuantity);
                                    const stockOutData = [
                                        { productId: req.body.productId, stockOutQuantity: productFinalQty - prevoiusQuantity }
                                    ];

                                    // Desired quantity
                                    const desiredQuantity = stockOutData[0].stockOutQuantity;
                                    console.log("?????", desiredQuantity);

                                    // Calculate total stock out price
                                    let remainingQuantity = desiredQuantity;
                                    let totalStockOutPrice = 0;

                                    // Sort stock in data by stock in price in ascending order
                                    const sortedStockInData = stockInData
                                    // const sortedStockInData = stockInData.sort((a, b) => a.stockInPrice - b.stockInPrice);
                                    for (const stockOut of stockOutData) {
                                        let stockOutQuantity = stockOut.stockOutQuantity;

                                        for (const stockIn of sortedStockInData) {
                                            const { stockInQuantity, stockInPrice } = stockIn;

                                            if (stockInQuantity > 0) {
                                                const quantityToUse = Math.min(stockOutQuantity, stockInQuantity, remainingQuantity);
                                                const stockOutPrice = stockInPrice * quantityToUse;

                                                totalStockOutPrice += stockOutPrice;
                                                remainingQuantity -= quantityToUse;
                                                stockOutQuantity -= quantityToUse;
                                                stockIn.stockInQuantity -= quantityToUse;

                                                if (remainingQuantity <= 0) {
                                                    break;
                                                }
                                            }
                                        }

                                        if (remainingQuantity <= 0) {
                                            break;
                                        }
                                    }

                                    // Print updated stockInData
                                    console.log("Updated stockInData:", stockInData);

                                    console.log("Total Stock Out Price:", totalStockOutPrice);
                                    const totalofStockOutPrice = previousStockOutPrice + totalStockOutPrice;
                                    const stockOutPrice = Number(totalofStockOutPrice).toFixed(2);

                                    const sopq = stockInData.filter((obj) => {
                                        if (obj.stockInQuantity != obj.productQty) {
                                            return obj;
                                        }
                                    })

                                    const sowsiId = sopq.map((obj) => {
                                        if (obj.stockInQuantity != obj.productQty) {
                                            return obj.stockInId;
                                        }
                                    });

                                    const oldId = oldIdsArray.map((obj) => {
                                        return obj.stockInId;
                                    });

                                    const similarStockInIds = sowsiId.filter(id => oldId.includes(id));

                                    const removeSameId = sowsiId.filter(id => !similarStockInIds.includes(id));

                                    console.log('jojojojojo', removeSameId);

                                    if (similarStockInIds.length != 0) {
                                        const remainingStockByIds = similarStockInIds.map(stockInId => {
                                            const stockIn = orignalStockInData.find(item => item.stockInId === stockInId);
                                            return stockIn ? stockIn.stockInQuantity : undefined;
                                        });

                                        const remainingStockByIds1 = similarStockInIds.map(stockInId => {
                                            const stockIn = stockInData.find(item => item.stockInId === stockInId);
                                            return stockIn ? stockIn.stockInQuantity : undefined;
                                        });

                                        console.log('orignalStockInData', remainingStockByIds);
                                        console.log('stockInData', remainingStockByIds1);

                                        const remainStockCutQty = remainingStockByIds.map((value, index) => value - remainingStockByIds1[index]);

                                        console.log(';;;;;;;;', stockInData)
                                        console.log('???????', orignalStockInData);
                                        console.log(">?>?>?<<<<.,,,", sowsiId);
                                        console.log(">?>?>?<<<<.,,,", oldId);
                                        console.log('same id', similarStockInIds);
                                        console.log("RRRRR", remainStockCutQty);
                                        sql_qurey_updateExistingId = `UPDATE inventory_stockOutwiseStockInId_data SET cutProductQty = cutProductQty + ${remainStockCutQty[0]} WHERE stockOutId = '${stockOutId}' AND stockInId = '${similarStockInIds[0]}'`;
                                        pool.query(sql_qurey_updateExistingId, (err, result) => {
                                            if (err) {
                                                console.error("An error occurd in SQL Queery", err);
                                                return res.status(500).send('Database Error');
                                            }
                                            console.log('Existing Data Updated SuccessFully');
                                        })
                                    }

                                    if (removeSameId.length != 0) {
                                        const remainingStockByIds = removeSameId.map(stockInId => {
                                            const stockIn = orignalStockInData.find(item => item.stockInId === stockInId);
                                            return stockIn ? stockIn.stockInQuantity : undefined;
                                        });

                                        const remainingStockByIds1 = removeSameId.map(stockInId => {
                                            const stockIn = stockInData.find(item => item.stockInId === stockInId);
                                            return stockIn ? stockIn.stockInQuantity : undefined;
                                        });

                                        console.log('orignalStockInData', remainingStockByIds);
                                        console.log('stockInData', remainingStockByIds1);

                                        const remainStockCutQty = remainingStockByIds.map((value, index) => value - remainingStockByIds1[index]);

                                        console.log(';;;;;;;;', stockInData)
                                        console.log('???????', orignalStockInData);
                                        console.log(">?>?>?<<<<.,,,", sowsiId);
                                        console.log(">?>?>?<<<<.,,,", oldId);
                                        console.log('same id', similarStockInIds);
                                        console.log("RRRRR", remainStockCutQty);

                                        // Use map to combine the arrays and format them
                                        const combinedData = removeSameId.map((id, index) => `('${stockOutId}','${id}',ROUND(${remainStockCutQty[index]},2))`);

                                        // Join the array elements into a single string
                                        const stockOutWiseStockInId = combinedData.join(',');

                                        // Output the resulting string
                                        console.log(stockOutWiseStockInId);

                                        sql_querry_addsowsiId = `INSERT INTO inventory_stockOutwiseStockInId_data (stockOutId, stockInId, cutProductQty) VALUES ${stockOutWiseStockInId}`;
                                        pool.query(sql_querry_addsowsiId, (err, data) => {
                                            if (err) {
                                                console.error("An error occurd in SQL Queery", err);
                                                return res.status(500).send('Database Error');
                                            }
                                            console.log("Data Added Successfully");
                                        })
                                    }

                                    function generateUpdateQuery(data) {
                                        let query = 'UPDATE inventory_stockIn_data\nSET remainingQty = CASE\n';

                                        data.forEach((item) => {
                                            const { stockInId, stockInQuantity } = item;
                                            query += `    WHEN stockInId = '${stockInId}' THEN ROUND(${stockInQuantity},2)\n`;
                                        });

                                        query += '    ELSE remainingQty\nEND\n';

                                        const stockInIds = data.map((item) => `'${item.stockInId}'`).join(', ');
                                        query += `WHERE stockInId IN (${stockInIds});`;

                                        return query;
                                    }

                                    console.log(generateUpdateQuery(sopq))
                                    const sql_qurey_updatedRemainQty = generateUpdateQuery(sopq);
                                    pool.query(sql_qurey_updatedRemainQty, (err, data) => {
                                        if (err) {
                                            console.error("An error occurd in SQL Queery", err);
                                            return res.status(500).send('Database Error');
                                        }
                                        const editFields = () => {
                                            var string = ''
                                            updatedField.forEach((data, index) => {
                                                if (index == 0)
                                                    string = "(" + "'" + stockOutId + "'" + "," + "'" + userId + "'" + "," + "'" + productId + "'" + "," + "'" + previousData[data] + "'" + "," + "'" + newData[data] + "'" + "," + "'" + reason + "'" + "," + "STR_TO_DATE('" + stockOutModificationDate + "','%b %d %Y %H:%i:%s')" + "," + "STR_TO_DATE('" + currentModifyDate + "','%b %d %Y %H:%i:%s')" + ")";
                                                else
                                                    string = string + ",(" + "'" + stockOutId + "'" + "," + "'" + userId + "'" + "," + "'" + productId + "'" + "," + "'" + previousData[data] + "'" + "," + "'" + newData[data] + "'" + "," + "'" + reason + "'" + "," + "STR_TO_DATE('" + stockOutModificationDate + "','%b %d %Y %H:%i:%s')" + "," + "STR_TO_DATE('" + currentModifyDate + "','%b %d %Y %H:%i:%s')" + ")";
                                            });
                                            return string;
                                        }

                                        console.log(">>>>>>>><<<<<<<<<", editFields());
                                        const sql_querry_addPreviousData = `INSERT INTO inventory_modified_history  (
                                                                                                stockOutId,
                                                                                                userId,
                                                                                                ProductId,
                                                                                                previous,
                                                                                                updated,
                                                                                                modifiedReason,
                                                                                                previousDateTime,
                                                                                                updatedDateTime
                                                                                            )
                                                                                            VALUES ${editFields()}`;
                                        console.log(">>.....", sql_querry_addPreviousData);
                                        pool.query(sql_querry_addPreviousData, (err, data) => {
                                            if (err) {
                                                console.error("An error occurd in SQL Queery", err);
                                                return res.status(500).send('Database Error');
                                            }
                                            console.log(">?>?>?>?,,,", stockOutCategory);
                                            const sql_querry_updatedetails = `UPDATE inventory_stockOut_data SET 
                                                                                                      branchId = '${branchId}',
                                                                                                      userId = '${userId}',
                                                                                                      productId = '${productId}',
                                                                                                      productQty = ${productFinalQty},
                                                                                                      stockOutPrice = ${stockOutPrice},
                                                                                                      stockOutDisplayQty = ${productQty},
                                                                                                      stockOutDisplayUnit = '${productUnit}',
                                                                                                      stockOutCategory = '${stockOutCategory}',
                                                                                                      stockOutComment = NULLIF('${stockOutComment}','null'),
                                                                                                      stockOutDate = STR_TO_DATE('${stockOutDate}','%b %d %Y') 
                                                                                                WHERE stockOutId = '${stockOutId}'`;
                                            pool.query(sql_querry_updatedetails, (err, data) => {
                                                if (err) {
                                                    console.error("An error occurd in SQL Queery", err);
                                                    return res.status(500).send('Database Error');
                                                }
                                                return res.status(200).send("Transaction Updated Successfully");
                                            })
                                        })
                                    })
                                } else if (req.body.productQty == 0) {
                                    return res.status(401).send('Please Delete Transaction');
                                } else if (prevoiusQuantity > productFinalQty) {
                                    console.log('222222222222', prevoiusQuantity, productFinalQty, prevoiusQuantity > productFinalQty)
                                    sql_get_sowsoid = `SELECT
                                                    inventory_stockIn_data.stockInId,
                                                    productId,
                                                    (
                                                        inventory_stockIn_data.remainingQty + sowsid.cutProductQty
                                                    ) AS productQty,
                                                    productPrice AS stockInPrice,
                                                    remainingQty AS remainingStock
                                                FROM
                                                    inventory_stockIn_data
                                                INNER JOIN(
                                                    SELECT
                                                        inventory_stockOutwiseStockInId_data.stockInId,
                                                        inventory_stockOutwiseStockInId_data.cutProductQty AS cutProductQty
                                                    FROM
                                                        inventory_stockOutwiseStockInId_data
                                                    WHERE
                                                        inventory_stockOutwiseStockInId_data.stockOutId = '${stockOutId}'
                                                ) AS sowsid
                                                ON
                                                    inventory_stockIn_data.stockInId = sowsid.stockInId
                                                WHERE
                                                    inventory_stockIn_data.stockInId IN(
                                                    SELECT
                                                        COALESCE(
                                                            inventory_stockOutwiseStockInId_data.stockInId,
                                                            NULL
                                                        )
                                                    FROM
                                                        inventory_stockOutwiseStockInId_data
                                                    WHERE
                                                        stockOutId = '${stockOutId}'
                                                )
                                                ORDER BY
                                                    stockInCreationDate ASC`;
                                    console.log(">>><<<", sql_get_sowsoid);
                                    pool.query(sql_get_sowsoid, (err, data) => {
                                        if (err) {
                                            console.error("An error occurd in SQL Queery", err);
                                            return res.status(500).send('Database Error');
                                        }
                                        const junoJson = Object.values(JSON.parse(JSON.stringify(data)));
                                        console.log("Juno Json", junoJson);
                                        const StockInData = Object.values(JSON.parse(JSON.stringify(data)));
                                        console.log("::::::::", prevoiusQuantity - productFinalQty);
                                        const stockOutData = [
                                            { productId: req.body.productId, stockOutQuantity: prevoiusQuantity - productFinalQty }
                                        ];

                                        // const StockInData = [
                                        //     { productId: 1, remainingStock: 5, productQty: 5, stockInPrice: 70 },
                                        //     { productId: 1, remainingStock: 5, productQty: 5, stockInPrice: 60 },
                                        //     { productId: 1, remainingStock: 2, productQty: 5, stockInPrice: 50 },
                                        //     { productId: 1, remainingStock: 0, productQty: 5, stockInPrice: 40 },
                                        //     { productId: 1, remainingStock: 0, productQty: 5, stockInPrice: 30 },
                                        // ];

                                        let desiredQuantity = stockOutData[0].stockOutQuantity; // Desired quantity to be inserted into the buckets
                                        console.log("><?", desiredQuantity);
                                        let totalCost = 0; // Total cost of filling the buckets

                                        for (let i = 0; i < StockInData.length; i++) {
                                            const stockIn = StockInData[i];
                                            const availableSpace = stockIn.productQty - stockIn.remainingStock; // Calculate the available space for the product

                                            if (desiredQuantity <= availableSpace) {
                                                // If the desired quantity can fit completely in the current stock in entry
                                                stockIn.remainingStock += desiredQuantity;
                                                totalCost += desiredQuantity * stockIn.stockInPrice;
                                                break; // Exit the loop since the desired quantity has been inserted
                                            } else {
                                                // If the desired quantity cannot fit completely in the current stock in entry
                                                stockIn.remainingStock = stockIn.productQty;
                                                totalCost += availableSpace * stockIn.stockInPrice;
                                                desiredQuantity -= availableSpace;
                                            }
                                        }
                                        const updatedStockInData = StockInData;
                                        console.log("Updated StockInData:", StockInData);
                                        console.log("Total Cost of Filling: ", totalCost);

                                        const totalofStockOutPrice = previousStockOutPrice - totalCost;
                                        const stockOutPrice = Number(totalofStockOutPrice).toFixed(2);

                                        const sopq = StockInData.filter((obj) => {
                                            return obj;
                                        })
                                        const sowsiId = StockInData.map((obj) => {
                                            return obj.stockInId;
                                        })
                                        const remainingStockByIds = sowsiId.map(stockInId => {
                                            const stockIn = junoJson.find(item => item.stockInId === stockInId);
                                            return stockIn ? stockIn.productQty : undefined;
                                        });

                                        const remainingStockByIds1 = sowsiId.map(stockInId => {
                                            const stockIn = updatedStockInData.find(item => item.stockInId === stockInId);
                                            return stockIn ? stockIn.remainingStock : undefined;
                                        });

                                        console.log('orignalStockInData', remainingStockByIds);
                                        console.log('stockInData', remainingStockByIds1);

                                        const remainStockCutQty = remainingStockByIds.map((value, index) => value - remainingStockByIds1[index]);

                                        console.log(';;;;;;;;', junoJson)
                                        console.log('???????', updatedStockInData);
                                        console.log(">?>?>?<<<<.,,,", sowsiId);
                                        console.log("RRRRR", remainStockCutQty);

                                        const idsToDelete = sowsiId.map(item => `'${item}'`).join(',');
                                        console.log('jgjgjjgjgjg', idsToDelete);

                                        const filteredId = sowsiId.filter((_, index) => remainStockCutQty[index] !== 0);
                                        const filteredQty = remainStockCutQty.filter(qtyValue => qtyValue !== 0);

                                        console.log('Id Mate Jovu', filteredId);
                                        console.log('Qty Mate Jovu', filteredQty);

                                        const combinedData = filteredId.map((id, index) => `('${stockOutId}','${id}',ROUND(${filteredQty[index]},2))`);

                                        // Join the array elements into a single string
                                        const stockOutWiseStockInId = combinedData.join(',');

                                        // Output the resulting string
                                        console.log(stockOutWiseStockInId);

                                        function generateUpdateQuery(data) {
                                            let query = 'UPDATE inventory_stockIn_data\nSET remainingQty = CASE\n';

                                            data.forEach((item) => {
                                                const { stockInId, remainingStock } = item;
                                                query += `    WHEN stockInId = '${stockInId}' THEN ROUND(${remainingStock},2)\n`;
                                            });

                                            query += '    ELSE remainingQty\nEND\n';

                                            const stockInIds = data.map((item) => `'${item.stockInId}'`).join(', ');
                                            query += `WHERE stockInId IN (${stockInIds})`;

                                            return query;
                                        }

                                        console.log(generateUpdateQuery(sopq))
                                        const sql_qurey_updatedRemainQty = `${generateUpdateQuery(sopq)};
                                                                        DELETE FROM inventory_stockOutwiseStockInId_data WHERE stockOutId = '${stockOutId}';
                                                                        INSERT INTO inventory_stockOutwiseStockInId_data (stockOutId, stockInId, cutProductQty) VALUES ${stockOutWiseStockInId}`;
                                        pool.query(sql_qurey_updatedRemainQty, (err, data) => {
                                            if (err) {
                                                console.error("An error occurd in SQL Queery", err);
                                                return res.status(500).send('Database Error');
                                            }
                                            const editFields = () => {
                                                var string = ''
                                                updatedField.forEach((data, index) => {
                                                    if (index == 0)
                                                        string = "(" + "'" + stockOutId + "'" + "," + "'" + userId + "'" + "," + "'" + productId + "'" + "," + "'" + previousData[data] + "'" + "," + "'" + newData[data] + "'" + "," + "'" + reason + "'" + "," + "STR_TO_DATE('" + stockOutModificationDate + "','%b %d %Y %H:%i:%s')" + "," + "STR_TO_DATE('" + currentModifyDate + "','%b %d %Y %H:%i:%s')" + ")";
                                                    else
                                                        string = string + ",(" + "'" + stockOutId + "'" + "," + "'" + userId + "'" + "," + "'" + productId + "'" + "," + "'" + previousData[data] + "'" + "," + "'" + newData[data] + "'" + "," + "'" + reason + "'" + "," + "STR_TO_DATE('" + stockOutModificationDate + "','%b %d %Y %H:%i:%s')" + "," + "STR_TO_DATE('" + currentModifyDate + "','%b %d %Y %H:%i:%s')" + ")";
                                                });
                                                return string;
                                            }

                                            console.log(">>>>>>>><<<<<<<<<", editFields());
                                            const sql_querry_addPreviousData = `INSERT INTO inventory_modified_history  (
                                                                                                stockOutId,
                                                                                                userId,
                                                                                                ProductId,
                                                                                                previous,
                                                                                                updated,
                                                                                                modifiedReason,
                                                                                                previousDateTime,
                                                                                                updatedDateTime
                                                                                            )
                                                                                            VALUES ${editFields()}`;
                                            console.log(">>.....", sql_querry_addPreviousData);
                                            pool.query(sql_querry_addPreviousData, (err, data) => {
                                                if (err) {
                                                    console.error("An error occurd in SQL Queery", err);
                                                    return res.status(500).send('Database Error');
                                                }
                                                console.log(">?>?>?>?,,,", stockOutCategory);
                                                const sql_querry_updatedetails = `UPDATE inventory_stockOut_data SET 
                                                                                         branchId = '${branchId}',
                                                                                         userId = '${userId}',
                                                                                         productId = '${productId}',
                                                                                         productQty = ${productFinalQty},
                                                                                         stockOutPrice = ${stockOutPrice},
                                                                                         stockOutDisplayQty = ${productQty},
                                                                                         stockOutDisplayUnit = '${productUnit}',
                                                                                         stockOutCategory = '${stockOutCategory}',
                                                                                         stockOutComment = NULLIF('${stockOutComment}','null'),
                                                                                         stockOutDate = STR_TO_DATE('${stockOutDate}','%b %d %Y') 
                                                                                   WHERE stockOutId = '${stockOutId}'`;
                                                pool.query(sql_querry_updatedetails, (err, data) => {
                                                    if (err) {
                                                        console.error("An error occurd in SQL Queery", err);
                                                        return res.status(500).send('Database Error');
                                                    }
                                                    return res.status(200).send("Transaction Updated Successfully");
                                                })
                                            })
                                        })
                                    })
                                } else {
                                    console.log('333333333333', prevoiusQuantity, productFinalQty);
                                    const editFields = () => {
                                        var string = ''
                                        updatedField.forEach((data, index) => {
                                            if (index == 0)
                                                string = "(" + "'" + stockOutId + "'" + "," + "'" + userId + "'" + "," + "'" + productId + "'" + "," + "'" + previousData[data] + "'" + "," + "'" + newData[data] + "'" + "," + "'" + reason + "'" + "," + "STR_TO_DATE('" + stockOutModificationDate + "','%b %d %Y %H:%i:%s')" + "," + "STR_TO_DATE('" + currentModifyDate + "','%b %d %Y %H:%i:%s')" + ")";
                                            else
                                                string = string + ",(" + "'" + stockOutId + "'" + "," + "'" + userId + "'" + "," + "'" + productId + "'" + "," + "'" + previousData[data] + "'" + "," + "'" + newData[data] + "'" + "," + "'" + reason + "'" + "," + "STR_TO_DATE('" + stockOutModificationDate + "','%b %d %Y %H:%i:%s')" + "," + "STR_TO_DATE('" + currentModifyDate + "','%b %d %Y %H:%i:%s')" + ")";
                                        });
                                        return string;
                                    }

                                    console.log(">>>>>>>><<<<<<<<<", editFields());
                                    const sql_querry_addPreviousData = `INSERT INTO inventory_modified_history  (
                                                                                                stockOutId,
                                                                                                userId,
                                                                                                ProductId,
                                                                                                previous,
                                                                                                updated,
                                                                                                modifiedReason,
                                                                                                previousDateTime,
                                                                                                updatedDateTime
                                                                                            )
                                                                                            VALUES ${editFields()}`;
                                    console.log(">>.....", sql_querry_addPreviousData);
                                    pool.query(sql_querry_addPreviousData, (err, data) => {
                                        if (err) {
                                            console.error("An error occurd in SQL Queery", err);
                                            return res.status(500).send('Database Error');
                                        }
                                        console.log(">?>?>?>?,,,", stockOutCategory);
                                        const sql_querry_updatedetails = `UPDATE inventory_stockOut_data SET 
                                                                                         branchId = '${branchId}',
                                                                                         userId = '${userId}',
                                                                                         productId = '${productId}',
                                                                                         productQty = ${productFinalQty},
                                                                                         stockOutDisplayQty = ${productQty},
                                                                                         stockOutDisplayUnit = '${productUnit}',
                                                                                         stockOutCategory = '${stockOutCategory}',
                                                                                         stockOutComment = NULLIF('${stockOutComment}','null'),
                                                                                         stockOutDate = STR_TO_DATE('${stockOutDate}','%b %d %Y') 
                                                                                   WHERE stockOutId = '${stockOutId}'`;
                                        pool.query(sql_querry_updatedetails, (err, data) => {
                                            if (err) {
                                                console.error("An error occurd in SQL Queery", err);
                                                return res.status(500).send('Database Error');
                                            }
                                            return res.status(200).send("Transaction Updated Successfully");
                                        })
                                    })

                                }

                            })
                        })
                    }
                })
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

// Get Edited Details List

const getUpdateStockOutList = (req, res) => {
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
                sql_queries_getNumberOFEdit = `SELECT count(*) as numRows FROM inventory_stockOut_data WHERE stockOutId IN (
                                               SELECT COALESCE(stockOutId,null) FROM inventory_modified_history GROUP BY stockOutId)`;
                pool.query(sql_queries_getNumberOFEdit, (err, rows, fields) => {
                    if (err) {
                        console.error("An error occurd in SQL Queery", err);
                        return res.status(500).send('Database Error');
                    } else {
                        const numRows = rows[0].numRows;
                        const numPages = Math.ceil(numRows / numPerPage);
                        sql_queries_getdetails = `SELECT stockOutId, user_details.userName AS outBy, CONCAT(user_details.userFirstName,' ',user_details.userLastName) AS userName,inventory_product_data.productName AS productName, CONCAT(stockOutDisplayQty,' ',stockOutDisplayUnit) AS Quantity, inventory_stockOutCategory_data.stockOutCategoryName AS stockOutCategoryName, stockOutComment, DATE_FORMAT(stockOutDate,'%d-%m-%Y') AS stockOutDate ,DATE_FORMAT(stockOutCreationDate,'%d-%M-%y / %r') AS stockOutCreationDate ,DATE_FORMAT(stockOutModificationDate,'%d-%M-%y / %r') AS stockOutModificationDate 
                                                    FROM inventory_stockOut_data
                                                    INNER JOIN user_details ON user_details.userId = inventory_stockOut_data.userId
                                                    INNER JOIN inventory_product_data ON inventory_product_data.productId = inventory_stockOut_data.productId
                                                    INNER JOIN inventory_stockOutCategory_data ON inventory_stockOutCategory_data.stockOutCategoryId = inventory_stockOut_data.stockOutCategory
                                                    WHERE inventory_stockOut_data.branchId = '${branchId}' AND stockOutId IN (SELECT COALESCE(stockOutId,null) FROM inventory_modified_history GROUP BY stockOutId) ORDER BY stockOutModificationDate DESC LIMIT ${limit}`;
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

// GET Updated StockOut List By Id

const getUpdateStockOutListById = (req, res) => {
    try {
        const page = req.query.page;
        const numPerPage = req.query.numPerPage;
        const skip = (page - 1) * numPerPage;
        const limit = skip + ',' + numPerPage;
        const stockOutId = req.query.stockOutId
        sql_queries_getNumberOFEdit = `SELECT count(*) as numRows FROM inventory_modified_history WHERE stockOutId = '${stockOutId}'`;
        console.log(">>>.", sql_queries_getNumberOFEdit);
        pool.query(sql_queries_getNumberOFEdit, (err, rows, fields) => {
            if (err) {
                console.error("An error occurd in SQL Queery", err);
                return res.status(500).send('Database Error');
            } else {
                const numRows = rows[0].numRows;
                const numPages = Math.ceil(numRows / numPerPage);
                sql_queries_getdetails = `SELECT user_details.userName AS userName,CONCAT(user_details.userFirstName,' ',user_details.userLastName) AS userFullName, inventory_product_data.productName AS productName, previous, updated, modifiedReason, DATE_FORMAT(previousDateTime,'%d-%M-%y / %r') AS previousDateTime, DATE_FORMAT(updatedDateTime,'%d-%M-%y / %r') AS updatedDateTime 
                                            FROM inventory_modified_history
                                            INNER JOIN inventory_product_data ON inventory_product_data.productId = inventory_modified_history.ProductId
                                            INNER JOIN user_details ON user_details.userId = inventory_modified_history.userId
                                            WHERE stockOutId = '${stockOutId}' ORDER BY updateHistoryCreationDate DESC LIMIT ${limit}`;

                console.log("aaaaa", sql_queries_getdetails);
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
                            return res.status(200).send({ rows, numRows });
                        }
                    }
                });
            }
        })
        // return res.status(200).send(data);

    } catch (error) {
        console.error('An error occurd', error);
        res.status(500).json('Internal Server Error');
    }
}

// Get Stockout Data By CategoryId

const getStockOutDataByCategory = (req, res) => {
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
                const data = {
                    startDate: (req.query.startDate ? req.query.startDate : '').slice(4, 15),
                    endDate: (req.query.endDate ? req.query.endDate : '').slice(4, 15),
                    categoryId: req.query.categoryId
                }
                if (req.query.startDate && req.query.endDate) {
                    sql_querry_getCountdetails = `SELECT count(*) as numRows FROM inventory_stockOut_data WHERE inventory_stockOut_data.branchId = '${branchId}' AND inventory_stockOut_data.stockOutCategory = '${data.categoryId}' AND inventory_stockOut_data.stockOutDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')`;
                } else {
                    sql_querry_getCountdetails = `SELECT count(*) as numRows FROM inventory_stockOut_data WHERE inventory_stockOut_data.branchId = '${branchId}' AND inventory_stockOut_data.stockOutCategory = '${data.categoryId}' AND inventory_stockOut_data.stockOutDate >= DATE_SUB(CURDATE(), INTERVAL 1 MONTH) AND inventory_stockOut_data.stockOutDate <= CURDATE()`;
                }
                pool.query(sql_querry_getCountdetails, (err, rows, fields) => {
                    if (err) {
                        console.error("An error occurd in SQL Queery", err);
                        return res.status(500).send('Database Error');
                    } else {
                        const numRows = rows[0].numRows;
                        const numPages = Math.ceil(numRows / numPerPage);
                        const commonQuery1 = `SELECT stockOutId, user_details.userName AS outBy, CONCAT(user_details.userFirstName,' ',user_details.userLastName) AS userName,inventory_product_data.productName AS productName, CONCAT(stockOutDisplayQty,' ',stockOutDisplayUnit) AS Quantity, ROUND(stockOutPrice) AS stockOutPrice, inventory_stockOutCategory_data.stockOutCategoryName AS stockOutCategoryName, stockOutComment, DATE_FORMAT(stockOutDate,'%d-%m-%Y') AS dateStockOut, DATE_FORMAT(stockOutCreationDate, '%h:%i:%s %p') AS stockOutTime 
                                                FROM inventory_stockOut_data
                                                INNER JOIN user_details ON user_details.userId = inventory_stockOut_data.userId
                                                INNER JOIN inventory_product_data ON inventory_product_data.productId = inventory_stockOut_data.productId
                                                INNER JOIN inventory_stockOutCategory_data ON inventory_stockOutCategory_data.stockOutCategoryId = inventory_stockOut_data.stockOutCategory`;
                        const commonQuery2 = `SELECT ROUND(SUM(stockOutPrice)) AS totalStockOutPrice FROM inventory_stockOut_data`;
                        if (req.query.startDate && req.query.endDate) {

                            sql_queries_getdetails = `${commonQuery1}
                                                WHERE inventory_stockOut_data.branchId = '${branchId}' AND inventory_stockOut_data.stockOutCategory = '${data.categoryId}' AND inventory_stockOut_data.stockOutDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')
                                                ORDER BY inventory_stockOut_data.stockOutDate DESC, inventory_stockOut_data.stockOutCreationDate DESC LIMIT ${limit};
                                                ${commonQuery2}
                                                WHERE inventory_stockOut_data.branchId = '${branchId}' AND inventory_stockOut_data.stockOutCategory = '${data.categoryId}' AND inventory_stockOut_data.stockOutDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')`;
                        } else {
                            sql_queries_getdetails = `${commonQuery1}
                                                WHERE inventory_stockOut_data.branchId = '${branchId}' AND inventory_stockOut_data.stockOutCategory = '${data.categoryId}' AND inventory_stockOut_data.stockOutDate >= DATE_SUB(CURDATE(), INTERVAL 1 MONTH) AND inventory_stockOut_data.stockOutDate <= CURDATE()
                                                ORDER BY inventory_stockOut_data.stockOutDate DESC, inventory_stockOut_data.stockOutCreationDate DESC LIMIT ${limit};
                                                ${commonQuery2}
                                                WHERE inventory_stockOut_data.branchId = '${branchId}' AND inventory_stockOut_data.stockOutCategory = '${data.categoryId}' AND inventory_stockOut_data.stockOutDate >= DATE_SUB(CURDATE(), INTERVAL 1 MONTH) AND inventory_stockOut_data.stockOutDate <= CURDATE()`;
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
                                    return res.status(200).send({ rows: rows[0], numRows, totalStockOutPrice: rows[1][0].totalStockOutPrice });
                                }
                            }
                        })
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

// To Get All Stock Out Data For Add

const getAllStockOutTransaction = (req, res) => {
    try {
        sql_queries_getAllData = `SELECT
                                    productId,
                                    productQty,
                                    productUnit,
                                    stockOutCategory,
                                    stockOutComment,
                                    DATE_FORMAT(stockOutDate,'%m/%d/%Y') AS outDate
                                FROM
                                    inventory_stockOut_data
                                ORDER by stockOutDate ASC, stockOutCreationDate ASC`;
        pool.query(sql_queries_getAllData, (err, data) => {
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

// Export Excel For Stock Out Data By Category Id

const exportExcelSheetForStockOutDataByCategoryId = (req, res) => {
    let token;
    token = req.headers.authorization ? req.headers.authorization.split(" ")[1] : null;
    if (token) {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const branchId = decoded && decoded.id && decoded.id.branchId ? decoded.id.branchId : null;
        if (branchId) {
            const currentDate = new Date();
            const FirestDate = currentDate.setMonth(currentDate.getMonth() - 1);
            console.log(FirestDate, currentDate);
            var firstDay = new Date().toString().slice(4, 15);
            var lastDay = new Date(FirestDate).toString().slice(4, 15);
            console.log(firstDay, lastDay);
            const data = {
                startDate: (req.query.startDate ? req.query.startDate : '').slice(4, 15),
                endDate: (req.query.endDate ? req.query.endDate : '').slice(4, 15),
                categoryId: req.query.categoryId
            }

            const commonQuery1 = `SELECT
                                      stockOutId,
                                      CONCAT(
                                          user_details.userFirstName,
                                          ' ',
                                          user_details.userLastName
                                      ) AS outBy,
                                      UPPER(inventory_product_data.productName) AS productName,
                                      stockOutDisplayQty AS productQty,
                                      stockOutDisplayUnit AS productUnit,
                                      ROUND(stockOutPrice) AS stockOutPrice,
                                      inventory_stockOutCategory_data.stockOutCategoryName AS stockOutCategoryName,
                                      stockOutComment,
                                      DATE_FORMAT(stockOutDate, '%d-%m-%Y') AS stockOutDate,
                                      DATE_FORMAT(stockOutCreationDate, '%h:%i:%s %p') AS stockOutTime
                                  FROM inventory_stockOut_data
                                  INNER JOIN user_details ON user_details.userId = inventory_stockOut_data.userId
                                  INNER JOIN inventory_product_data ON inventory_product_data.productId = inventory_stockOut_data.productId
                                  INNER JOIN inventory_stockOutCategory_data ON inventory_stockOutCategory_data.stockOutCategoryId = inventory_stockOut_data.stockOutCategory`;
            if (req.query.startDate && req.query.endDate) {

                sql_queries_getdetails = `${commonQuery1}
                                    WHERE inventory_stockOut_data.branchId = '${branchId}' AND inventory_stockOut_data.stockOutCategory = '${data.categoryId}' AND inventory_stockOut_data.stockOutDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')
                                    ORDER BY inventory_stockOut_data.stockOutDate DESC, inventory_stockOut_data.stockOutCreationDate DESC`;

            } else {
                sql_queries_getdetails = `${commonQuery1}
                                    WHERE inventory_stockOut_data.branchId = '${branchId}' AND inventory_stockOut_data.stockOutCategory = '${data.categoryId}' AND inventory_stockOut_data.stockOutDate >= DATE_SUB(CURDATE(), INTERVAL 1 MONTH) AND inventory_stockOut_data.stockOutDate <= CURDATE()
                                    ORDER BY inventory_stockOut_data.stockOutDate DESC, inventory_stockOut_data.stockOutCreationDate DESC`;
            }

            pool.query(sql_queries_getdetails, async (err, rows) => {
                if (err) return res.status(404).send(err);
                const workbook = new excelJS.Workbook();  // Create a new workbook
                const worksheet = workbook.addWorksheet("Bonus List"); // New Worksheet

                if (req.query.startDate && req.query.endDate) {
                    worksheet.mergeCells('A1', 'I1');
                    worksheet.getCell('A1').value = `Stock Out For ${rows[0].stockOutCategoryName.toUpperCase()}  :-  From ${data.startDate} To ${data.endDate}`;
                } else {
                    worksheet.mergeCells('A1', 'I1');
                    worksheet.getCell('A1').value = `Stock Out For ${rows[0].stockOutCategoryName.toUpperCase()}  :-  From ${lastDay} To ${firstDay}`;
                }

                /*Column headers*/
                worksheet.getRow(2).values = ['S no.', 'Out By', 'Product', 'Quantity', 'Unit', 'StockOut Price', 'Comment', 'Date', 'Time'];

                // Column for data in excel. key must match data key
                worksheet.columns = [
                    { key: "s_no", width: 10, },
                    { key: "outBy", width: 20 },
                    { key: "productName", width: 30 },
                    { key: "productQty", width: 10 },
                    { key: "productUnit", width: 10 },
                    { key: "stockOutPrice", width: 20 },
                    { key: "stockOutComment", width: 30 },
                    { key: "stockOutDate", width: 20 },
                    { key: "stockOutTime", width: 20 }
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

                worksheet.getRow(arr.length + 3).values = [
                    'Total:',
                    '',
                    '',
                    '',
                    '',
                    { formula: `SUM(F3:F${arr.length + 2})` }
                ];
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
                    res.contentType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
                    res.type = 'blob';
                    res.send(data)
                } catch (err) {
                    throw new Error(err);
                }
            })
        } else {
            return res.status(401).send("BranchId Not Found");
        }
    } else {
        return res.status(401).send("Please Login Firest.....!");
    }
};

// EXPORT Excel For StockOut List

const exportExcelSheetForStockout = (req, res) => {
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
            const commonQuery = `SELECT stockOutId, user_details.userName AS outBy, CONCAT(user_details.userFirstName,' ',user_details.userLastName) AS userName,inventory_product_data.productName AS productName, stockOutDisplayQty AS productQty, stockOutDisplayUnit AS productUnit, ROUND(stockOutPrice) AS stockOutPrice, inventory_stockOutCategory_data.stockOutCategoryName AS stockOutCategoryName, stockOutComment, CONCAT(DATE_FORMAT(stockOutDate,'%d-%m-%Y'),' ',DATE_FORMAT(stockOutCreationDate, '%h:%i:%s %p')) AS stockOutDate 
                                 FROM inventory_stockOut_data
                                 INNER JOIN user_details ON user_details.userId = inventory_stockOut_data.userId
                                 INNER JOIN inventory_product_data ON inventory_product_data.productId = inventory_stockOut_data.productId
                                 INNER JOIN inventory_stockOutCategory_data ON inventory_stockOutCategory_data.stockOutCategoryId = inventory_stockOut_data.stockOutCategory`;
            if (req.query.productId && req.query.startDate && req.query.endDate) {
                sql_queries_getdetails = `${commonQuery}
                                                WHERE inventory_stockOut_data.branchId = '${branchId}' AND inventory_stockOut_data.productId = '${data.productId}' AND inventory_stockOut_data.stockOutDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')
                                                ORDER BY inventory_stockOut_data.stockOutDate DESC, inventory_stockOut_data.stockOutCreationDate DESC`;
            } else if (req.query.startDate && req.query.endDate) {
                sql_queries_getdetails = `${commonQuery}
                                                WHERE inventory_stockOut_data.branchId = '${branchId}' AND inventory_stockOut_data.stockOutDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')
                                                ORDER BY inventory_stockOut_data.stockOutDate DESC, inventory_stockOut_data.stockOutCreationDate DESC`;
            } else if (req.query.productId) {
                sql_queries_getdetails = `${commonQuery}
                                                WHERE inventory_stockOut_data.branchId = '${branchId}' AND inventory_stockOut_data.productId = '${data.productId}'
                                                ORDER BY inventory_stockOut_data.stockOutDate DESC, inventory_stockOut_data.stockOutCreationDate DESC`;
            } else {
                sql_queries_getdetails = `${commonQuery}
                                                WHERE inventory_stockOut_data.branchId = '${branchId}'
                                                ORDER BY inventory_stockOut_data.stockOutDate DESC, inventory_stockOut_data.stockOutCreationDate DESC`;
            }

            pool.query(sql_queries_getdetails, async (err, rows) => {
                if (err) return res.status(404).send(err);
                const workbook = new excelJS.Workbook();  // Create a new workbook
                const worksheet = workbook.addWorksheet("StockOut List"); // New Worksheet

                if (req.query.startDate && req.query.endDate) {
                    worksheet.mergeCells('A1', 'G1');
                    worksheet.getCell('A1').value = `Stock Out From ${data.startDate} To ${data.endDate}`;
                } else {
                    worksheet.mergeCells('A1', 'G1');
                    worksheet.getCell('A1').value = `Stock Out From ${firstDay} To ${lastDay}`;
                }

                /*Column headers*/
                worksheet.getRow(2).values = ['S no.', 'Out By', 'Product', 'Quantity', 'Unit', 'StockOut Price', 'Category', 'Comment', 'Date'];

                // Column for data in excel. key must match data key
                worksheet.columns = [
                    { key: "s_no", width: 10, },
                    { key: "outBy", width: 20 },
                    { key: "productName", width: 30 },
                    { key: "productQty", width: 10 },
                    { key: "productUnit", width: 10 },
                    { key: "stockOutPrice", width: 20 },
                    { key: "stockOutCategoryName", width: 20 },
                    { key: "stockOutComment", width: 30 },
                    { key: "stockOutDate", width: 20 },
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
                if (req.query.productId || req.query.productId && req.query.startDate && req.query.endDate) {
                    worksheet.getRow(arr.length + 3).values = ['Total:', '', '', { formula: `SUM(D3:D${arr.length + 2})` }, '', { formula: `SUM(F3:F${arr.length + 2})` }];
                    worksheet.getRow(arr.length + 3).eachCell((cell) => {
                        cell.font = { bold: true, size: 14 }
                        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
                    })
                } else {
                    worksheet.getRow(arr.length + 3).values = ['Total:', '', '', '', '', { formula: `SUM(F3:F${arr.length + 2})` }];
                    worksheet.getRow(arr.length + 3).eachCell((cell) => {
                        cell.font = { bold: true, size: 14 }
                        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
                    })
                }
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
            return res.status(401).send("BranchId Not Found");
        }
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

// Export PDF For StockIn

const exportPdfForStockOut = (req, res) => {
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
                const commonQuery = `SELECT 
                                            CONCAT(user_details.userFirstName,' ',user_details.userLastName) AS "Out By",
                                            inventory_product_data.productName AS "Product", 
                                            CONCAT(stockOutDisplayQty,' ',stockOutDisplayUnit) AS "Qty",
                                            ROUND(stockOutPrice) AS "Out Price", 
                                            inventory_stockOutCategory_data.stockOutCategoryName AS "Category", 
                                            stockOutComment, CONCAT(DATE_FORMAT(stockOutDate,'%d-%m-%Y'),' ',DATE_FORMAT(stockOutCreationDate, '%h:%i:%s %p')) AS "Date" 
                                 FROM inventory_stockOut_data
                                 INNER JOIN user_details ON user_details.userId = inventory_stockOut_data.userId
                                 INNER JOIN inventory_product_data ON inventory_product_data.productId = inventory_stockOut_data.productId
                                 INNER JOIN inventory_stockOutCategory_data ON inventory_stockOutCategory_data.stockOutCategoryId = inventory_stockOut_data.stockOutCategory`;
                if (req.query.productId && req.query.startDate && req.query.endDate) {
                    sql_queries_getdetails = `${commonQuery}
                                                WHERE inventory_stockOut_data.branchId = '${branchId}' AND inventory_stockOut_data.productId = '${data.productId}' AND inventory_stockOut_data.stockOutDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')
                                                ORDER BY inventory_stockOut_data.stockOutDate DESC, inventory_stockOut_data.stockOutCreationDate DESC`;
                } else if (req.query.startDate && req.query.endDate) {
                    sql_queries_getdetails = `${commonQuery}
                                                WHERE inventory_stockOut_data.branchId = '${branchId}' AND inventory_stockOut_data.stockOutDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')
                                                ORDER BY inventory_stockOut_data.stockOutDate DESC, inventory_stockOut_data.stockOutCreationDate DESC`;
                } else if (req.query.productId) {
                    sql_queries_getdetails = `${commonQuery}
                                                WHERE inventory_stockOut_data.branchId = '${branchId}' AND inventory_stockOut_data.productId = '${data.productId}'
                                                ORDER BY inventory_stockOut_data.stockOutDate DESC, inventory_stockOut_data.stockOutCreationDate DESC`;
                } else {
                    sql_queries_getdetails = `${commonQuery}
                                                WHERE inventory_stockOut_data.branchId = '${branchId}'
                                                ORDER BY inventory_stockOut_data.stockOutDate DESC, inventory_stockOut_data.stockOutCreationDate DESC`
                }
                pool.query(sql_queries_getdetails, (err, rows) => {
                    if (err) {
                        console.error("An error occurd in SQL Queery", err);
                        return res.status(500).send('Database Error');
                    } else if (rows && rows.length <= 0) {
                        return res.status(400).send('No Data Found');
                    }
                    const abc = Object.values(JSON.parse(JSON.stringify(rows)));
                    const sumPayAmount = abc.reduce((total, item) => total + (item['Out Price'] || 0), 0);
                    const sumFooterArray = ['Total', '', '', '', parseFloat(sumPayAmount).toLocaleString('en-IN')];
                    if (req.query.startMonth && req.query.endMonth) {
                        const startMonthName = formatMonthYear(startMonth);
                        console.log(startMonthName);
                        const endMonthName = formatMonthYear(endMonth);
                        console.log(endMonthName);
                        tableHeading = `Stock Out Data From ${startMonthName} To ${endMonthName}`;
                    } else {
                        tableHeading = `All Stock Out Data`;
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

// Export PDF Stock Out Category Wise

const exportPdfForStockOutDataByCategoryId = (req, res) => {
    try {
        let token;
        token = req.headers.authorization ? req.headers.authorization.split(" ")[1] : null;
        if (token) {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const branchId = decoded && decoded.id && decoded.id.branchId ? decoded.id.branchId : null;
            if (branchId) {
                const currentDate = new Date();
                const FirestDate = currentDate.setMonth(currentDate.getMonth() - 1);
                console.log(FirestDate, currentDate);
                var firstDay = new Date().toString().slice(4, 15);
                var lastDay = new Date(FirestDate).toString().slice(4, 15);
                console.log(firstDay, lastDay);
                const data = {
                    startDate: (req.query.startDate ? req.query.startDate : '').slice(4, 15),
                    endDate: (req.query.endDate ? req.query.endDate : '').slice(4, 15),
                    categoryId: req.query.categoryId
                }
                const commonQuery1 = `SELECT
                                      CONCAT(
                                          user_details.userFirstName,
                                          ' ',
                                          user_details.userLastName
                                      ) AS "Out By",
                                      UPPER(inventory_product_data.productName) AS "Product Name",
                                      CONCAT(stockOutDisplayQty,' ',stockOutDisplayUnit) AS "Qty",
                                      ROUND(stockOutPrice) AS "Out Price",
                                      inventory_stockOutCategory_data.stockOutCategoryName AS "Category",
                                      stockOutComment AS "Comment",
                                      DATE_FORMAT(stockOutDate, '%d-%m-%Y') AS "Date",
                                      DATE_FORMAT(stockOutCreationDate, '%h:%i:%s %p') AS "Time"
                                  FROM inventory_stockOut_data
                                  INNER JOIN user_details ON user_details.userId = inventory_stockOut_data.userId
                                  INNER JOIN inventory_product_data ON inventory_product_data.productId = inventory_stockOut_data.productId
                                  INNER JOIN inventory_stockOutCategory_data ON inventory_stockOutCategory_data.stockOutCategoryId = inventory_stockOut_data.stockOutCategory`;
                if (req.query.startDate && req.query.endDate) {
                    sql_queries_getdetails = `${commonQuery1}
                                    WHERE inventory_stockOut_data.branchId = '${branchId}' AND inventory_stockOut_data.stockOutCategory = '${data.categoryId}' AND inventory_stockOut_data.stockOutDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')
                                    ORDER BY inventory_stockOut_data.stockOutDate DESC, inventory_stockOut_data.stockOutCreationDate DESC`;

                } else {
                    sql_queries_getdetails = `${commonQuery1}
                                    WHERE inventory_stockOut_data.branchId = '${branchId}' AND inventory_stockOut_data.stockOutCategory = '${data.categoryId}' AND inventory_stockOut_data.stockOutDate >= DATE_SUB(CURDATE(), INTERVAL 1 MONTH) AND inventory_stockOut_data.stockOutDate <= CURDATE()
                                    ORDER BY inventory_stockOut_data.stockOutDate DESC, inventory_stockOut_data.stockOutCreationDate DESC`;
                }
                pool.query(sql_queries_getdetails, (err, rows) => {
                    if (err) {
                        console.error("An error occurd in SQL Queery", err);
                        return res.status(500).send('Database Error');
                    } else if (rows && rows.length <= 0) {
                        return res.status(400).send('No Data Found');
                    }
                    const abc = Object.values(JSON.parse(JSON.stringify(rows)));
                    const sumPayAmount = abc.reduce((total, item) => total + (item['Out Price'] || 0), 0);
                    const sumFooterArray = ['Total', '', '', '', parseFloat(sumPayAmount).toLocaleString('en-IN')];
                    if (req.query.startMonth && req.query.endMonth) {
                        const startMonthName = formatMonthYear(startMonth);
                        console.log(startMonthName);
                        const endMonthName = formatMonthYear(endMonth);
                        console.log(endMonthName);
                        tableHeading = `Stock Out Data From ${startMonthName} To ${endMonthName}`;
                    } else {
                        tableHeading = `All Stock Out Data`;
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
    addStockOutDetails,
    removeStockOutTransaction,
    fillStockOutTransaction,
    updateStockOutTransaction,
    getStockOutList,
    exportExcelSheetForStockout,
    getUpdateStockOutList,
    getUpdateStockOutListById,
    getAllStockOutTransaction,
    getStockOutDataByCategory,
    exportExcelSheetForStockOutDataByCategoryId,
    exportPdfForStockOut,
    exportPdfForStockOutDataByCategoryId
}