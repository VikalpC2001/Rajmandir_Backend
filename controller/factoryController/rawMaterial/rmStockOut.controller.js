const pool = require('../../../database');
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

const getRmStockOutList = async (req, res) => {
    try {
        let token;
        token = req.headers.authorization ? req.headers.authorization.split(" ")[1] : null;
        if (token) {
            const page = req.query.page;
            const numPerPage = req.query.numPerPage;
            const skip = (page - 1) * numPerPage;
            const limit = skip + ',' + numPerPage;
            const data = {
                startDate: (req.query.startDate ? req.query.startDate : '').slice(4, 15),
                endDate: (req.query.endDate ? req.query.endDate : '').slice(4, 15),
                rawMaterialId: req.query.rawMaterialId
            }
            if (req.query.rawMaterialId && req.query.startDate && req.query.endDate) {
                sql_querry_getCountdetails = `SELECT count(*) as numRows FROM factory_rmStockOut_data WHERE factory_rmStockOut_data.rawMaterialId = '${data.rawMaterialId}' AND factory_rmStockOut_data.rmStockOutDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')`;
            } else if (req.query.startDate && req.query.endDate) {
                sql_querry_getCountdetails = `SELECT count(*) as numRows FROM factory_rmStockOut_data WHERE factory_rmStockOut_data.rmStockOutDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')`;
            } else if (req.query.rawMaterialId) {
                sql_querry_getCountdetails = `SELECT count(*) as numRows FROM factory_rmStockOut_data WHERE factory_rmStockOut_data.rawMaterialId = '${data.rawMaterialId}'`;
            } else {
                sql_querry_getCountdetails = `SELECT count(*) as numRows FROM factory_rmStockOut_data`;
            }
            pool.query(sql_querry_getCountdetails, (err, rows, fields) => {
                if (err) {
                    console.error("An error occurd in SQL Queery", err);
                    return res.status(500).send('Database Error');
                } else {
                    const numRows = rows[0].numRows;
                    const numPages = Math.ceil(numRows / numPerPage);
                    const commonQuery = `SELECT rmStockOutId, user_details.userName AS outBy, CONCAT(user_details.userFirstName,' ',user_details.userLastName) AS userName,factory_rawMaterial_data.rawMaterialName AS rawMaterialName, CONCAT(rmStockOutDisplayQty,' ',rmStockOutDisplayUnit) AS Quantity, ROUND(rmStockOutPrice) AS rmStockOutPrice, factory_rmStockOutCategory_data.stockOutCategoryName AS stockOutCategoryName, rmStockOutComment, CONCAT(DATE_FORMAT(rmStockOutDate,'%d-%m-%Y'),' ',DATE_FORMAT(rmStockOutCreationDate, '%h:%i:%s %p')) AS rmStockOutDate 
                                                FROM factory_rmStockOut_data
                                                INNER JOIN user_details ON user_details.userId = factory_rmStockOut_data.userId
                                                INNER JOIN factory_rawMaterial_data ON factory_rawMaterial_data.rawMaterialId = factory_rmStockOut_data.rawMaterialId
                                                INNER JOIN factory_rmStockOutCategory_data ON factory_rmStockOutCategory_data.stockOutCategoryId = factory_rmStockOut_data.rmStockOutCategory`;
                    if (req.query.rawMaterialId && req.query.startDate && req.query.endDate) {
                        sql_queries_getdetails = `${commonQuery}
                                                WHERE factory_rmStockOut_data.rawMaterialId = '${data.rawMaterialId}' AND factory_rmStockOut_data.rmStockOutDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')
                                                ORDER BY factory_rmStockOut_data.rmStockOutDate DESC, factory_rmStockOut_data.rmStockOutCreationDate DESC LIMIT ${limit}`;
                    } else if (req.query.startDate && req.query.endDate) {
                        sql_queries_getdetails = `${commonQuery}
                                                WHERE factory_rmStockOut_data.rmStockOutDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')
                                                ORDER BY factory_rmStockOut_data.rmStockOutDate DESC, factory_rmStockOut_data.rmStockOutCreationDate DESC LIMIT ${limit}`;
                    } else if (req.query.rawMaterialId) {
                        sql_queries_getdetails = `${commonQuery}
                                                WHERE factory_rmStockOut_data.rawMaterialId = '${data.rawMaterialId}'
                                                ORDER BY factory_rmStockOut_data.rmStockOutDate DESC, factory_rmStockOut_data.rmStockOutCreationDate DESC LIMIT ${limit}`;
                    } else {
                        sql_queries_getdetails = `${commonQuery}
                                                ORDER BY factory_rmStockOut_data.rmStockOutDate DESC, factory_rmStockOut_data.rmStockOutCreationDate DESC LIMIT ${limit}`
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
            return res.status(401).send("Please Login Firest.....!");
        }
    } catch (error) {
        console.error('An error occurd', error);
        res.status(500).json('Internal Server Error');
    }
}

// Add StockOut API

const addRmStockOutDetails = async (req, res) => {
    try {

        let token;
        token = req.headers ? req.headers.authorization.split(" ")[1] : null;
        if (token) {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const userId = decoded.id.id;
            const uid1 = new Date();
            const rmStockOutId = String("stockOut_" + uid1.getTime());
            console.log("...", rmStockOutId);

            const rawMaterialId = req.body.rawMaterialId;
            const rawMaterialQty = req.body.rawMaterialQty;
            const rawMaterialUnit = req.body.rawMaterialUnit.trim();
            const rmStockOutCategory = req.body.rmStockOutCategory.trim();
            const rmStockOutComment = req.body.rmStockOutComment ? req.body.rmStockOutComment.trim() : null;
            const rmStockOutDate = new Date(req.body.rmStockOutDate ? req.body.rmStockOutDate : "10/10/1001").toString().slice(4, 15);
            const isSupplyBranch = req.body.rmStockOutCategory && req.body.rmStockOutCategory == 'Branch' ? true : false;
            const branchId = req.body.branchId ? req.body.branchId : '';
            const billNumber = req.body.billNumber ? req.body.billNumber : '';
            if (isSupplyBranch == true) {
                if (!branchId) {
                    return res.status(400).send("Please Fill all the feilds");
                }
            }
            if (!rawMaterialId || !rawMaterialQty || !rawMaterialUnit || !rmStockOutCategory || !rmStockOutDate) {
                return res.status(400).send("Please Fill all the feilds");
            }
            else {
                const sql_queries_getNeedData = `SELECT bigUnitName AS largerUnit, unitNumber AS value, smallUnitName AS smallerUnit FROM factory_rmUnit_preference WHERE rawMaterialId = '${rawMaterialId}' ORDER BY factory_rmUnit_preference.priorityNumber ASC;
                                                 SELECT ipd.minRawMaterialUnit AS  minRawMaterialUnit, ipd.isExpired AS isExpired, ipd.expiredDays AS expiredDays FROM factory_rawMaterial_data AS ipd WHERE ipd.rawMaterialId = '${rawMaterialId}'`;
                pool.query(sql_queries_getNeedData, (err, result) => {
                    if (err) {
                        console.error("An error occurd in SQL Queery", err);
                        return res.status(500).send('Database Error');
                    }
                    const needData = {
                        unitsData: result && result[0] ? Object.values(JSON.parse(JSON.stringify(result[0]))) : null,
                        toUnit: result && result[1][0] && result[1][0].minRawMaterialUnit ? result[1][0].minRawMaterialUnit : null,
                        isExpired: result && result[1][0] && result[1][0].isExpired ? result[1][0].isExpired : 0,
                        expiredDays: result && result[1][0] && result[1][0].expiredDays ? result[1][0].expiredDays : 0
                    }
                    const productFinalQty = (needData.unitsData && needData.unitsData.length !== 0) ? convertUnits(needData.unitsData, rawMaterialQty, rawMaterialUnit, needData.toUnit) : rawMaterialQty;
                    const get_remaining_stock = `SELECT COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) AS remainingStock FROM factory_rawMaterial_data AS p
                                                LEFT JOIN
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
                                                    ) AS so ON p.rawMaterialId = so.rawMaterialId
                                                 WHERE p.rawMaterialId = '${rawMaterialId}'`;
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
                            sql_querry_getStockIndetail = `SELECT rmStockInId, rawMaterialId, rawMaterialQty, rawMaterialPrice AS stockInPrice, remainingQty AS stockInQuantity FROM factory_rmStockIn_data WHERE factory_rmStockIn_data.rawMaterialId = '${rawMaterialId}' AND factory_rmStockIn_data.remainingQty != 0 ORDER BY rmStockInDate ASC, rmStockInCreationDate ASC`;
                            pool.query(sql_querry_getStockIndetail, (err, data) => {
                                if (err) {
                                    console.error("An error occurd in SQL Queery", err);
                                    return res.status(500).send('Database Error');
                                }

                                const orignalStockInData = Object.values(JSON.parse(JSON.stringify(data)));
                                const stockInData = Object.values(JSON.parse(JSON.stringify(data)));
                                // console.log(">>>", Object.values(JSON.parse(JSON.stringify(data))));
                                const stockOutData = [
                                    { rawMaterialId: req.body.rawMaterialId, stockOutQuantity: productFinalQty }
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
                                            const rmStockOutPrice = stockInPrice * quantityToUse;

                                            totalStockOutPrice += rmStockOutPrice;
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
                                    if (obj.stockInQuantity != obj.rawMaterialQty) {
                                        return obj;
                                    }
                                })

                                function generateUpdateQuery(data) {
                                    let query = 'UPDATE factory_rmStockIn_data\nSET remainingQty = CASE\n';

                                    data.forEach((item) => {
                                        const { rmStockInId, stockInQuantity } = item;
                                        query += `    WHEN rmStockInId = '${rmStockInId}' THEN ROUND(${stockInQuantity},2)\n`;
                                    });

                                    query += '    ELSE remainingQty\nEND\n';

                                    const stockInIds = data.map((item) => `'${item.rmStockInId}'`).join(', ');
                                    query += `WHERE rmStockInId IN (${stockInIds})`;

                                    return query;
                                }

                                console.log('sdsddd', generateUpdateQuery);

                                // console.log(generateUpdateQuery(sopq))
                                const sql_qurey_updatedRemainQty = generateUpdateQuery(sopq);
                                pool.query(sql_qurey_updatedRemainQty, (err, data) => {
                                    if (err) {
                                        console.error("An error occurd in SQL Queery", err);
                                        return res.status(500).send('Database Error');
                                    }
                                    const sql_querry_addStockOut = `INSERT INTO factory_rmStockOut_data (rmStockOutId, userId, rawMaterialId, rawMaterialQty, rmStockOutPrice, rmStockOutDisplayQty, rmStockOutDisplayUnit, rmStockOutCategory, rmStockOutComment, rmStockOutDate)
                                                                    VALUES ('${rmStockOutId}', '${userId}', '${rawMaterialId}', ${productFinalQty}, ${stocokOutPrice}, ${rawMaterialQty}, '${rawMaterialUnit}', '${rmStockOutCategory}', NULLIF('${rmStockOutComment}','null'), STR_TO_DATE('${rmStockOutDate}','%b %d %Y'))`;
                                    pool.query(sql_querry_addStockOut, (err, data) => {
                                        if (err) {
                                            console.error("An error occurd in SQL Queery", err);
                                            return res.status(500).send('Database Error');
                                        }
                                        const sowsiId = sopq.map((obj) => {
                                            if (obj.stockInQuantity != obj.rawMaterialQty) {
                                                return obj.rmStockInId;
                                            }
                                        })

                                        const remainingStockByIds = sowsiId.map(rmStockInId => {
                                            const stockIn = orignalStockInData.find(item => item.rmStockInId === rmStockInId);
                                            return stockIn ? stockIn.stockInQuantity : undefined;
                                        });

                                        const remainingStockByIds1 = sowsiId.map(rmStockInId => {
                                            const stockIn = stockInData.find(item => item.rmStockInId === rmStockInId);
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
                                        const combinedData = sowsiId.map((id, index) => `('${rmStockOutId}','${id}',ROUND(${remainStockCutQty[index]},2))`);

                                        // Join the array elements into a single string
                                        const stockOutWiseStockInId = combinedData.join(',');

                                        // Output the resulting string
                                        console.log(stockOutWiseStockInId);

                                        sql_querry_addsowsiId = `INSERT INTO factory_stockOutwiseStockInId_data (rmStockOutId, rmStockInId, cutRmQty) VALUES ${stockOutWiseStockInId}`;
                                        pool.query(sql_querry_addsowsiId, (err, data) => {
                                            if (err) {
                                                console.error("An error occurd in SQL Queery", err);
                                                return res.status(500).send('Database Error');
                                            } else if (isSupplyBranch) {
                                                const sql_queries_getNeedData = `SELECT bigUnitName AS largerUnit, unitNumber AS value, smallUnitName AS smallerUnit FROM product_unit_preference WHERE productId = '${rawMaterialId}' ORDER BY product_unit_preference.priorityNumber ASC;
                                                                                 SELECT ipd.minProductUnit AS  minProductUnit, ipd.isExpired AS isExpired, ipd.expiredDays AS expiredDays FROM inventory_product_data AS ipd WHERE ipd.productId = '${rawMaterialId}'`;
                                                pool.query(sql_queries_getNeedData, (err, result) => {
                                                    if (err) {
                                                        console.error("An error occurd in SQL Queery", err);
                                                        return res.status(500).send('Database Error');
                                                    }
                                                    const stockInNeedData = {
                                                        unitsData: result && result[0] ? Object.values(JSON.parse(JSON.stringify(result[0]))) : null,
                                                        toUnit: result && result[1][0] && result[1][0].minProductUnit ? result[1][0].minProductUnit : null,
                                                        isExpired: result && result[1][0] && result[1][0].isExpired ? result[1][0].isExpired : 0,
                                                        expiredDays: result && result[1][0] && result[1][0].expiredDays ? result[1][0].expiredDays : 0
                                                    }
                                                    const stockINproductFinalQty = (stockInNeedData.unitsData && stockInNeedData.unitsData.length !== 0) ? convertUnits(stockInNeedData.unitsData, rawMaterialQty, rawMaterialUnit, stockInNeedData.toUnit) : rawMaterialQty;
                                                    const sql_querry_addStockIn = `INSERT INTO inventory_stockIn_data (
                                                                                                                        stockInId,
                                                                                                                        branchId,
                                                                                                                        userId, 
                                                                                                                        productId, 
                                                                                                                        productQty, 
                                                                                                                        productPrice, 
                                                                                                                        totalPrice, 
                                                                                                                        billNumber, 
                                                                                                                        stockInDisplayQty,
                                                                                                                        stockInDisplayUnit,
                                                                                                                        supplierId, 
                                                                                                                        stockInPaymentMethod, 
                                                                                                                        stockInComment,
                                                                                                                        productExpiryDate, 
                                                                                                                        remainingQty, 
                                                                                                                        stockInDate
                                                                                                                )  
                                                                                                                VALUES (
                                                                                                                        '${rmStockOutId}', 
                                                                                                                        '${branchId}',
                                                                                                                        '${userId}', 
                                                                                                                        '${rawMaterialId}', 
                                                                                                                         ${stockINproductFinalQty}, 
                                                                                                                         ${stocokOutPrice / stockINproductFinalQty},
                                                                                                                         ${stocokOutPrice}, 
                                                                                                                         ${billNumber ? `'${billNumber}'` : null}, 
                                                                                                                         ${rawMaterialQty},
                                                                                                                        '${rawMaterialUnit}', 
                                                                                                                        '${process.env.RAJ_MANDIR_FACTORY_ID}', 
                                                                                                                        'cash',
                                                                                                                         ${rmStockOutComment ? `'${rmStockOutComment}'` : null}, 
                                                                                                                         ${stockInNeedData && stockInNeedData.isExpired && stockInNeedData.expiredDays > 0 ? `DATE_ADD(STR_TO_DATE('${rmStockOutDate}','%b %d %Y'), INTERVAL ${stockInNeedData.expiredDays} DAY)` : null},
                                                                                                                         ${stockINproductFinalQty}, 
                                                                                                                         STR_TO_DATE('${rmStockOutDate}','%b %d %Y')
                                                                                                                )`;
                                                    pool.query(sql_querry_addStockIn, (err, data) => {
                                                        if (err) {
                                                            console.error("An error occurd in SQL Queery", err);
                                                            return res.status(500).send('Database Error');
                                                        }
                                                        return res.status(200).send("Data Added Successfully");
                                                    })
                                                })
                                            } else {
                                                return res.status(200).send("Data Added Successfully");
                                            }
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

const removeRmStockOutTransaction = async (req, res) => {
    try {
        const rmStockOutId = req.query.rmStockOutId
        const sql_query_chkIdIsDeleteOrNot = `SELECT stockInId, productQty, remainingQty FROM inventory_stockIn_data WHERE stockInId = '${rmStockOutId}'`;
        pool.query(sql_query_chkIdIsDeleteOrNot, (err, chk) => {
            if (err) {
                console.error("An error occurd in SQL Queery", err);
                return res.status(500).send('Database Error');
            }
            const isStockInId = chk && chk[0] && chk[0].stockInId ? chk[0].stockInId : null;
            if (isStockInId) {
                if (chk[0].productQty != chk[0].remainingQty) {
                    return res.status(400).send('You Can not Delete Transaction Because It is Used');
                } else {
                    req.query.rmStockOutId = pool.query(`SELECT rmStockOutId, rawMaterialQty FROM factory_rmStockOut_data WHERE rmStockOutId = '${rmStockOutId}'`, (err, row) => {
                        if (err) {
                            console.error("An error occurd in SQL Queery", err);
                            return res.status(500).send('Database Error');
                        }
                        const prevoiusQuantity = row[0].rawMaterialQty;
                        if (row && row.length) {
                            sql_get_sowsoid = `SELECT
                                                   factory_rmStockIn_data.rmStockInId,
                                                   rawMaterialId,
                                                   (
                                                       factory_rmStockIn_data.remainingQty + sowsid.cutRmQty
                                                   ) AS rawMaterialQty,
                                                   rawMaterialPrice AS stockInPrice,
                                                   remainingQty AS remainingStock
                                               FROM
                                                   factory_rmStockIn_data
                                               INNER JOIN(
                                                   SELECT
                                                       factory_stockOutwiseStockInId_data.rmStockInId,
                                                       factory_stockOutwiseStockInId_data.cutRmQty AS cutRmQty
                                                   FROM
                                                       factory_stockOutwiseStockInId_data
                                                   WHERE
                                                       factory_stockOutwiseStockInId_data.rmStockOutId = '${rmStockOutId}'
                                               ) AS sowsid
                                               ON
                                                   factory_rmStockIn_data.rmStockInId = sowsid.rmStockInId
                                               WHERE
                                                   factory_rmStockIn_data.rmStockInId IN(
                                                   SELECT
                                                       COALESCE(
                                                           factory_stockOutwiseStockInId_data.rmStockInId,
                                                           NULL
                                                       )
                                                   FROM
                                                       factory_stockOutwiseStockInId_data
                                                   WHERE
                                                       rmStockOutId = '${rmStockOutId}'
                                               )
                                               ORDER BY
                                                   rmStockInCreationDate ASC`;
                            pool.query(sql_get_sowsoid, (err, data) => {
                                if (err) {
                                    console.error("An error occurd in SQL Queery", err);
                                    return res.status(500).send('Database Error');
                                }
                                const junoJson = Object.values(JSON.parse(JSON.stringify(data)))
                                console.log('junoo', junoJson)
                                console.log(">>>", Object.values(JSON.parse(JSON.stringify(data))));
                                const StockInData = Object.values(JSON.parse(JSON.stringify(data)));
                                console.log("::::::::", prevoiusQuantity - req.body.rawMaterialQty);
                                const stockOutData = [
                                    { rawMaterialId: req.body.rawMaterialId, stockOutQuantity: prevoiusQuantity }
                                ];

                                // const StockInData = [
                                //     { rawMaterialId: 1, remainingStock: 5, rawMaterialQty: 5, stockInPrice: 70 },
                                //     { rawMaterialId: 1, remainingStock: 5, rawMaterialQty: 5, stockInPrice: 60 },
                                //     { rawMaterialId: 1, remainingStock: 2, rawMaterialQty: 5, stockInPrice: 50 },
                                //     { rawMaterialId: 1, remainingStock: 0, rawMaterialQty: 5, stockInPrice: 40 },
                                //     { rawMaterialId: 1, remainingStock: 0, rawMaterialQty: 5, stockInPrice: 30 },
                                // ];

                                let desiredQuantity = stockOutData[0].stockOutQuantity; // Desired quantity to be inserted into the buckets
                                console.log("><?", desiredQuantity);
                                let totalCost = 0; // Total cost of filling the buckets

                                for (let i = 0; i < StockInData.length; i++) {
                                    const stockIn = StockInData[i];
                                    const availableSpace = stockIn.rawMaterialQty - stockIn.remainingStock; // Calculate the available space for the product

                                    if (desiredQuantity <= availableSpace) {
                                        // If the desired quantity can fit completely in the current stock in entry
                                        stockIn.remainingStock += desiredQuantity;
                                        totalCost += desiredQuantity * stockIn.stockInPrice;
                                        break; // Exit the loop since the desired quantity has been inserted
                                    } else {
                                        // If the desired quantity cannot fit completely in the current stock in entry
                                        stockIn.remainingStock = stockIn.rawMaterialQty;
                                        totalCost += availableSpace * stockIn.stockInPrice;
                                        desiredQuantity -= availableSpace;
                                    }
                                }

                                console.log("Updated StockInData:", StockInData);
                                console.log("Total Cost of Filling: ", totalCost);

                                const sopq = StockInData.filter((obj) => {
                                    if (obj.stockInQuantity != obj.rawMaterialQty) {
                                        return obj;
                                    }
                                })

                                function generateUpdateQuery(data) {
                                    let query = 'UPDATE factory_rmStockIn_data\nSET remainingQty = CASE\n';

                                    data.forEach((item) => {
                                        const { rmStockInId, remainingStock } = item;
                                        query += `    WHEN rmStockInId = '${rmStockInId}' THEN ROUND(${remainingStock},2)\n`;
                                    });

                                    query += '    ELSE remainingQty\nEND\n';

                                    const stockInIds = data.map((item) => `'${item.rmStockInId}'`).join(', ');
                                    query += `WHERE rmStockInId IN (${stockInIds});`;

                                    return query;
                                }

                                console.log(generateUpdateQuery(sopq))
                                const sql_qurey_updatedRemainQty = generateUpdateQuery(sopq);
                                pool.query(sql_qurey_updatedRemainQty, (err, data) => {
                                    if (err) {
                                        console.error("An error occurd in SQL Queery", err);
                                        return res.status(500).send('Database Error');
                                    }
                                    const sql_querry_removedetails = `DELETE FROM factory_rmStockOut_data WHERE rmStockOutId = '${rmStockOutId}';
                                                                      DELETE FROM inventory_stockIn_data WHERE stockInId = '${rmStockOutId}'`;
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
                }
            } else {
                req.query.rmStockOutId = pool.query(`SELECT rmStockOutId, rawMaterialQty FROM factory_rmStockOut_data WHERE rmStockOutId = '${rmStockOutId}'`, (err, row) => {
                    if (err) {
                        console.error("An error occurd in SQL Queery", err);
                        return res.status(500).send('Database Error');
                    }
                    const prevoiusQuantity = row[0].rawMaterialQty;
                    if (row && row.length) {
                        sql_get_sowsoid = `SELECT
                                    factory_rmStockIn_data.rmStockInId,
                                    rawMaterialId,
                                    (
                                        factory_rmStockIn_data.remainingQty + sowsid.cutRmQty
                                    ) AS rawMaterialQty,
                                    rawMaterialPrice AS stockInPrice,
                                    remainingQty AS remainingStock
                                FROM
                                    factory_rmStockIn_data
                                INNER JOIN(
                                    SELECT
                                        factory_stockOutwiseStockInId_data.rmStockInId,
                                        factory_stockOutwiseStockInId_data.cutRmQty AS cutRmQty
                                    FROM
                                        factory_stockOutwiseStockInId_data
                                    WHERE
                                        factory_stockOutwiseStockInId_data.rmStockOutId = '${rmStockOutId}'
                                ) AS sowsid
                                ON
                                    factory_rmStockIn_data.rmStockInId = sowsid.rmStockInId
                                WHERE
                                    factory_rmStockIn_data.rmStockInId IN(
                                    SELECT
                                        COALESCE(
                                            factory_stockOutwiseStockInId_data.rmStockInId,
                                            NULL
                                        )
                                    FROM
                                        factory_stockOutwiseStockInId_data
                                    WHERE
                                        rmStockOutId = '${rmStockOutId}'
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
                            console.log("::::::::", prevoiusQuantity - req.body.rawMaterialQty);
                            const stockOutData = [
                                { rawMaterialId: req.body.rawMaterialId, stockOutQuantity: prevoiusQuantity }
                            ];

                            // const StockInData = [
                            //     { rawMaterialId: 1, remainingStock: 5, rawMaterialQty: 5, stockInPrice: 70 },
                            //     { rawMaterialId: 1, remainingStock: 5, rawMaterialQty: 5, stockInPrice: 60 },
                            //     { rawMaterialId: 1, remainingStock: 2, rawMaterialQty: 5, stockInPrice: 50 },
                            //     { rawMaterialId: 1, remainingStock: 0, rawMaterialQty: 5, stockInPrice: 40 },
                            //     { rawMaterialId: 1, remainingStock: 0, rawMaterialQty: 5, stockInPrice: 30 },
                            // ];

                            let desiredQuantity = stockOutData[0].stockOutQuantity; // Desired quantity to be inserted into the buckets
                            console.log("><?", desiredQuantity);
                            let totalCost = 0; // Total cost of filling the buckets

                            for (let i = 0; i < StockInData.length; i++) {
                                const stockIn = StockInData[i];
                                const availableSpace = stockIn.rawMaterialQty - stockIn.remainingStock; // Calculate the available space for the product

                                if (desiredQuantity <= availableSpace) {
                                    // If the desired quantity can fit completely in the current stock in entry
                                    stockIn.remainingStock += desiredQuantity;
                                    totalCost += desiredQuantity * stockIn.stockInPrice;
                                    break; // Exit the loop since the desired quantity has been inserted
                                } else {
                                    // If the desired quantity cannot fit completely in the current stock in entry
                                    stockIn.remainingStock = stockIn.rawMaterialQty;
                                    totalCost += availableSpace * stockIn.stockInPrice;
                                    desiredQuantity -= availableSpace;
                                }
                            }

                            console.log("Updated StockInData:", StockInData);
                            console.log("Total Cost of Filling: ", totalCost);

                            const sopq = StockInData.filter((obj) => {
                                if (obj.stockInQuantity != obj.rawMaterialQty) {
                                    return obj;
                                }
                            })

                            function generateUpdateQuery(data) {
                                let query = 'UPDATE factory_rmStockIn_data\nSET remainingQty = CASE\n';

                                data.forEach((item) => {
                                    const { rmStockInId, remainingStock } = item;
                                    query += `    WHEN rmStockInId = '${rmStockInId}' THEN ROUND(${remainingStock},2)\n`;
                                });

                                query += '    ELSE remainingQty\nEND\n';

                                const stockInIds = data.map((item) => `'${item.rmStockInId}'`).join(', ');
                                query += `WHERE rmStockInId IN (${stockInIds});`;

                                return query;
                            }
                            const sql_qurey_updatedRemainQty = generateUpdateQuery(sopq);
                            pool.query(sql_qurey_updatedRemainQty, (err, data) => {
                                if (err) {
                                    console.error("An error occurd in SQL Queery", err);
                                    return res.status(500).send('Database Error');
                                }
                                const sql_querry_removedetails = `DELETE FROM factory_rmStockOut_data WHERE rmStockOutId = '${rmStockOutId}'`;
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
            }
        })
    } catch (error) {
        console.error('An error occurd', error);
        res.status(500).send('Internal Server Error');
    }
}

// Fill StockOut Transaction API

const fillRmStockOutTransaction = (req, res) => {
    try {
        const rmStockOutId = req.query.rmStockOutId
        sql_querry_fillUser = `SELECT factory_rmStockOut_data.rawMaterialId FROM factory_rmStockOut_data 
                                WHERE rmStockOutId = '${rmStockOutId}'`;
        pool.query(sql_querry_fillUser, (err, data) => {
            if (err) {
                console.error("An error occurd in SQL Queery", err);
                return res.status(500).send('Database Error');
            }
            const rawMaterialId = data[0].rawMaterialId
            sql_get_remainStockWithdata = ` SELECT factory_rmStockOut_data.rawMaterialId, factory_rawMaterial_data.rawMaterialName, rmStockOutDisplayQty AS rawMaterialQty, rmStockOutDisplayUnit AS rawMaterialUnit, rmStockOutCategory, rmStockOutComment, rmStockOutDate FROM factory_rmStockOut_data 
                                                INNER JOIN factory_rawMaterial_data ON factory_rawMaterial_data.rawMaterialId = factory_rmStockOut_data.rawMaterialId
                                                WHERE rmStockOutId = '${rmStockOutId}';
                                            SELECT COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) AS remainingStock FROM factory_rawMaterial_data AS p
                                                                     LEFT JOIN
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
                                                                    ) AS so ON p.rawMaterialId = so.rawMaterialId
                                                                WHERE p.rawMaterialId = '${rawMaterialId}';
                                            SELECT isd.branchId AS branchId, bd.branchName AS branchName FROM inventory_stockIn_data AS isd
                                            INNER JOIN branch_data AS bd ON bd.branchId = isd.branchId
                                            WHERE stockInId = '${rmStockOutId}'`;
            pool.query(sql_get_remainStockWithdata, (err, data) => {
                if (err) {
                    console.error("An error occurd in SQL Queery", err);
                    return res.status(500).send('Database Error');
                }
                const stockOutData = data[0][0];
                const remainStock = data[1][0].remainingStock + data[0][0].rawMaterialQty;
                const fillData = {
                    ...stockOutData,
                    remainingStock: remainStock,
                    branchId: data && data[2].length ? data[2][0].branchId : null,
                    branchName: data && data[2].length ? data[2][0].branchName : null
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

const updateRmStockOutTransaction = async (req, res) => {
    try {
        let token;
        token = req.headers ? req.headers.authorization.split(" ")[1] : null;
        if (token) {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const userId = decoded.id.id;
            const uid1 = new Date();
            const stockOutHistoryId = String("modifiedSO_" + uid1.getTime());
            console.log("...", stockOutHistoryId);
            const rmStockOutId = req.body.rmStockOutId;
            const rawMaterialId = req.body.rawMaterialId;
            const rawMaterialQty = req.body.rawMaterialQty;
            const rawMaterialUnit = req.body.rawMaterialUnit.trim();
            const rmStockOutCategory = req.body.rmStockOutCategory.trim();
            const rmStockOutComment = req.body.rmStockOutComment ? req.body.rmStockOutComment.trim() : null;
            const rmStockOutDate = new Date(req.body.rmStockOutDate ? req.body.rmStockOutDate : "10/10/1001").toString().slice(4, 15);
            const isSupplyBranch = req.body.isSupplyBranch ? req.body.isSupplyBranch : false;
            const branchId = req.body.branchId ? req.body.branchId : '';
            const oldBrachName = req.body.oldBranchName ? req.body.oldBranchName : '';
            const billNumber = req.body.billNumber ? req.body.billNumber : '';
            const reason = req.body.reason ? req.body.reason : null;
            const currentModifyDate = new Date().toString().slice(4, 24)
            console.log('old', oldBrachName);
            if (!rawMaterialId || !rawMaterialQty || !rawMaterialUnit || !rmStockOutCategory || !rmStockOutDate || !reason) {
                return res.status(400).send("Please Fill all the feilds");
            }

            const sql_query_chkIdIsDeleteOrNot = `SELECT stockInId, productQty, remainingQty FROM inventory_stockIn_data WHERE stockInId = '${rmStockOutId}'`;
            pool.query(sql_query_chkIdIsDeleteOrNot, (err, chk) => {
                if (err) {
                    console.error("An error occurd in SQL Queery", err);
                    return res.status(500).send('Database Error');
                }
                const isStockInId = chk && chk[0] && chk[0].stockInId ? chk[0].stockInId : null;
                if (isStockInId) {
                    if (chk[0].productQty != chk[0].remainingQty) {
                        return res.status(400).send('You Can not Edit Transaction Because It is Used');
                    } else {
                        const sql_queries_getNeedData = `SELECT bigUnitName AS largerUnit, unitNumber AS value, smallUnitName AS smallerUnit FROM product_unit_preference WHERE productId = '${rawMaterialId}' ORDER BY product_unit_preference.priorityNumber ASC;
                                                         SELECT ipd.minProductUnit AS  minProductUnit, ipd.isExpired AS isExpired, ipd.expiredDays AS expiredDays FROM inventory_product_data AS ipd WHERE ipd.productId = '${rawMaterialId}'`;
                        pool.query(sql_queries_getNeedData, (err, result) => {
                            if (err) {
                                console.error("An error occurd in SQL Queery", err);
                                return res.status(500).send('Database Error');
                            }
                            const stockInneedData = {
                                unitsData: result && result[0] ? Object.values(JSON.parse(JSON.stringify(result[0]))) : null,
                                toUnit: result && result[1][0] && result[1][0].minProductUnit ? result[1][0].minProductUnit : null,
                                isExpired: result && result[1][0] && result[1][0].isExpired ? result[1][0].isExpired : 0,
                                expiredDays: result && result[1][0] && result[1][0].expiredDays ? result[1][0].expiredDays : 0
                            }

                            const StockInProductFinalQty = (stockInneedData.unitsData && stockInneedData.unitsData.length !== 0) ? convertUnits(stockInneedData.unitsData, rawMaterialQty, rawMaterialUnit, stockInneedData.toUnit) : rawMaterialQty;

                            const sql_queries_getNeedData = `SELECT bigUnitName AS largerUnit, unitNumber AS value, smallUnitName AS smallerUnit FROM factory_rmUnit_preference WHERE rawMaterialId = '${rawMaterialId}' ORDER BY factory_rmUnit_preference.priorityNumber ASC;
                                                             SELECT ipd.minRawMaterialUnit AS  minRawMaterialUnit, ipd.isExpired AS isExpired, ipd.expiredDays AS expiredDays FROM factory_rawMaterial_data AS ipd WHERE ipd.rawMaterialId = '${rawMaterialId}'`;
                            pool.query(sql_queries_getNeedData, (err, result) => {
                                if (err) {
                                    console.error("An error occurd in SQL Queery", err);
                                    return res.status(500).send('Database Error');
                                }
                                const needData = {
                                    unitsData: result && result[0] ? Object.values(JSON.parse(JSON.stringify(result[0]))) : null,
                                    toUnit: result && result[1][0] && result[1][0].minRawMaterialUnit ? result[1][0].minRawMaterialUnit : null,
                                    isExpired: result && result[1][0] && result[1][0].isExpired ? result[1][0].isExpired : 0,
                                    expiredDays: result && result[1][0] && result[1][0].expiredDays ? result[1][0].expiredDays : 0
                                }
                                console.log(needData.unitsData);
                                const productFinalQty = (needData.unitsData && needData.unitsData.length !== 0) ? convertUnits(needData.unitsData, rawMaterialQty, rawMaterialUnit, needData.toUnit) : rawMaterialQty;
                                get_remaining_stock = `SELECT COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) AS remainingStock FROM factory_rawMaterial_data AS p
                                             LEFT JOIN
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
                                            ) AS so ON p.rawMaterialId = so.rawMaterialId
                                        WHERE p.rawMaterialId = '${rawMaterialId}';
                                    SELECT rawMaterialQty FROM factory_rmStockOut_data WHERE rmStockOutId = '${rmStockOutId}'`;
                                pool.query(get_remaining_stock, (err, remaindata) => {
                                    if (err) {
                                        console.error("An error occurd in SQL Queery", err);
                                        return res.status(500).send('Database Error');
                                    }
                                    const remainStock = remaindata[0][0].remainingStock;
                                    const previousQty = remaindata[1][0].rawMaterialQty;
                                    console.log("./././", remainStock + previousQty);
                                    const remainIngUpdateStock = remainStock + previousQty;
                                    if (remainIngUpdateStock < productFinalQty) {
                                        return res.status(400).send(`You Can Not Stock Out more Then Remain Stock...!`);
                                    } else {
                                        const get_previous_data = `SELECT factory_rmStockOut_data.rawMaterialId, rawMaterialQty, rmStockOutDisplayQty, rmStockOutDisplayUnit, rmStockOutPrice, factory_rmStockOutCategory_data.stockOutCategoryName AS rmStockOutCategory, rmStockOutComment, DATE_FORMAT(rmStockOutDate,'%b %d %Y') AS rmStockOutDate, rmStockOutModificationDate FROM factory_rmStockOut_data
                                                                    INNER JOIN factory_rmStockOutCategory_data ON factory_rmStockOutCategory_data.stockOutCategoryId = factory_rmStockOut_data.rmStockOutCategory
                                                                    WHERE rmStockOutId = '${rmStockOutId}';
                                                                    SELECT factory_rmStockOutCategory_data.stockOutCategoryName FROM factory_rmStockOutCategory_data
                                                                    WHERE stockOutCategoryId = '${rmStockOutCategory}';
                                                                    SELECT branchName FROM branch_data WHERE branchId = '${branchId}'`;
                                        pool.query(get_previous_data, (err, data) => {
                                            if (err) {
                                                console.error("An error occurd in SQL Queery", err);
                                                return res.status(500).send('Database Error');
                                            }
                                            const previousStockOutPrice = data[0][0].rmStockOutPrice;
                                            const prevoiusQuantity = data[0][0].rawMaterialQty;
                                            const rmStockOutModificationDate = data[0][0].rmStockOutModificationDate ? new Date(data[0][0].rmStockOutModificationDate).toString().slice(4, 24) : new Date().toString().slice(4, 24);
                                            const previousData = {
                                                rawMaterialQty: data[0][0].rmStockOutDisplayQty + ' ' + data[0][0].rmStockOutDisplayUnit,
                                                rmStockOutCategory: data[0][0].rmStockOutCategory,
                                                rmStockOutComment: data[0][0].rmStockOutComment ? data[0][0].rmStockOutComment : null,
                                                rmStockOutDate: data[0][0].rmStockOutDate,
                                                branchName: oldBrachName ? oldBrachName : ''
                                            }
                                            const newData = {
                                                rawMaterialQty: req.body.rawMaterialQty + ' ' + req.body.rawMaterialUnit,
                                                rmStockOutCategory: data[1][0].stockOutCategoryName,
                                                rmStockOutComment: req.body.rmStockOutComment,
                                                rmStockOutDate: new Date(req.body.rmStockOutDate).toString().slice(4, 15),
                                                branchName: data[2][0].branchName ? data[2][0].branchName : ''
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
                                            // if (updatedField.includes('rawMaterialQty')) {
                                            //     previousData.rawMaterialQty = previousData.rawMaterialQty + ' ' + previousData.rawMaterialUnit;
                                            //     newData.rawMaterialQty = newData.rawMaterialQty + ' ' + rawMaterialUnit;
                                            //     console.log('chavda', newData);
                                            // }
                                            // else if (updatedField.includes('rawMaterialUnit')) {
                                            //     previousData.rawMaterialUnit = previousData.rawMaterialQty + ' ' + previousData.rawMaterialUnit;
                                            //     newData.rawMaterialUnit = newData.rawMaterialQty + ' ' + rawMaterialUnit;
                                            //     console.log('chavda else', newData);
                                            // }
                                            // console.log('parmar out', newData);
                                            if (updatedField == null || updatedField == '') {
                                                return res.status(500).send('No Change');
                                            }

                                            sql_querry_getStockIndetail = `SELECT rmStockInId, rawMaterialId, rawMaterialQty, rawMaterialPrice AS stockInPrice, remainingQty AS stockInQuantity FROM factory_rmStockIn_data WHERE factory_rmStockIn_data.rawMaterialId = '${rawMaterialId}' AND factory_rmStockIn_data.remainingQty != 0 ORDER BY rmStockInDate ASC;
                                                                           SELECT rmStockInId FROM factory_stockOutwiseStockInId_data WHERE rmStockOutId = '${rmStockOutId}'`;
                                            pool.query(sql_querry_getStockIndetail, (err, data) => {
                                                if (err) {
                                                    console.error("An error occurd in SQL Queery", err);
                                                    return res.status(500).send('Database Error');
                                                }
                                                console.log(">>>???", prevoiusQuantity);
                                                console.log(">>>", req.body.rawMaterialQty);
                                                console.log("jo loda", updatedField);
                                                if (prevoiusQuantity < productFinalQty) {
                                                    const orignalStockInData = Object.values(JSON.parse(JSON.stringify(data[0])));
                                                    const stockInData = Object.values(JSON.parse(JSON.stringify(data[0])));
                                                    const oldIdsArray = Object.values(JSON.parse(JSON.stringify(data[1])));
                                                    console.log(">>>", Object.values(JSON.parse(JSON.stringify(data[1]))));
                                                    console.log("::::::::", productFinalQty - prevoiusQuantity);
                                                    const stockOutData = [
                                                        { rawMaterialId: req.body.rawMaterialId, stockOutQuantity: productFinalQty - prevoiusQuantity }
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
                                                                const rmStockOutPrice = stockInPrice * quantityToUse;

                                                                totalStockOutPrice += rmStockOutPrice;
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
                                                    const rmStockOutPrice = Number(totalofStockOutPrice).toFixed(2);

                                                    const sopq = stockInData.filter((obj) => {
                                                        if (obj.stockInQuantity != obj.rawMaterialQty) {
                                                            return obj;
                                                        }
                                                    })

                                                    const sowsiId = sopq.map((obj) => {
                                                        if (obj.stockInQuantity != obj.rawMaterialQty) {
                                                            return obj.rmStockInId;
                                                        }
                                                    });

                                                    const oldId = oldIdsArray.map((obj) => {
                                                        return obj.rmStockInId;
                                                    });

                                                    const similarStockInIds = sowsiId.filter(id => oldId.includes(id));

                                                    const removeSameId = sowsiId.filter(id => !similarStockInIds.includes(id));

                                                    console.log('jojojojojo', removeSameId);

                                                    if (similarStockInIds.length != 0) {
                                                        const remainingStockByIds = similarStockInIds.map(rmStockInId => {
                                                            const stockIn = orignalStockInData.find(item => item.rmStockInId === rmStockInId);
                                                            return stockIn ? stockIn.stockInQuantity : undefined;
                                                        });

                                                        const remainingStockByIds1 = similarStockInIds.map(rmStockInId => {
                                                            const stockIn = stockInData.find(item => item.rmStockInId === rmStockInId);
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
                                                        sql_qurey_updateExistingId = `UPDATE factory_stockOutwiseStockInId_data SET cutRmQty = cutRmQty + ${remainStockCutQty[0]} WHERE rmStockOutId = '${rmStockOutId}' AND rmStockInId = '${similarStockInIds[0]}'`;
                                                        pool.query(sql_qurey_updateExistingId, (err, result) => {
                                                            if (err) {
                                                                console.error("An error occurd in SQL Queery", err);
                                                                return res.status(500).send('Database Error');
                                                            }
                                                            console.log('Existing Data Updated SuccessFully');
                                                        })
                                                    }

                                                    if (removeSameId.length != 0) {
                                                        const remainingStockByIds = removeSameId.map(rmStockInId => {
                                                            const stockIn = orignalStockInData.find(item => item.rmStockInId === rmStockInId);
                                                            return stockIn ? stockIn.stockInQuantity : undefined;
                                                        });

                                                        const remainingStockByIds1 = removeSameId.map(rmStockInId => {
                                                            const stockIn = stockInData.find(item => item.rmStockInId === rmStockInId);
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
                                                        const combinedData = removeSameId.map((id, index) => `('${rmStockOutId}','${id}',ROUND(${remainStockCutQty[index]},2))`);

                                                        // Join the array elements into a single string
                                                        const stockOutWiseStockInId = combinedData.join(',');

                                                        // Output the resulting string
                                                        console.log(stockOutWiseStockInId);

                                                        sql_querry_addsowsiId = `INSERT INTO factory_stockOutwiseStockInId_data (rmStockOutId, rmStockInId, cutRmQty) VALUES ${stockOutWiseStockInId}`;
                                                        pool.query(sql_querry_addsowsiId, (err, data) => {
                                                            if (err) {
                                                                console.error("An error occurd in SQL Queery", err);
                                                                return res.status(500).send('Database Error');
                                                            }
                                                            console.log("Data Added Successfully");
                                                        })
                                                    }

                                                    function generateUpdateQuery(data) {
                                                        let query = 'UPDATE factory_rmStockIn_data\nSET remainingQty = CASE\n';

                                                        data.forEach((item) => {
                                                            const { rmStockInId, stockInQuantity } = item;
                                                            query += `    WHEN rmStockInId = '${rmStockInId}' THEN ROUND(${stockInQuantity},2)\n`;
                                                        });

                                                        query += '    ELSE remainingQty\nEND\n';

                                                        const stockInIds = data.map((item) => `'${item.rmStockInId}'`).join(', ');
                                                        query += `WHERE rmStockInId IN (${stockInIds});`;

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
                                                                    string = "(" + "'" + rmStockOutId + "'" + "," + "'" + userId + "'" + "," + "'" + rawMaterialId + "'" + "," + "'" + previousData[data] + "'" + "," + "'" + newData[data] + "'" + "," + "'" + reason + "'" + "," + "STR_TO_DATE('" + rmStockOutModificationDate + "','%b %d %Y %H:%i:%s')" + "," + "STR_TO_DATE('" + currentModifyDate + "','%b %d %Y %H:%i:%s')" + ")";
                                                                else
                                                                    string = string + ",(" + "'" + rmStockOutId + "'" + "," + "'" + userId + "'" + "," + "'" + rawMaterialId + "'" + "," + "'" + previousData[data] + "'" + "," + "'" + newData[data] + "'" + "," + "'" + reason + "'" + "," + "STR_TO_DATE('" + rmStockOutModificationDate + "','%b %d %Y %H:%i:%s')" + "," + "STR_TO_DATE('" + currentModifyDate + "','%b %d %Y %H:%i:%s')" + ")";
                                                            });
                                                            return string;
                                                        }

                                                        console.log(">>>>>>>><<<<<<<<<", editFields());
                                                        const sql_querry_addPreviousData = `INSERT INTO factory_rmModified_history  (
                                                                                                rmStockOutId,
                                                                                                userId,
                                                                                                rawMaterialId,
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
                                                            console.log(">?>?>?>?,,,", rmStockOutCategory);
                                                            const sql_querry_updatedetails = `UPDATE factory_rmStockOut_data SET 
                                                                                                      userId = '${userId}',
                                                                                                      rawMaterialId = '${rawMaterialId}',
                                                                                                      rawMaterialQty = ${productFinalQty},
                                                                                                      rmStockOutPrice = ${rmStockOutPrice},
                                                                                                      rmStockOutDisplayQty = ${rawMaterialQty},
                                                                                                      rmStockOutDisplayUnit = '${rawMaterialUnit}',
                                                                                                      rmStockOutCategory = '${rmStockOutCategory}',
                                                                                                      rmStockOutComment = NULLIF('${rmStockOutComment}','null'),
                                                                                                      rmStockOutDate = STR_TO_DATE('${rmStockOutDate}','%b %d %Y') 
                                                                                                WHERE rmStockOutId = '${rmStockOutId}';
                                                                                                UPDATE inventory_stockIn_data SET
                                                                                                      branchId = '${branchId}',
                                                                                                      userId = '${userId}',
                                                                                                      productId = '${rawMaterialId}',
                                                                                                      productQty = ${StockInProductFinalQty},
                                                                                                      productPrice = ${rmStockOutPrice / StockInProductFinalQty},
                                                                                                      totalPrice = ${rmStockOutPrice},
                                                                                                      billNumber = ${billNumber ? `'${billNumber}'` : null},
                                                                                                      stockInDisplayQty = ${rawMaterialQty},
                                                                                                      stockInDisplayUnit = '${rawMaterialUnit}',
                                                                                                      supplierId = '${process.env.RAJ_MANDIR_FACTORY_ID}',
                                                                                                      stockInPaymentMethod = 'cash',
                                                                                                      stockInComment = ${rmStockOutComment ? `'${rmStockOutComment}'` : null},
                                                                                                      productExpiryDate = ${stockInneedData && stockInneedData.isExpired && stockInneedData.expiredDays > 0 ? `DATE_ADD(STR_TO_DATE('${rmStockOutDate}','%b %d %Y'), INTERVAL ${stockInneedData.expiredDays} DAY)` : null},
                                                                                                      remainingQty = ${StockInProductFinalQty},
                                                                                                      stockInDate = STR_TO_DATE('${rmStockOutDate}','%b %d %Y') 
                                                                                                WHERE stockInId = '${rmStockOutId}'`;
                                                            pool.query(sql_querry_updatedetails, (err, data) => {
                                                                if (err) {
                                                                    console.error("An error occurd in SQL Queery", err);
                                                                    return res.status(500).send('Database Error');
                                                                }
                                                                return res.status(200).send("Transaction Updated Successfully");
                                                            })
                                                        })
                                                    })
                                                } else if (req.body.rawMaterialQty == 0) {
                                                    return res.status(401).send('Please Delete Transaction');
                                                } else if (prevoiusQuantity > productFinalQty) {
                                                    console.log('222222222222', prevoiusQuantity, productFinalQty, prevoiusQuantity > productFinalQty)
                                                    sql_get_sowsoid = `SELECT
                                                                        factory_rmStockIn_data.rmStockInId,
                                                                        rawMaterialId,
                                                                        (
                                                                            factory_rmStockIn_data.remainingQty + sowsid.cutRmQty
                                                                        ) AS rawMaterialQty,
                                                                        rawMaterialPrice AS stockInPrice,
                                                                        remainingQty AS remainingStock
                                                                    FROM
                                                                        factory_rmStockIn_data
                                                                    INNER JOIN(
                                                                        SELECT
                                                                            factory_stockOutwiseStockInId_data.rmStockInId,
                                                                            factory_stockOutwiseStockInId_data.cutRmQty AS cutRmQty
                                                                        FROM
                                                                            factory_stockOutwiseStockInId_data
                                                                        WHERE
                                                                            factory_stockOutwiseStockInId_data.rmStockOutId = '${rmStockOutId}'
                                                                    ) AS sowsid
                                                                    ON
                                                                        factory_rmStockIn_data.rmStockInId = sowsid.rmStockInId
                                                                    WHERE
                                                                        factory_rmStockIn_data.rmStockInId IN(
                                                                        SELECT
                                                                            COALESCE(
                                                                                factory_stockOutwiseStockInId_data.rmStockInId,
                                                                                NULL
                                                                            )
                                                                        FROM
                                                                            factory_stockOutwiseStockInId_data
                                                                        WHERE
                                                                            rmStockOutId = '${rmStockOutId}'
                                                                    )
                                                                    ORDER BY
                                                                        stockInCreationDate ASC`;
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
                                                            { rawMaterialId: req.body.rawMaterialId, stockOutQuantity: prevoiusQuantity - productFinalQty }
                                                        ];

                                                        // const StockInData = [
                                                        //     { rawMaterialId: 1, remainingStock: 5, rawMaterialQty: 5, stockInPrice: 70 },
                                                        //     { rawMaterialId: 1, remainingStock: 5, rawMaterialQty: 5, stockInPrice: 60 },
                                                        //     { rawMaterialId: 1, remainingStock: 2, rawMaterialQty: 5, stockInPrice: 50 },
                                                        //     { rawMaterialId: 1, remainingStock: 0, rawMaterialQty: 5, stockInPrice: 40 },
                                                        //     { rawMaterialId: 1, remainingStock: 0, rawMaterialQty: 5, stockInPrice: 30 },
                                                        // ];

                                                        let desiredQuantity = stockOutData[0].stockOutQuantity; // Desired quantity to be inserted into the buckets
                                                        console.log("><?", desiredQuantity);
                                                        let totalCost = 0; // Total cost of filling the buckets

                                                        for (let i = 0; i < StockInData.length; i++) {
                                                            const stockIn = StockInData[i];
                                                            const availableSpace = stockIn.rawMaterialQty - stockIn.remainingStock; // Calculate the available space for the product

                                                            if (desiredQuantity <= availableSpace) {
                                                                // If the desired quantity can fit completely in the current stock in entry
                                                                stockIn.remainingStock += desiredQuantity;
                                                                totalCost += desiredQuantity * stockIn.stockInPrice;
                                                                break; // Exit the loop since the desired quantity has been inserted
                                                            } else {
                                                                // If the desired quantity cannot fit completely in the current stock in entry
                                                                stockIn.remainingStock = stockIn.rawMaterialQty;
                                                                totalCost += availableSpace * stockIn.stockInPrice;
                                                                desiredQuantity -= availableSpace;
                                                            }
                                                        }
                                                        const updatedStockInData = StockInData;
                                                        console.log("Updated StockInData:", StockInData);
                                                        console.log("Total Cost of Filling: ", totalCost);

                                                        const totalofStockOutPrice = previousStockOutPrice - totalCost;
                                                        const rmStockOutPrice = Number(totalofStockOutPrice).toFixed(2);

                                                        const sopq = StockInData.filter((obj) => {
                                                            return obj;
                                                        })
                                                        const sowsiId = StockInData.map((obj) => {
                                                            return obj.rmStockInId;
                                                        })
                                                        const remainingStockByIds = sowsiId.map(rmStockInId => {
                                                            const stockIn = junoJson.find(item => item.rmStockInId === rmStockInId);
                                                            return stockIn ? stockIn.rawMaterialQty : undefined;
                                                        });

                                                        const remainingStockByIds1 = sowsiId.map(rmStockInId => {
                                                            const stockIn = updatedStockInData.find(item => item.rmStockInId === rmStockInId);
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

                                                        const combinedData = filteredId.map((id, index) => `('${rmStockOutId}','${id}',ROUND(${filteredQty[index]},2))`);

                                                        // Join the array elements into a single string
                                                        const stockOutWiseStockInId = combinedData.join(',');

                                                        // Output the resulting string
                                                        console.log(stockOutWiseStockInId);

                                                        function generateUpdateQuery(data) {
                                                            let query = 'UPDATE factory_rmStockIn_data\nSET remainingQty = CASE\n';

                                                            data.forEach((item) => {
                                                                const { rmStockInId, remainingStock } = item;
                                                                query += `    WHEN rmStockInId = '${rmStockInId}' THEN ROUND(${remainingStock},2)\n`;
                                                            });

                                                            query += '    ELSE remainingQty\nEND\n';

                                                            const stockInIds = data.map((item) => `'${item.rmStockInId}'`).join(', ');
                                                            query += `WHERE rmStockInId IN (${stockInIds})`;

                                                            return query;
                                                        }

                                                        console.log(generateUpdateQuery(sopq))
                                                        const sql_qurey_updatedRemainQty = `${generateUpdateQuery(sopq)};
                                                                        DELETE FROM factory_stockOutwiseStockInId_data WHERE rmStockOutId = '${rmStockOutId}';
                                                                        INSERT INTO factory_stockOutwiseStockInId_data (rmStockOutId, rmStockInId, cutRmQty) VALUES ${stockOutWiseStockInId}`;
                                                        pool.query(sql_qurey_updatedRemainQty, (err, data) => {
                                                            if (err) {
                                                                console.error("An error occurd in SQL Queery", err);
                                                                return res.status(500).send('Database Error');
                                                            }
                                                            const editFields = () => {
                                                                var string = ''
                                                                updatedField.forEach((data, index) => {
                                                                    if (index == 0)
                                                                        string = "(" + "'" + rmStockOutId + "'" + "," + "'" + userId + "'" + "," + "'" + rawMaterialId + "'" + "," + "'" + previousData[data] + "'" + "," + "'" + newData[data] + "'" + "," + "'" + reason + "'" + "," + "STR_TO_DATE('" + rmStockOutModificationDate + "','%b %d %Y %H:%i:%s')" + "," + "STR_TO_DATE('" + currentModifyDate + "','%b %d %Y %H:%i:%s')" + ")";
                                                                    else
                                                                        string = string + ",(" + "'" + rmStockOutId + "'" + "," + "'" + userId + "'" + "," + "'" + rawMaterialId + "'" + "," + "'" + previousData[data] + "'" + "," + "'" + newData[data] + "'" + "," + "'" + reason + "'" + "," + "STR_TO_DATE('" + rmStockOutModificationDate + "','%b %d %Y %H:%i:%s')" + "," + "STR_TO_DATE('" + currentModifyDate + "','%b %d %Y %H:%i:%s')" + ")";
                                                                });
                                                                return string;
                                                            }

                                                            console.log(">>>>>>>><<<<<<<<<", editFields());
                                                            const sql_querry_addPreviousData = `INSERT INTO factory_rmModified_history  (
                                                                                                rmStockOutId,
                                                                                                userId,
                                                                                                rawMaterialId,
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
                                                                console.log(">?>?>?>?,,,", rmStockOutCategory);
                                                                const sql_querry_updatedetails = `UPDATE factory_rmStockOut_data SET
                                                                                         userId = '${userId}',
                                                                                         rawMaterialId = '${rawMaterialId}',
                                                                                         rawMaterialQty = ${productFinalQty},
                                                                                         rmStockOutPrice = ${rmStockOutPrice},
                                                                                         rmStockOutDisplayQty = ${rawMaterialQty},
                                                                                         rmStockOutDisplayUnit = '${rawMaterialUnit}',
                                                                                         rmStockOutCategory = '${rmStockOutCategory}',
                                                                                         rmStockOutComment = NULLIF('${rmStockOutComment}','null'),
                                                                                         rmStockOutDate = STR_TO_DATE('${rmStockOutDate}','%b %d %Y') 
                                                                                   WHERE rmStockOutId = '${rmStockOutId}';
                                                                                   UPDATE inventory_stockIn_data SET
                                                                                                      branchId = '${branchId}',
                                                                                                      userId = '${userId}',
                                                                                                      productId = '${rawMaterialId}',
                                                                                                      productQty = ${StockInProductFinalQty},
                                                                                                      productPrice = ${rmStockOutPrice / StockInProductFinalQty},
                                                                                                      totalPrice = ${rmStockOutPrice},
                                                                                                      billNumber = ${billNumber ? `'${billNumber}'` : null},
                                                                                                      stockInDisplayQty = ${rawMaterialQty},
                                                                                                      stockInDisplayUnit = '${rawMaterialUnit}',
                                                                                                      supplierId = '${process.env.RAJ_MANDIR_FACTORY_ID}',
                                                                                                      stockInPaymentMethod = 'cash',
                                                                                                      stockInComment = ${rmStockOutComment ? `'${rmStockOutComment}'` : null},
                                                                                                      productExpiryDate = ${stockInneedData && stockInneedData.isExpired && stockInneedData.expiredDays > 0 ? `DATE_ADD(STR_TO_DATE('${rmStockOutDate}','%b %d %Y'), INTERVAL ${stockInneedData.expiredDays} DAY)` : null},
                                                                                                      remainingQty = ${StockInProductFinalQty},
                                                                                                      stockInDate = STR_TO_DATE('${rmStockOutDate}','%b %d %Y') 
                                                                                                WHERE stockInId = '${rmStockOutId}'`;
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
                                                                string = "(" + "'" + rmStockOutId + "'" + "," + "'" + userId + "'" + "," + "'" + rawMaterialId + "'" + "," + "'" + previousData[data] + "'" + "," + "'" + newData[data] + "'" + "," + "'" + reason + "'" + "," + "STR_TO_DATE('" + rmStockOutModificationDate + "','%b %d %Y %H:%i:%s')" + "," + "STR_TO_DATE('" + currentModifyDate + "','%b %d %Y %H:%i:%s')" + ")";
                                                            else
                                                                string = string + ",(" + "'" + rmStockOutId + "'" + "," + "'" + userId + "'" + "," + "'" + rawMaterialId + "'" + "," + "'" + previousData[data] + "'" + "," + "'" + newData[data] + "'" + "," + "'" + reason + "'" + "," + "STR_TO_DATE('" + rmStockOutModificationDate + "','%b %d %Y %H:%i:%s')" + "," + "STR_TO_DATE('" + currentModifyDate + "','%b %d %Y %H:%i:%s')" + ")";
                                                        });
                                                        return string;
                                                    }

                                                    console.log(">>>>>>>><<<<<<<<<", editFields());
                                                    const sql_querry_addPreviousData = `INSERT INTO factory_rmModified_history  (
                                                                                                rmStockOutId,
                                                                                                userId,
                                                                                                rawMaterialId,
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
                                                        console.log("Avyuuuuuuu", branchId);
                                                        const sql_querry_updatedetails = `UPDATE factory_rmStockOut_data SET 
                                                                                                      userId = '${userId}',
                                                                                                      rawMaterialId = '${rawMaterialId}',
                                                                                                      rawMaterialQty = ${productFinalQty},
                                                                                                      rmStockOutDisplayQty = ${rawMaterialQty},
                                                                                                      rmStockOutDisplayUnit = '${rawMaterialUnit}',
                                                                                                      rmStockOutCategory = '${rmStockOutCategory}',
                                                                                                      rmStockOutComment = NULLIF('${rmStockOutComment}','null'),
                                                                                                      rmStockOutDate = STR_TO_DATE('${rmStockOutDate}','%b %d %Y') 
                                                                                   WHERE rmStockOutId = '${rmStockOutId}';
                                                                                   UPDATE inventory_stockIn_data SET
                                                                                                      branchId = '${branchId}',
                                                                                                      userId = '${userId}',
                                                                                                      productId = '${rawMaterialId}',
                                                                                                      productQty = ${StockInProductFinalQty},
                                                                                                      billNumber = ${billNumber ? `'${billNumber}'` : null},
                                                                                                      stockInDisplayQty = ${rawMaterialQty},
                                                                                                      stockInDisplayUnit = '${rawMaterialUnit}',
                                                                                                      supplierId = '${process.env.RAJ_MANDIR_FACTORY_ID}',
                                                                                                      stockInPaymentMethod = 'cash',
                                                                                                      stockInComment = ${rmStockOutComment ? `'${rmStockOutComment}'` : null},
                                                                                                      productExpiryDate = ${stockInneedData && stockInneedData.isExpired && stockInneedData.expiredDays > 0 ? `DATE_ADD(STR_TO_DATE('${rmStockOutDate}','%b %d %Y'), INTERVAL ${stockInneedData.expiredDays} DAY)` : null},
                                                                                                      remainingQty = ${StockInProductFinalQty},
                                                                                                      stockInDate = STR_TO_DATE('${rmStockOutDate}','%b %d %Y') 
                                                                                                WHERE stockInId = '${rmStockOutId}'`;
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
                        })
                    }
                } else {
                    const sql_queries_getNeedData = `SELECT bigUnitName AS largerUnit, unitNumber AS value, smallUnitName AS smallerUnit FROM factory_rmUnit_preference WHERE rawMaterialId = '${rawMaterialId}' ORDER BY factory_rmUnit_preference.priorityNumber ASC;
                                                     SELECT ipd.minRawMaterialUnit AS  minRawMaterialUnit, ipd.isExpired AS isExpired, ipd.expiredDays AS expiredDays FROM factory_rawMaterial_data AS ipd WHERE ipd.rawMaterialId = '${rawMaterialId}'`;
                    pool.query(sql_queries_getNeedData, (err, result) => {
                        if (err) {
                            console.error("An error occurd in SQL Queery", err);
                            return res.status(500).send('Database Error');
                        }
                        const needData = {
                            unitsData: result && result[0] ? Object.values(JSON.parse(JSON.stringify(result[0]))) : null,
                            toUnit: result && result[1][0] && result[1][0].minRawMaterialUnit ? result[1][0].minRawMaterialUnit : null,
                            isExpired: result && result[1][0] && result[1][0].isExpired ? result[1][0].isExpired : 0,
                            expiredDays: result && result[1][0] && result[1][0].expiredDays ? result[1][0].expiredDays : 0
                        }
                        console.log(needData.unitsData);
                        const productFinalQty = (needData.unitsData && needData.unitsData.length !== 0) ? convertUnits(needData.unitsData, rawMaterialQty, rawMaterialUnit, needData.toUnit) : rawMaterialQty;
                        get_remaining_stock = `SELECT COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) AS remainingStock FROM factory_rawMaterial_data AS p
                                             LEFT JOIN
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
                                            ) AS so ON p.rawMaterialId = so.rawMaterialId
                                        WHERE p.rawMaterialId = '${rawMaterialId}';
                                    SELECT rawMaterialQty FROM factory_rmStockOut_data WHERE rmStockOutId = '${rmStockOutId}'`;
                        pool.query(get_remaining_stock, (err, remaindata) => {
                            if (err) {
                                console.error("An error occurd in SQL Queery", err);
                                return res.status(500).send('Database Error');
                            }
                            const remainStock = remaindata[0][0].remainingStock;
                            const previousQty = remaindata[1][0].rawMaterialQty;
                            console.log("./././", remainStock + previousQty);
                            const remainIngUpdateStock = remainStock + previousQty;
                            if (remainIngUpdateStock < productFinalQty) {
                                return res.status(400).send(`You Can Not Stock Out more Then Remain Stock...!`);
                            } else {
                                const get_previous_data = `SELECT factory_rmStockOut_data.rawMaterialId, rawMaterialQty, rmStockOutDisplayQty, rmStockOutDisplayUnit, rmStockOutPrice, factory_rmStockOutCategory_data.stockOutCategoryName AS rmStockOutCategory, rmStockOutComment, DATE_FORMAT(rmStockOutDate,'%b %d %Y') AS rmStockOutDate, rmStockOutModificationDate FROM factory_rmStockOut_data
                                                    INNER JOIN factory_rmStockOutCategory_data ON factory_rmStockOutCategory_data.stockOutCategoryId = factory_rmStockOut_data.rmStockOutCategory
                                                    WHERE rmStockOutId = '${rmStockOutId}';
                                                    SELECT factory_rmStockOutCategory_data.stockOutCategoryName FROM factory_rmStockOutCategory_data
                                                    WHERE stockOutCategoryId = '${rmStockOutCategory}'`;
                                pool.query(get_previous_data, (err, data) => {
                                    if (err) {
                                        console.error("An error occurd in SQL Queery", err);
                                        return res.status(500).send('Database Error');
                                    }
                                    const previousStockOutPrice = data[0][0].rmStockOutPrice;
                                    const prevoiusQuantity = data[0][0].rawMaterialQty;
                                    const rmStockOutModificationDate = data[0][0].rmStockOutModificationDate ? new Date(data[0][0].rmStockOutModificationDate).toString().slice(4, 24) : new Date().toString().slice(4, 24);
                                    const previousData = {
                                        rawMaterialQty: data[0][0].rmStockOutDisplayQty + ' ' + data[0][0].rmStockOutDisplayUnit,
                                        rmStockOutCategory: data[0][0].rmStockOutCategory,
                                        rmStockOutComment: data[0][0].rmStockOutComment ? data[0][0].rmStockOutComment : null,
                                        rmStockOutDate: data[0][0].rmStockOutDate,
                                    }
                                    const newData = {
                                        rawMaterialQty: req.body.rawMaterialQty + ' ' + req.body.rawMaterialUnit,
                                        rmStockOutCategory: data[1][0].stockOutCategoryName,
                                        rmStockOutComment: req.body.rmStockOutComment,
                                        rmStockOutDate: new Date(req.body.rmStockOutDate).toString().slice(4, 15)
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

                                    if (updatedField == null || updatedField == '') {
                                        return res.status(500).send('No Change');
                                    }

                                    sql_querry_getStockIndetail = `SELECT rmStockInId, rawMaterialId, rawMaterialQty, rawMaterialPrice AS stockInPrice, remainingQty AS stockInQuantity FROM factory_rmStockIn_data WHERE factory_rmStockIn_data.rawMaterialId = '${rawMaterialId}' AND factory_rmStockIn_data.remainingQty != 0 ORDER BY rmStockInDate ASC;
                                                                   SELECT rmStockInId FROM factory_stockOutwiseStockInId_data WHERE rmStockOutId = '${rmStockOutId}'`;
                                    pool.query(sql_querry_getStockIndetail, (err, data) => {
                                        if (err) {
                                            console.error("An error occurd in SQL Queery", err);
                                            return res.status(500).send('Database Error');
                                        }
                                        console.log(">>>???", prevoiusQuantity);
                                        console.log(">>>", req.body.rawMaterialQty);
                                        console.log("jo loda", updatedField);
                                        if (prevoiusQuantity < productFinalQty) {
                                            const orignalStockInData = Object.values(JSON.parse(JSON.stringify(data[0])));
                                            const stockInData = Object.values(JSON.parse(JSON.stringify(data[0])));
                                            const oldIdsArray = Object.values(JSON.parse(JSON.stringify(data[1])));
                                            console.log(">>>", Object.values(JSON.parse(JSON.stringify(data[1]))));
                                            console.log("::::::::", productFinalQty - prevoiusQuantity);
                                            const stockOutData = [
                                                { rawMaterialId: req.body.rawMaterialId, stockOutQuantity: productFinalQty - prevoiusQuantity }
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
                                                        const rmStockOutPrice = stockInPrice * quantityToUse;

                                                        totalStockOutPrice += rmStockOutPrice;
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
                                            const rmStockOutPrice = Number(totalofStockOutPrice).toFixed(2);

                                            const sopq = stockInData.filter((obj) => {
                                                if (obj.stockInQuantity != obj.rawMaterialQty) {
                                                    return obj;
                                                }
                                            })

                                            const sowsiId = sopq.map((obj) => {
                                                if (obj.stockInQuantity != obj.rawMaterialQty) {
                                                    return obj.rmStockInId;
                                                }
                                            });

                                            const oldId = oldIdsArray.map((obj) => {
                                                return obj.rmStockInId;
                                            });

                                            const similarStockInIds = sowsiId.filter(id => oldId.includes(id));

                                            const removeSameId = sowsiId.filter(id => !similarStockInIds.includes(id));

                                            console.log('jojojojojo', removeSameId);

                                            if (similarStockInIds.length != 0) {
                                                const remainingStockByIds = similarStockInIds.map(rmStockInId => {
                                                    const stockIn = orignalStockInData.find(item => item.rmStockInId === rmStockInId);
                                                    return stockIn ? stockIn.stockInQuantity : undefined;
                                                });

                                                const remainingStockByIds1 = similarStockInIds.map(rmStockInId => {
                                                    const stockIn = stockInData.find(item => item.rmStockInId === rmStockInId);
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
                                                sql_qurey_updateExistingId = `UPDATE factory_stockOutwiseStockInId_data SET cutRmQty = cutRmQty + ${remainStockCutQty[0]} WHERE rmStockOutId = '${rmStockOutId}' AND rmStockInId = '${similarStockInIds[0]}'`;
                                                pool.query(sql_qurey_updateExistingId, (err, result) => {
                                                    if (err) {
                                                        console.error("An error occurd in SQL Queery", err);
                                                        return res.status(500).send('Database Error');
                                                    }
                                                    console.log('Existing Data Updated SuccessFully');
                                                })
                                            }

                                            if (removeSameId.length != 0) {
                                                const remainingStockByIds = removeSameId.map(rmStockInId => {
                                                    const stockIn = orignalStockInData.find(item => item.rmStockInId === rmStockInId);
                                                    return stockIn ? stockIn.stockInQuantity : undefined;
                                                });

                                                const remainingStockByIds1 = removeSameId.map(rmStockInId => {
                                                    const stockIn = stockInData.find(item => item.rmStockInId === rmStockInId);
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
                                                const combinedData = removeSameId.map((id, index) => `('${rmStockOutId}','${id}',ROUND(${remainStockCutQty[index]},2))`);

                                                // Join the array elements into a single string
                                                const stockOutWiseStockInId = combinedData.join(',');

                                                // Output the resulting string
                                                console.log(stockOutWiseStockInId);

                                                sql_querry_addsowsiId = `INSERT INTO factory_stockOutwiseStockInId_data (rmStockOutId, rmStockInId, cutRmQty) VALUES ${stockOutWiseStockInId}`;
                                                pool.query(sql_querry_addsowsiId, (err, data) => {
                                                    if (err) {
                                                        console.error("An error occurd in SQL Queery", err);
                                                        return res.status(500).send('Database Error');
                                                    }
                                                    console.log("Data Added Successfully");
                                                })
                                            }

                                            function generateUpdateQuery(data) {
                                                let query = 'UPDATE factory_rmStockIn_data\nSET remainingQty = CASE\n';

                                                data.forEach((item) => {
                                                    const { rmStockInId, stockInQuantity } = item;
                                                    query += `    WHEN rmStockInId = '${rmStockInId}' THEN ROUND(${stockInQuantity},2)\n`;
                                                });

                                                query += '    ELSE remainingQty\nEND\n';

                                                const stockInIds = data.map((item) => `'${item.rmStockInId}'`).join(', ');
                                                query += `WHERE rmStockInId IN (${stockInIds});`;

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
                                                            string = "(" + "'" + rmStockOutId + "'" + "," + "'" + userId + "'" + "," + "'" + rawMaterialId + "'" + "," + "'" + previousData[data] + "'" + "," + "'" + newData[data] + "'" + "," + "'" + reason + "'" + "," + "STR_TO_DATE('" + rmStockOutModificationDate + "','%b %d %Y %H:%i:%s')" + "," + "STR_TO_DATE('" + currentModifyDate + "','%b %d %Y %H:%i:%s')" + ")";
                                                        else
                                                            string = string + ",(" + "'" + rmStockOutId + "'" + "," + "'" + userId + "'" + "," + "'" + rawMaterialId + "'" + "," + "'" + previousData[data] + "'" + "," + "'" + newData[data] + "'" + "," + "'" + reason + "'" + "," + "STR_TO_DATE('" + rmStockOutModificationDate + "','%b %d %Y %H:%i:%s')" + "," + "STR_TO_DATE('" + currentModifyDate + "','%b %d %Y %H:%i:%s')" + ")";
                                                    });
                                                    return string;
                                                }

                                                console.log(">>>>>>>><<<<<<<<<", editFields());
                                                const sql_querry_addPreviousData = `INSERT INTO factory_rmModified_history  (
                                                                                                rmStockOutId,
                                                                                                userId,
                                                                                                rawMaterialId,
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
                                                    console.log(">?>?>?>?,,,", rmStockOutCategory);
                                                    const sql_querry_updatedetails = `UPDATE factory_rmStockOut_data SET 
                                                                                                      userId = '${userId}',
                                                                                                      rawMaterialId = '${rawMaterialId}',
                                                                                                      rawMaterialQty = ${productFinalQty},
                                                                                                      rmStockOutPrice = ${rmStockOutPrice},
                                                                                                      rmStockOutDisplayQty = ${rawMaterialQty},
                                                                                                      rmStockOutDisplayUnit = '${rawMaterialUnit}',
                                                                                                      rmStockOutCategory = '${rmStockOutCategory}',
                                                                                                      rmStockOutComment = NULLIF('${rmStockOutComment}','null'),
                                                                                                      rmStockOutDate = STR_TO_DATE('${rmStockOutDate}','%b %d %Y') 
                                                                                                WHERE rmStockOutId = '${rmStockOutId}'`;
                                                    pool.query(sql_querry_updatedetails, (err, data) => {
                                                        if (err) {
                                                            console.error("An error occurd in SQL Queery", err);
                                                            return res.status(500).send('Database Error');
                                                        }
                                                        return res.status(200).send("Transaction Updated Successfully");
                                                    })
                                                })
                                            })
                                        } else if (req.body.rawMaterialQty == 0) {
                                            return res.status(401).send('Please Delete Transaction');
                                        } else if (prevoiusQuantity > productFinalQty) {
                                            console.log('222222222222', prevoiusQuantity, productFinalQty, prevoiusQuantity > productFinalQty)
                                            sql_get_sowsoid = `SELECT
                                                    factory_rmStockIn_data.rmStockInId,
                                                    rawMaterialId,
                                                    (
                                                        factory_rmStockIn_data.remainingQty + sowsid.cutRmQty
                                                    ) AS rawMaterialQty,
                                                    rawMaterialPrice AS stockInPrice,
                                                    remainingQty AS remainingStock
                                                FROM
                                                    factory_rmStockIn_data
                                                INNER JOIN(
                                                    SELECT
                                                        factory_stockOutwiseStockInId_data.rmStockInId,
                                                        factory_stockOutwiseStockInId_data.cutRmQty AS cutRmQty
                                                    FROM
                                                        factory_stockOutwiseStockInId_data
                                                    WHERE
                                                        factory_stockOutwiseStockInId_data.rmStockOutId = '${rmStockOutId}'
                                                ) AS sowsid
                                                ON
                                                    factory_rmStockIn_data.rmStockInId = sowsid.rmStockInId
                                                WHERE
                                                    factory_rmStockIn_data.rmStockInId IN(
                                                    SELECT
                                                        COALESCE(
                                                            factory_stockOutwiseStockInId_data.rmStockInId,
                                                            NULL
                                                        )
                                                    FROM
                                                        factory_stockOutwiseStockInId_data
                                                    WHERE
                                                        rmStockOutId = '${rmStockOutId}'
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
                                                    { rawMaterialId: req.body.rawMaterialId, stockOutQuantity: prevoiusQuantity - productFinalQty }
                                                ];

                                                // const StockInData = [
                                                //     { rawMaterialId: 1, remainingStock: 5, rawMaterialQty: 5, stockInPrice: 70 },
                                                //     { rawMaterialId: 1, remainingStock: 5, rawMaterialQty: 5, stockInPrice: 60 },
                                                //     { rawMaterialId: 1, remainingStock: 2, rawMaterialQty: 5, stockInPrice: 50 },
                                                //     { rawMaterialId: 1, remainingStock: 0, rawMaterialQty: 5, stockInPrice: 40 },
                                                //     { rawMaterialId: 1, remainingStock: 0, rawMaterialQty: 5, stockInPrice: 30 },
                                                // ];

                                                let desiredQuantity = stockOutData[0].stockOutQuantity; // Desired quantity to be inserted into the buckets
                                                console.log("><?", desiredQuantity);
                                                let totalCost = 0; // Total cost of filling the buckets

                                                for (let i = 0; i < StockInData.length; i++) {
                                                    const stockIn = StockInData[i];
                                                    const availableSpace = stockIn.rawMaterialQty - stockIn.remainingStock; // Calculate the available space for the product

                                                    if (desiredQuantity <= availableSpace) {
                                                        // If the desired quantity can fit completely in the current stock in entry
                                                        stockIn.remainingStock += desiredQuantity;
                                                        totalCost += desiredQuantity * stockIn.stockInPrice;
                                                        break; // Exit the loop since the desired quantity has been inserted
                                                    } else {
                                                        // If the desired quantity cannot fit completely in the current stock in entry
                                                        stockIn.remainingStock = stockIn.rawMaterialQty;
                                                        totalCost += availableSpace * stockIn.stockInPrice;
                                                        desiredQuantity -= availableSpace;
                                                    }
                                                }
                                                const updatedStockInData = StockInData;
                                                console.log("Updated StockInData:", StockInData);
                                                console.log("Total Cost of Filling: ", totalCost);

                                                const totalofStockOutPrice = previousStockOutPrice - totalCost;
                                                const rmStockOutPrice = Number(totalofStockOutPrice).toFixed(2);

                                                const sopq = StockInData.filter((obj) => {
                                                    return obj;
                                                })
                                                const sowsiId = StockInData.map((obj) => {
                                                    return obj.rmStockInId;
                                                })
                                                const remainingStockByIds = sowsiId.map(rmStockInId => {
                                                    const stockIn = junoJson.find(item => item.rmStockInId === rmStockInId);
                                                    return stockIn ? stockIn.rawMaterialQty : undefined;
                                                });

                                                const remainingStockByIds1 = sowsiId.map(rmStockInId => {
                                                    const stockIn = updatedStockInData.find(item => item.rmStockInId === rmStockInId);
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

                                                const combinedData = filteredId.map((id, index) => `('${rmStockOutId}','${id}',ROUND(${filteredQty[index]},2))`);

                                                // Join the array elements into a single string
                                                const stockOutWiseStockInId = combinedData.join(',');

                                                // Output the resulting string
                                                console.log(stockOutWiseStockInId);

                                                function generateUpdateQuery(data) {
                                                    let query = 'UPDATE factory_rmStockIn_data\nSET remainingQty = CASE\n';

                                                    data.forEach((item) => {
                                                        const { rmStockInId, remainingStock } = item;
                                                        query += `    WHEN rmStockInId = '${rmStockInId}' THEN ROUND(${remainingStock},2)\n`;
                                                    });

                                                    query += '    ELSE remainingQty\nEND\n';

                                                    const stockInIds = data.map((item) => `'${item.rmStockInId}'`).join(', ');
                                                    query += `WHERE rmStockInId IN (${stockInIds})`;

                                                    return query;
                                                }

                                                console.log(generateUpdateQuery(sopq))
                                                const sql_qurey_updatedRemainQty = `${generateUpdateQuery(sopq)};
                                                                        DELETE FROM factory_stockOutwiseStockInId_data WHERE rmStockOutId = '${rmStockOutId}';
                                                                        INSERT INTO factory_stockOutwiseStockInId_data (rmStockOutId, rmStockInId, cutRmQty) VALUES ${stockOutWiseStockInId}`;
                                                pool.query(sql_qurey_updatedRemainQty, (err, data) => {
                                                    if (err) {
                                                        console.error("An error occurd in SQL Queery", err);
                                                        return res.status(500).send('Database Error');
                                                    }
                                                    const editFields = () => {
                                                        var string = ''
                                                        updatedField.forEach((data, index) => {
                                                            if (index == 0)
                                                                string = "(" + "'" + rmStockOutId + "'" + "," + "'" + userId + "'" + "," + "'" + rawMaterialId + "'" + "," + "'" + previousData[data] + "'" + "," + "'" + newData[data] + "'" + "," + "'" + reason + "'" + "," + "STR_TO_DATE('" + rmStockOutModificationDate + "','%b %d %Y %H:%i:%s')" + "," + "STR_TO_DATE('" + currentModifyDate + "','%b %d %Y %H:%i:%s')" + ")";
                                                            else
                                                                string = string + ",(" + "'" + rmStockOutId + "'" + "," + "'" + userId + "'" + "," + "'" + rawMaterialId + "'" + "," + "'" + previousData[data] + "'" + "," + "'" + newData[data] + "'" + "," + "'" + reason + "'" + "," + "STR_TO_DATE('" + rmStockOutModificationDate + "','%b %d %Y %H:%i:%s')" + "," + "STR_TO_DATE('" + currentModifyDate + "','%b %d %Y %H:%i:%s')" + ")";
                                                        });
                                                        return string;
                                                    }

                                                    console.log(">>>>>>>><<<<<<<<<", editFields());
                                                    const sql_querry_addPreviousData = `INSERT INTO factory_rmModified_history  (
                                                                                                rmStockOutId,
                                                                                                userId,
                                                                                                rawMaterialId,
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
                                                        console.log(">?>?>?>?,,,", rmStockOutCategory);
                                                        const sql_querry_updatedetails = `UPDATE factory_rmStockOut_data SET
                                                                                         userId = '${userId}',
                                                                                         rawMaterialId = '${rawMaterialId}',
                                                                                         rawMaterialQty = ${productFinalQty},
                                                                                         rmStockOutPrice = ${rmStockOutPrice},
                                                                                         rmStockOutDisplayQty = ${rawMaterialQty},
                                                                                         rmStockOutDisplayUnit = '${rawMaterialUnit}',
                                                                                         rmStockOutCategory = '${rmStockOutCategory}',
                                                                                         rmStockOutComment = NULLIF('${rmStockOutComment}','null'),
                                                                                         rmStockOutDate = STR_TO_DATE('${rmStockOutDate}','%b %d %Y') 
                                                                                   WHERE rmStockOutId = '${rmStockOutId}'`;
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
                                                        string = "(" + "'" + rmStockOutId + "'" + "," + "'" + userId + "'" + "," + "'" + rawMaterialId + "'" + "," + "'" + previousData[data] + "'" + "," + "'" + newData[data] + "'" + "," + "'" + reason + "'" + "," + "STR_TO_DATE('" + rmStockOutModificationDate + "','%b %d %Y %H:%i:%s')" + "," + "STR_TO_DATE('" + currentModifyDate + "','%b %d %Y %H:%i:%s')" + ")";
                                                    else
                                                        string = string + ",(" + "'" + rmStockOutId + "'" + "," + "'" + userId + "'" + "," + "'" + rawMaterialId + "'" + "," + "'" + previousData[data] + "'" + "," + "'" + newData[data] + "'" + "," + "'" + reason + "'" + "," + "STR_TO_DATE('" + rmStockOutModificationDate + "','%b %d %Y %H:%i:%s')" + "," + "STR_TO_DATE('" + currentModifyDate + "','%b %d %Y %H:%i:%s')" + ")";
                                                });
                                                return string;
                                            }

                                            console.log(">>>>>>>><<<<<<<<<", editFields());
                                            const sql_querry_addPreviousData = `INSERT INTO factory_rmModified_history  (
                                                                                                rmStockOutId,
                                                                                                userId,
                                                                                                rawMaterialId,
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
                                                console.log(">?>?>?>?,,,", rmStockOutCategory);
                                                const sql_querry_updatedetails = `UPDATE factory_rmStockOut_data SET 
                                                                                         userId = '${userId}',
                                                                                         rawMaterialId = '${rawMaterialId}',
                                                                                         rawMaterialQty = ${productFinalQty},
                                                                                         rmStockOutDisplayQty = ${rawMaterialQty},
                                                                                         rmStockOutDisplayUnit = '${rawMaterialUnit}',
                                                                                         rmStockOutCategory = '${rmStockOutCategory}',
                                                                                         rmStockOutComment = NULLIF('${rmStockOutComment}','null'),
                                                                                         rmStockOutDate = STR_TO_DATE('${rmStockOutDate}','%b %d %Y') 
                                                                                   WHERE rmStockOutId = '${rmStockOutId}'`;
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
                }
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

const getUpdateRmStockOutList = (req, res) => {
    try {
        let token;
        token = req.headers.authorization ? req.headers.authorization.split(" ")[1] : null;
        if (token) {
            const page = req.query.page;
            const numPerPage = req.query.numPerPage;
            const skip = (page - 1) * numPerPage;
            const limit = skip + ',' + numPerPage;
            sql_queries_getNumberOFEdit = `SELECT count(*) as numRows FROM factory_rmStockOut_data WHERE rmStockOutId IN (
                                               SELECT COALESCE(rmStockOutId,null) FROM factory_rmModified_history GROUP BY rmStockOutId)`;
            pool.query(sql_queries_getNumberOFEdit, (err, rows, fields) => {
                if (err) {
                    console.error("An error occurd in SQL Queery", err);
                    return res.status(500).send('Database Error');
                } else {
                    const numRows = rows[0].numRows;
                    const numPages = Math.ceil(numRows / numPerPage);
                    sql_queries_getdetails = `SELECT rmStockOutId, user_details.userName AS outBy, CONCAT(user_details.userFirstName,' ',user_details.userLastName) AS userName,factory_rawMaterial_data.rawMaterialName AS rawMaterialName, CONCAT(rmStockOutDisplayQty,' ',rmStockOutDisplayUnit) AS Quantity, factory_rmStockOutCategory_data.stockOutCategoryName AS stockOutCategoryName, rmStockOutComment, DATE_FORMAT(rmStockOutDate,'%d-%m-%Y') AS rmStockOutDate ,DATE_FORMAT(rmStockOutCreationDate,'%d-%M-%y / %r') AS rmStockOutCreationDate ,DATE_FORMAT(rmStockOutModificationDate,'%d-%M-%y / %r') AS rmStockOutModificationDate 
                                                    FROM factory_rmStockOut_data
                                                    INNER JOIN user_details ON user_details.userId = factory_rmStockOut_data.userId
                                                    INNER JOIN factory_rawMaterial_data ON factory_rawMaterial_data.rawMaterialId = factory_rmStockOut_data.rawMaterialId
                                                    INNER JOIN factory_rmStockOutCategory_data ON factory_rmStockOutCategory_data.stockOutCategoryId = factory_rmStockOut_data.rmStockOutCategory
                                                    WHERE rmStockOutId IN (SELECT COALESCE(rmStockOutId,null) FROM factory_rmModified_history GROUP BY rmStockOutId) ORDER BY rmStockOutModificationDate DESC LIMIT ${limit}`;
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
            return res.status(401).send('Pleasr Login Firest.....!');
        }
    } catch (error) {
        console.error('An error occurd', error);
        res.status(500).json('Internal Server Error');
    }
}

// GET Updated StockOut List By Id

const getUpdateRmStockOutListById = (req, res) => {
    try {
        const page = req.query.page;
        const numPerPage = req.query.numPerPage;
        const skip = (page - 1) * numPerPage;
        const limit = skip + ',' + numPerPage;
        const rmStockOutId = req.query.rmStockOutId
        sql_queries_getNumberOFEdit = `SELECT count(*) as numRows FROM factory_rmModified_history WHERE rmStockOutId = '${rmStockOutId}'`;
        console.log(">>>.", sql_queries_getNumberOFEdit);
        pool.query(sql_queries_getNumberOFEdit, (err, rows, fields) => {
            if (err) {
                console.error("An error occurd in SQL Queery", err);
                return res.status(500).send('Database Error');
            } else {
                const numRows = rows[0].numRows;
                const numPages = Math.ceil(numRows / numPerPage);
                sql_queries_getdetails = `SELECT user_details.userName AS userName,CONCAT(user_details.userFirstName,' ',user_details.userLastName) AS userFullName, factory_rawMaterial_data.rawMaterialName AS rawMaterialName, previous, updated, modifiedReason, DATE_FORMAT(previousDateTime,'%d-%M-%y / %r') AS previousDateTime, DATE_FORMAT(updatedDateTime,'%d-%M-%y / %r') AS updatedDateTime 
                                            FROM factory_rmModified_history
                                            INNER JOIN factory_rawMaterial_data ON factory_rawMaterial_data.rawMaterialId = factory_rmModified_history.rawMaterialId
                                            INNER JOIN user_details ON user_details.userId = factory_rmModified_history.userId
                                            WHERE rmStockOutId = '${rmStockOutId}' ORDER BY updateHistoryCreationDate DESC LIMIT ${limit}`;

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

const getRmStockOutDataByCategory = (req, res) => {
    try {
        let token;
        token = req.headers.authorization ? req.headers.authorization.split(" ")[1] : null;
        if (token) {
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
                sql_querry_getCountdetails = `SELECT count(*) as numRows FROM factory_rmStockOut_data WHERE factory_rmStockOut_data.rmStockOutCategory = '${data.categoryId}' AND factory_rmStockOut_data.rmStockOutDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')`;
            } else {
                sql_querry_getCountdetails = `SELECT count(*) as numRows FROM factory_rmStockOut_data WHERE factory_rmStockOut_data.rmStockOutCategory = '${data.categoryId}' AND factory_rmStockOut_data.rmStockOutDate >= DATE_SUB(CURDATE(), INTERVAL 1 MONTH) AND factory_rmStockOut_data.rmStockOutDate <= CURDATE()`;
            }
            pool.query(sql_querry_getCountdetails, (err, rows, fields) => {
                if (err) {
                    console.error("An error occurd in SQL Queery", err);
                    return res.status(500).send('Database Error');
                } else {
                    const numRows = rows[0].numRows;
                    const numPages = Math.ceil(numRows / numPerPage);
                    const commonQuery1 = `SELECT rmStockOutId, user_details.userName AS outBy, CONCAT(user_details.userFirstName,' ',user_details.userLastName) AS userName,factory_rawMaterial_data.rawMaterialName AS rawMaterialName, CONCAT(rmStockOutDisplayQty,' ',rmStockOutDisplayUnit) AS Quantity, ROUND(rmStockOutPrice) AS rmStockOutPrice, factory_rmStockOutCategory_data.stockOutCategoryName AS stockOutCategoryName, rmStockOutComment, DATE_FORMAT(rmStockOutDate,'%d-%m-%Y') AS dateStockOut, DATE_FORMAT(rmStockOutCreationDate, '%h:%i:%s %p') AS stockOutTime 
                                                FROM factory_rmStockOut_data
                                                INNER JOIN user_details ON user_details.userId = factory_rmStockOut_data.userId
                                                INNER JOIN factory_rawMaterial_data ON factory_rawMaterial_data.rawMaterialId = factory_rmStockOut_data.rawMaterialId
                                                INNER JOIN factory_rmStockOutCategory_data ON factory_rmStockOutCategory_data.stockOutCategoryId = factory_rmStockOut_data.rmStockOutCategory`;
                    const commonQuery2 = `SELECT ROUND(SUM(rmStockOutPrice)) AS totalStockOutPrice FROM factory_rmStockOut_data`;
                    if (req.query.startDate && req.query.endDate) {

                        sql_queries_getdetails = `${commonQuery1}
                                                WHERE factory_rmStockOut_data.rmStockOutCategory = '${data.categoryId}' AND factory_rmStockOut_data.rmStockOutDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')
                                                ORDER BY factory_rmStockOut_data.rmStockOutDate DESC, factory_rmStockOut_data.rmStockOutCreationDate DESC LIMIT ${limit};
                                                ${commonQuery2}
                                                WHERE factory_rmStockOut_data.rmStockOutCategory = '${data.categoryId}' AND factory_rmStockOut_data.rmStockOutDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')`;
                    } else {
                        sql_queries_getdetails = `${commonQuery1}
                                                WHERE factory_rmStockOut_data.rmStockOutCategory = '${data.categoryId}' AND factory_rmStockOut_data.rmStockOutDate >= DATE_SUB(CURDATE(), INTERVAL 1 MONTH) AND factory_rmStockOut_data.rmStockOutDate <= CURDATE()
                                                ORDER BY factory_rmStockOut_data.rmStockOutDate DESC, factory_rmStockOut_data.rmStockOutCreationDate DESC LIMIT ${limit};
                                                ${commonQuery2}
                                                WHERE factory_rmStockOut_data.rmStockOutCategory = '${data.categoryId}' AND factory_rmStockOut_data.rmStockOutDate >= DATE_SUB(CURDATE(), INTERVAL 1 MONTH) AND factory_rmStockOut_data.rmStockOutDate <= CURDATE()`;
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
            return res.status(401).send("Please Login Firest.....!");
        }
    } catch (error) {
        console.error('An error occurd', error);
        res.status(500).json('Internal Server Error');
    }
}

// Export Excel For Stock Out Data By Category Id

const exportExcelSheetForRmStockOutDataByCategoryId = (req, res) => {
    let token;
    token = req.headers.authorization ? req.headers.authorization.split(" ")[1] : null;
    if (token) {
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
                                      rmStockOutId,
                                      CONCAT(
                                          user_details.userFirstName,
                                          ' ',
                                          user_details.userLastName
                                      ) AS outBy,
                                      UPPER(factory_rawMaterial_data.rawMaterialName) AS rawMaterialName,
                                      rmStockOutDisplayQty AS rawMaterialQty,
                                      rmStockOutDisplayUnit AS rawMaterialUnit,
                                      ROUND(rmStockOutPrice) AS rmStockOutPrice,
                                      factory_rmStockOutCategory_data.stockOutCategoryName AS stockOutCategoryName,
                                      rmStockOutComment,
                                      DATE_FORMAT(rmStockOutDate, '%d-%m-%Y') AS rmStockOutDate,
                                      DATE_FORMAT(rmStockOutCreationDate, '%h:%i:%s %p') AS stockOutTime
                                  FROM factory_rmStockOut_data
                                  INNER JOIN user_details ON user_details.userId = factory_rmStockOut_data.userId
                                  INNER JOIN factory_rawMaterial_data ON factory_rawMaterial_data.rawMaterialId = factory_rmStockOut_data.rawMaterialId
                                  INNER JOIN factory_rmStockOutCategory_data ON factory_rmStockOutCategory_data.stockOutCategoryId = factory_rmStockOut_data.rmStockOutCategory`;
        if (req.query.startDate && req.query.endDate) {

            sql_queries_getdetails = `${commonQuery1}
                                    WHERE factory_rmStockOut_data.rmStockOutCategory = '${data.categoryId}' AND factory_rmStockOut_data.rmStockOutDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')
                                    ORDER BY factory_rmStockOut_data.rmStockOutDate DESC, factory_rmStockOut_data.rmStockOutCreationDate DESC`;

        } else {
            sql_queries_getdetails = `${commonQuery1}
                                    WHERE factory_rmStockOut_data.rmStockOutCategory = '${data.categoryId}' AND factory_rmStockOut_data.rmStockOutDate >= DATE_SUB(CURDATE(), INTERVAL 1 MONTH) AND factory_rmStockOut_data.rmStockOutDate <= CURDATE()
                                    ORDER BY factory_rmStockOut_data.rmStockOutDate DESC, factory_rmStockOut_data.rmStockOutCreationDate DESC`;
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
                { key: "rawMaterialName", width: 30 },
                { key: "rawMaterialQty", width: 10 },
                { key: "rawMaterialUnit", width: 10 },
                { key: "rmStockOutPrice", width: 20 },
                { key: "rmStockOutComment", width: 30 },
                { key: "rmStockOutDate", width: 20 },
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
        return res.status(401).send("Please Login Firest.....!");
    }
};

// EXPORT Excel For StockOut List

const exportExcelSheetForRmStockoutList = (req, res) => {
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
        const commonQuery = `SELECT rmStockOutId, user_details.userName AS outBy, CONCAT(user_details.userFirstName,' ',user_details.userLastName) AS userName,factory_rawMaterial_data.rawMaterialName AS rawMaterialName, rmStockOutDisplayQty AS rawMaterialQty, rmStockOutDisplayUnit AS rawMaterialUnit, ROUND(rmStockOutPrice) AS rmStockOutPrice, factory_rmStockOutCategory_data.stockOutCategoryName AS stockOutCategoryName, rmStockOutComment, CONCAT(DATE_FORMAT(rmStockOutDate,'%d-%m-%Y'),' ',DATE_FORMAT(rmStockOutCreationDate, '%h:%i:%s %p')) AS rmStockOutDate 
                                 FROM factory_rmStockOut_data
                                 INNER JOIN user_details ON user_details.userId = factory_rmStockOut_data.userId
                                 INNER JOIN factory_rawMaterial_data ON factory_rawMaterial_data.rawMaterialId = factory_rmStockOut_data.rawMaterialId
                                 INNER JOIN factory_rmStockOutCategory_data ON factory_rmStockOutCategory_data.stockOutCategoryId = factory_rmStockOut_data.rmStockOutCategory`;
        if (req.query.rawMaterialId && req.query.startDate && req.query.endDate) {
            sql_queries_getdetails = `${commonQuery}
                                                WHERE factory_rmStockOut_data.rawMaterialId = '${data.rawMaterialId}' AND factory_rmStockOut_data.rmStockOutDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')
                                                ORDER BY factory_rmStockOut_data.rmStockOutDate DESC, factory_rmStockOut_data.rmStockOutCreationDate DESC`;
        } else if (req.query.startDate && req.query.endDate) {
            sql_queries_getdetails = `${commonQuery}
                                                WHERE factory_rmStockOut_data.rmStockOutDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')
                                                ORDER BY factory_rmStockOut_data.rmStockOutDate DESC, factory_rmStockOut_data.rmStockOutCreationDate DESC`;
        } else if (req.query.rawMaterialId) {
            sql_queries_getdetails = `${commonQuery}
                                                WHERE factory_rmStockOut_data.rawMaterialId = '${data.rawMaterialId}'
                                                ORDER BY factory_rmStockOut_data.rmStockOutDate DESC, factory_rmStockOut_data.rmStockOutCreationDate DESC`;
        } else {
            sql_queries_getdetails = `${commonQuery}
                                                ORDER BY factory_rmStockOut_data.rmStockOutDate DESC, factory_rmStockOut_data.rmStockOutCreationDate DESC`;
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
                { key: "rawMaterialName", width: 30 },
                { key: "rawMaterialQty", width: 10 },
                { key: "rawMaterialUnit", width: 10 },
                { key: "rmStockOutPrice", width: 20 },
                { key: "stockOutCategoryName", width: 20 },
                { key: "rmStockOutComment", width: 30 },
                { key: "rmStockOutDate", width: 20 },
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
            if (req.query.rawMaterialId || req.query.rawMaterialId && req.query.startDate && req.query.endDate) {
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

const exportPdfForRmStockOutList = (req, res) => {
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
            const commonQuery = `SELECT 
                                            CONCAT(user_details.userFirstName,' ',user_details.userLastName) AS "Out By",
                                            factory_rawMaterial_data.rawMaterialName AS "Product", 
                                            CONCAT(rmStockOutDisplayQty,' ',rmStockOutDisplayUnit) AS "Qty",
                                            ROUND(rmStockOutPrice) AS "Out Price", 
                                            factory_rmStockOutCategory_data.stockOutCategoryName AS "Category", 
                                            rmStockOutComment, CONCAT(DATE_FORMAT(rmStockOutDate,'%d-%m-%Y'),' ',DATE_FORMAT(rmStockOutCreationDate, '%h:%i:%s %p')) AS "Date" 
                                 FROM factory_rmStockOut_data
                                 INNER JOIN user_details ON user_details.userId = factory_rmStockOut_data.userId
                                 INNER JOIN factory_rawMaterial_data ON factory_rawMaterial_data.rawMaterialId = factory_rmStockOut_data.rawMaterialId
                                 INNER JOIN factory_rmStockOutCategory_data ON factory_rmStockOutCategory_data.stockOutCategoryId = factory_rmStockOut_data.rmStockOutCategory`;
            if (req.query.rawMaterialId && req.query.startDate && req.query.endDate) {
                sql_queries_getdetails = `${commonQuery}
                                                WHERE factory_rmStockOut_data.rawMaterialId = '${data.rawMaterialId}' AND factory_rmStockOut_data.rmStockOutDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')
                                                ORDER BY factory_rmStockOut_data.rmStockOutDate DESC, factory_rmStockOut_data.rmStockOutCreationDate DESC`;
            } else if (req.query.startDate && req.query.endDate) {
                sql_queries_getdetails = `${commonQuery}
                                                WHERE factory_rmStockOut_data.rmStockOutDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')
                                                ORDER BY factory_rmStockOut_data.rmStockOutDate DESC, factory_rmStockOut_data.rmStockOutCreationDate DESC`;
            } else if (req.query.rawMaterialId) {
                sql_queries_getdetails = `${commonQuery}
                                                WHERE factory_rmStockOut_data.rawMaterialId = '${data.rawMaterialId}'
                                                ORDER BY factory_rmStockOut_data.rmStockOutDate DESC, factory_rmStockOut_data.rmStockOutCreationDate DESC`;
            } else {
                sql_queries_getdetails = `${commonQuery}
                                                ORDER BY factory_rmStockOut_data.rmStockOutDate DESC, factory_rmStockOut_data.rmStockOutCreationDate DESC`
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
            return res.status(401).send("Please Login Firest.....!");
        }

    } catch (error) {
        console.error('An error occurd', error);
        res.status(500).send('Internal Server Error');
    }
}

// Export PDF Stock Out Category Wise

const exportPdfForRmStockOutDataByCategoryId = (req, res) => {
    try {
        let token;
        token = req.headers.authorization ? req.headers.authorization.split(" ")[1] : null;
        if (token) {
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
                                      UPPER(factory_rawMaterial_data.rawMaterialName) AS "Product Name",
                                      CONCAT(rmStockOutDisplayQty,' ',rmStockOutDisplayUnit) AS "Qty",
                                      ROUND(rmStockOutPrice) AS "Out Price",
                                      factory_rmStockOutCategory_data.stockOutCategoryName AS "Category",
                                      rmStockOutComment AS "Comment",
                                      DATE_FORMAT(rmStockOutDate, '%d-%m-%Y') AS "Date",
                                      DATE_FORMAT(rmStockOutCreationDate, '%h:%i:%s %p') AS "Time"
                                  FROM factory_rmStockOut_data
                                  INNER JOIN user_details ON user_details.userId = factory_rmStockOut_data.userId
                                  INNER JOIN factory_rawMaterial_data ON factory_rawMaterial_data.rawMaterialId = factory_rmStockOut_data.rawMaterialId
                                  INNER JOIN factory_rmStockOutCategory_data ON factory_rmStockOutCategory_data.stockOutCategoryId = factory_rmStockOut_data.rmStockOutCategory`;
            if (req.query.startDate && req.query.endDate) {
                sql_queries_getdetails = `${commonQuery1}
                                    WHERE factory_rmStockOut_data.rmStockOutCategory = '${data.categoryId}' AND factory_rmStockOut_data.rmStockOutDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')
                                    ORDER BY factory_rmStockOut_data.rmStockOutDate DESC, factory_rmStockOut_data.rmStockOutCreationDate DESC`;

            } else {
                sql_queries_getdetails = `${commonQuery1}
                                    WHERE factory_rmStockOut_data.rmStockOutCategory = '${data.categoryId}' AND factory_rmStockOut_data.rmStockOutDate >= DATE_SUB(CURDATE(), INTERVAL 1 MONTH) AND factory_rmStockOut_data.rmStockOutDate <= CURDATE()
                                    ORDER BY factory_rmStockOut_data.rmStockOutDate DESC, factory_rmStockOut_data.rmStockOutCreationDate DESC`;
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
            return res.status(401).send("Please Login Firest.....!");
        }

    } catch (error) {
        console.error('An error occurd', error);
        res.status(500).send('Internal Server Error');
    }
}

module.exports = {
    getRmStockOutList,
    addRmStockOutDetails,
    removeRmStockOutTransaction,
    fillRmStockOutTransaction,
    updateRmStockOutTransaction,
    getUpdateRmStockOutList,
    getUpdateRmStockOutListById,
    getRmStockOutDataByCategory,
    exportExcelSheetForRmStockOutDataByCategoryId,
    exportExcelSheetForRmStockoutList,
    exportPdfForRmStockOutList,
    exportPdfForRmStockOutDataByCategoryId
}