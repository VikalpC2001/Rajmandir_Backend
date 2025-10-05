const pool = require('../../../database');
const jwt = require("jsonwebtoken");
const excelJS = require("exceljs");
const { jsPDF } = require('jspdf');
require('jspdf-autotable');

function convertUnitsSmallToLarge(unit, qty, fromUnit, toUnit) {
    console.log('>>>>>', qty, fromUnit, toUnit);
    const unitsData = unit;
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

    const unitsData = unit;

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
    return convertUnitsSmallToLarge(unitsData, quantityStatic, fromUnitStatic, toUnitStatic);
}

// StockOUT List API

const getMfStockOutList = async (req, res) => {
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
                    mfProductId: req.query.mfProductId
                }

                let sql_countCommon_qurey = `SELECT count(*) as numRows FROM factory_mfProductStockOut_data WHERE factory_mfProductStockOut_data.mfProductId IN (SELECT COALESCE(fmp.mfProductId, null) FROM factory_manufactureProduct_data AS fmp WHERE fmp.mfProductCategoryId = '${departmentId}')`;

                if (req.query.mfProductId && req.query.startDate && req.query.endDate) {
                    sql_querry_getCountdetails = `${sql_countCommon_qurey} AND factory_mfProductStockOut_data.mfProductId = '${data.mfProductId}' AND factory_mfProductStockOut_data.mfStockOutDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')`;
                } else if (req.query.startDate && req.query.endDate) {
                    sql_querry_getCountdetails = `${sql_countCommon_qurey} AND factory_mfProductStockOut_data.mfStockOutDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')`;
                } else if (req.query.mfProductId) {
                    sql_querry_getCountdetails = `${sql_countCommon_qurey} AND factory_mfProductStockOut_data.mfProductId = '${data.mfProductId}'`;
                } else {
                    sql_querry_getCountdetails = `${sql_countCommon_qurey}`;
                }
                pool.query(sql_querry_getCountdetails, (err, rows, fields) => {
                    if (err) {
                        console.error("An error occurd in SQL Queery", err);
                        return res.status(500).send('Database Error');
                    } else {
                        const numRows = rows[0].numRows;
                        const numPages = Math.ceil(numRows / numPerPage);
                        const commonQuery = `SELECT 
                                                factory_mfProductStockOut_data.mfStockOutId,
                                                user_details.userName AS outBy, 
                                                CONCAT(user_details.userFirstName,' ',user_details.userLastName) AS userName,
                                                factory_manufactureProduct_data.mfProductName AS mfProductName, 
                                                mfStockOutDisplayQty AS fillQty, 
                                                mfStockOutDisplayUnit AS fillUnit, 
                                                CONCAT(mfStockOutDisplayQty,' ',mfStockOutDisplayUnit) AS Quantity, 
                                                ROUND(mfProductOutPrice) AS mfProductOutPrice, 
                                                CASE
                                                    WHEN factory_mfProductStockOut_data.mfProductOutCategory = 'Wastage' THEN 0
                                                    WHEN factory_mfProductStockOut_data.mfProductOutCategory = 'Auto' THEN ROUND(mfProductOutPrice)
                                                    ELSE COALESCE(dwo.sellAmount,isd.totalPrice,0)
                                                END AS sellAmt,
                                                factory_mfProductOutCategory_data.stockOutCategoryName AS stockOutCategoryName, 
                                                mfStockOutComment, 
                                                CONCAT(DATE_FORMAT(mfStockOutDate,'%d-%m-%Y'),' ',DATE_FORMAT(mfStockOutCreationDate, '%h:%i:%s %p')) AS mfStockOutDate 
                                            FROM factory_mfProductStockOut_data
                                            INNER JOIN user_details ON user_details.userId = factory_mfProductStockOut_data.userId
                                            INNER JOIN factory_manufactureProduct_data ON factory_manufactureProduct_data.mfProductId = factory_mfProductStockOut_data.mfProductId
                                            INNER JOIN factory_mfProductOutCategory_data ON factory_mfProductOutCategory_data.stockOutCategoryId = factory_mfProductStockOut_data.mfProductOutCategory
                                            LEFT JOIN factory_distributorWiseOut_data AS dwo ON dwo.mfStockOutId = factory_mfProductStockOut_data.mfStockOutId
                                            LEFT JOIN inventory_stockIn_data AS isd ON isd.stockInId = factory_mfProductStockOut_data.mfStockOutId
                                            WHERE factory_mfProductStockOut_data.mfProductId IN (SELECT COALESCE(fmp.mfProductId, null) FROM factory_manufactureProduct_data AS fmp WHERE fmp.mfProductCategoryId = '${departmentId}')`;
                        if (req.query.mfProductId && req.query.startDate && req.query.endDate) {
                            sql_queries_getdetails = `${commonQuery}
                                                AND factory_mfProductStockOut_data.mfProductId = '${data.mfProductId}' AND factory_mfProductStockOut_data.mfStockOutDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')
                                                ORDER BY factory_mfProductStockOut_data.mfStockOutDate DESC, factory_mfProductStockOut_data.mfStockOutCreationDate DESC LIMIT ${limit}`;
                        } else if (req.query.startDate && req.query.endDate) {
                            sql_queries_getdetails = `${commonQuery}
                                                AND factory_mfProductStockOut_data.mfStockOutDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')
                                                ORDER BY factory_mfProductStockOut_data.mfStockOutDate DESC, factory_mfProductStockOut_data.mfStockOutCreationDate DESC LIMIT ${limit}`;
                        } else if (req.query.mfProductId) {
                            sql_queries_getdetails = `${commonQuery}
                                                AND factory_mfProductStockOut_data.mfProductId = '${data.mfProductId}'
                                                ORDER BY factory_mfProductStockOut_data.mfStockOutDate DESC, factory_mfProductStockOut_data.mfStockOutCreationDate DESC LIMIT ${limit}`;
                        } else {
                            sql_queries_getdetails = `${commonQuery}
                                                ORDER BY factory_mfProductStockOut_data.mfStockOutDate DESC, factory_mfProductStockOut_data.mfStockOutCreationDate DESC LIMIT ${limit}`
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

// ADD Manufacture Product StockOut Data

const addMfProductStockOutData = (req, res) => {
    try {
        let token;
        token = req.headers.authorization ? req.headers.authorization.split(" ")[1] : null;
        if (token) {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const userId = decoded.id.id;
            const uid1 = new Date();
            const mfStockOutId = String("stockOut_" + uid1.getTime());
            console.log("...", mfStockOutId);

            const mfProductId = req.body.mfProductId;
            const mfProductQty = req.body.mfProductQty;
            const productUnit = req.body.productUnit.trim();
            const mfProductOutCategory = req.body.mfProductOutCategory.trim();
            const mfStockOutComment = req.body.mfStockOutComment ? req.body.mfStockOutComment.trim() : null;
            const mfStockOutDate = new Date(req.body.mfStockOutDate ? req.body.mfStockOutDate : "10/10/1001").toString().slice(4, 15);
            const isSupplyBranch = process.env.OUT_BRANCH_ID ? process.env.OUT_BRANCH_ID : '';
            const isDistribute = process.env.OUT_DISTRIBUTOR_ID ? process.env.OUT_DISTRIBUTOR_ID : '';
            const RAJ_MANDIR_FACTORY_ID = process.env.RAJ_MANDIR_FACTORY_ID;
            const branchId = req.body.branchId;
            const outDataId = String("sellOut_" + uid1.getTime());
            const distributorId = req.body.distributorId;
            const payType = req.body.payType;
            const sellAmount = req.body.sellAmount;

            if (isSupplyBranch == mfProductOutCategory) {
                if (!branchId || !sellAmount) {
                    return res.status(400).send("Please Select Branch");
                }
            } else if (isDistribute == mfProductOutCategory) {
                if (!distributorId || !payType || !sellAmount) {
                    return res.status(400).send("Please Select Distributor OR Pay Type OR sellAmount");
                }
            }

            if (!mfProductId || !mfProductQty || !productUnit || !mfProductOutCategory || !mfStockOutDate) {
                return res.status(400).send("Please Fill all the feilds");
            }
            else {
                const sql_queries_getNeedData = `SELECT bigUnitName AS largerUnit, unitNumber AS value, smallUnitName AS smallerUnit FROM mfProduct_unit_preference WHERE mfProductId = '${mfProductId}' ORDER BY mfProduct_unit_preference.priorityNumber ASC;
                                                 SELECT mfpd.minMfProductUnit AS  minProductUnit FROM factory_manufactureProduct_data AS mfpd WHERE mfpd.mfProductId = '${mfProductId}'`;
                pool.query(sql_queries_getNeedData, (err, result) => {
                    if (err) {
                        console.error("An error occurd in SQL Queery", err);
                        return res.status(500).send('Database Error');
                    }
                    const needData = {
                        unitsData: result && result[0] ? Object.values(JSON.parse(JSON.stringify(result[0]))) : null,
                        toUnit: result && result[1][0] && result[1][0].minProductUnit ? result[1][0].minProductUnit : null
                    }
                    const productFinalQty = (needData.unitsData && needData.unitsData.length !== 0) ? convertUnits(needData.unitsData, mfProductQty, productUnit, needData.toUnit) : mfProductQty;
                    const get_remaining_stock = `SELECT COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) AS remainingStock FROM factory_manufactureProduct_data AS p
                                                LEFT JOIN
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
                                                    ) AS so ON p.mfProductId = so.mfProductId
                                                WHERE p.mfProductId = '${mfProductId}'`;
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
                            sql_querry_getStockIndetail = `SELECT mfStockInID, mfProductId, mfProductQty, mfProductPrice AS stockInPrice, remainingQty AS stockInQuantity FROM factory_mfProductStockIn_data WHERE factory_mfProductStockIn_data.mfProductId = '${mfProductId}' AND factory_mfProductStockIn_data.remainingQty != 0 ORDER BY mfStockInDate ASC, mfStockInCreationDate ASC`;
                            pool.query(sql_querry_getStockIndetail, (err, data) => {
                                if (err) {
                                    console.error("An error occurd in SQL Queery", err);
                                    return res.status(500).send('Database Error');
                                }
                                const orignalStockInData = Object.values(JSON.parse(JSON.stringify(data)));
                                const stockInData = Object.values(JSON.parse(JSON.stringify(data)));
                                // console.log(">>>", Object.values(JSON.parse(JSON.stringify(data))));
                                const stockOutData = [
                                    { mfProductId: req.body.mfProductId, stockOutQuantity: productFinalQty }
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
                                    if (obj.stockInQuantity != obj.mfProductQty) {
                                        return obj;
                                    }
                                })

                                function generateUpdateQuery(data) {
                                    let query = 'UPDATE factory_mfProductStockIn_data\nSET remainingQty = CASE\n';

                                    data.forEach((item) => {
                                        const { mfStockInID, stockInQuantity } = item;
                                        query += `WHEN mfStockInID = '${mfStockInID}' THEN ROUND(${stockInQuantity},4)\n`;
                                    });

                                    query += 'ELSE remainingQty\nEND\n';

                                    const stockInIds = data.map((item) => `'${item.mfStockInID}'`).join(', ');
                                    query += `WHERE mfStockInID IN (${stockInIds});`;

                                    return query;
                                }

                                // console.log(generateUpdateQuery(sopq))
                                const sql_qurey_updatedRemainQty = generateUpdateQuery(sopq);
                                pool.query(sql_qurey_updatedRemainQty, (err, data) => {
                                    if (err) {
                                        console.error("An error occurd in SQL Queery", err);
                                        return res.status(500).send('Database Error');
                                    }
                                    const sql_querry_addStockOut = `INSERT INTO factory_mfProductStockOut_data (mfStockOutId, userId, mfProductId, mfProductQty, mfProductOutPrice, mfStockOutDisplayQty, mfStockOutDisplayUnit, mfProductOutCategory, mfStockOutComment, mfStockOutDate)
                                                                    VALUES ('${mfStockOutId}', '${userId}', '${mfProductId}', ${productFinalQty}, ${stocokOutPrice}, ${mfProductQty}, '${productUnit}', '${mfProductOutCategory}', NULLIF('${mfStockOutComment}','null'), STR_TO_DATE('${mfStockOutDate}','%b %d %Y'))`;
                                    pool.query(sql_querry_addStockOut, (err, data) => {
                                        if (err) {
                                            console.error("An error occurd in SQL Queery", err);
                                            return res.status(500).send('Database Error');
                                        }
                                        const sowsiId = sopq.map((obj) => {
                                            if (obj.stockInQuantity != obj.mfProductQty) {
                                                return obj.mfStockInID;
                                            }
                                        })

                                        const remainingStockByIds = sowsiId.map(mfStockInID => {
                                            const stockIn = orignalStockInData.find(item => item.mfStockInID === mfStockInID);
                                            return stockIn ? stockIn.stockInQuantity : undefined;
                                        });

                                        const remainingStockByIds1 = sowsiId.map(mfStockInID => {
                                            const stockIn = stockInData.find(item => item.mfStockInID === mfStockInID);
                                            return stockIn ? stockIn.stockInQuantity : undefined;
                                        });

                                        console.log('orignalStockInData', remainingStockByIds);
                                        console.log('stockInData', remainingStockByIds1);

                                        const remainStockCutQty = remainingStockByIds.map((value, index) => value - remainingStockByIds1[index].toFixed(10));

                                        console.log(';;;;;;;;', stockInData)
                                        console.log('???????', orignalStockInData);
                                        console.log(">?>?>?<<<<.,,,", sowsiId);
                                        console.log("RRRRR", remainStockCutQty);

                                        // Use map to combine the arrays and format them
                                        const combinedData = sowsiId.map((id, index) => `('${mfStockOutId}','${id}',${remainStockCutQty[index]})`);

                                        // Join the array elements into a single string
                                        const stockOutWiseStockInId = combinedData.join(',');

                                        // Output the resulting string
                                        console.log(stockOutWiseStockInId);

                                        sql_querry_addsowsiId = `INSERT INTO factory_mfProductInwiseOut_data (mfStockOutId, mfStockInID, cutMfQty) VALUES ${stockOutWiseStockInId}`;
                                        pool.query(sql_querry_addsowsiId, (err, data) => {
                                            if (err) {

                                                console.error("An error occurd in SQL Queery", err);
                                                return res.status(500).send('Database Error');

                                            } else if (isSupplyBranch == mfProductOutCategory) {

                                                const sql_querry_addStockIn = `INSERT INTO inventory_stockIn_data (stockInId,
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
                                                                                                                   stockInDate)  
                                                                                                            VALUES ('${mfStockOutId}', 
                                                                                                                    '${branchId}',
                                                                                                                    '${userId}', 
                                                                                                                    '${mfProductId}', 
                                                                                                                     ${productFinalQty}, 
                                                                                                                     ${sellAmount / productFinalQty}, 
                                                                                                                     ${sellAmount}, 
                                                                                                                     null, 
                                                                                                                     ${mfProductQty},
                                                                                                                    '${productUnit}', 
                                                                                                                    '${RAJ_MANDIR_FACTORY_ID}', 
                                                                                                                    'cash',
                                                                                                                     ${mfStockOutComment ? `'${mfStockOutComment}'` : null}, 
                                                                                                                     ${needData && needData.isExpired && needData.expiredDays > 0 ? `DATE_ADD(STR_TO_DATE('${data.stockInDate}','%b %d %Y'), INTERVAL ${needData.expiredDays} DAY)` : null},
                                                                                                                     ${productFinalQty}, 
                                                                                                                     STR_TO_DATE('${mfStockOutDate}','%b %d %Y'))`;
                                                pool.query(sql_querry_addStockIn, (err, branch) => {
                                                    if (err) {
                                                        console.error("An error occurd in SQL Queery", err);
                                                        return res.status(500).send('Database Error');
                                                    }
                                                    return res.status(200).send("Data Added Successfully");
                                                })
                                            } else if (isDistribute == mfProductOutCategory) {
                                                const sql_querry_addSellData = `INSERT INTO factory_distributorWiseOut_data(outDataId,
                                                                                                                            userId,
                                                                                                                            mfStockOutId,
                                                                                                                            mfProductId,
                                                                                                                            distributorId,
                                                                                                                            payType,
                                                                                                                            sellAmount,
                                                                                                                            sellDate)
                                                                                                                      VALUES('${outDataId}',
                                                                                                                             '${userId}',
                                                                                                                             '${mfStockOutId}',
                                                                                                                             '${mfProductId}',
                                                                                                                             '${distributorId}',
                                                                                                                             '${payType}',
                                                                                                                              ${sellAmount},
                                                                                                                              STR_TO_DATE('${mfStockOutDate}','%b %d %Y'))`;
                                                pool.query(sql_querry_addSellData, (err, sell) => {
                                                    if (err) {
                                                        console.error("An error occurd in SQL Queery", err);
                                                        return res.status(500).send('Database Error');
                                                    }
                                                    return res.status(200).send("Data Added Successfully");
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
        res.status(500).send('Internal Server Error');
    }
}

// Remove Manufacture Product StockOut Data

const removeMfProductStockOutTransaction = async (req, res) => {
    try {
        const mfStockOutId = req.query.mfStockOutId
        const sql_query_chkIdIsDeleteOrNot = `SELECT stockInId, productQty, remainingQty FROM inventory_stockIn_data WHERE stockInId = '${mfStockOutId}'`;
        pool.query(sql_query_chkIdIsDeleteOrNot, (err, chk) => {
            if (err) {
                console.error("An error occurd in SQL Queery", err);
                return res.status(500).send('Database Error');
            }
            const isStockInId = chk && chk[0] ? chk[0].stockInId : null;
            if (isStockInId) {
                if (chk[0].productQty != chk[0].remainingQty) {
                    return res.status(400).send('You Can not Delete Transaction Because Its Used');
                } else {
                    req.query.mfStockOutId = pool.query(`SELECT mfStockOutId, mfProductQty FROM factory_mfProductStockOut_data WHERE mfStockOutId = '${mfStockOutId}'`, (err, row) => {
                        if (err) {
                            console.error("An error occurd in SQL Queery", err);
                            return res.status(500).send('Database Error');
                        }
                        if (row && row.length) {
                            const prevoiusQuantity = row[0].mfProductQty;
                            sql_get_sowsoid = `SELECT
                                                   factory_mfProductStockIn_data.mfStockInID,
                                                   mfProductId,
                                                   (
                                                       factory_mfProductStockIn_data.remainingQty + sowsid.cutMfQty
                                                   ) AS mfProductQty,
                                                   mfProductPrice AS stockInPrice,
                                                   remainingQty AS remainingStock
                                               FROM
                                                   factory_mfProductStockIn_data
                                               INNER JOIN(
                                                   SELECT
                                                       factory_mfProductInwiseOut_data.mfStockInID,
                                                       factory_mfProductInwiseOut_data.cutMfQty AS cutMfQty
                                                   FROM
                                                       factory_mfProductInwiseOut_data
                                                   WHERE
                                                       factory_mfProductInwiseOut_data.mfStockOutId = '${mfStockOutId}'
                                               ) AS sowsid
                                               ON
                                                   factory_mfProductStockIn_data.mfStockInID = sowsid.mfStockInID
                                               WHERE
                                                   factory_mfProductStockIn_data.mfStockInID IN(
                                                   SELECT
                                                       COALESCE(
                                                           factory_mfProductInwiseOut_data.mfStockInID,
                                                           NULL
                                                       )
                                                   FROM
                                                       factory_mfProductInwiseOut_data
                                                   WHERE
                                                       mfStockOutId = '${mfStockOutId}'
                                               )
                                               ORDER BY
                                                   mfStockInCreationDate ASC`;
                            pool.query(sql_get_sowsoid, (err, data) => {
                                if (err) {
                                    console.error("An error occurd in SQL Queery", err);
                                    return res.status(500).send('Database Error');
                                }
                                const junoJson = Object.values(JSON.parse(JSON.stringify(data)))
                                console.log('junoo', junoJson)
                                console.log(">>>", Object.values(JSON.parse(JSON.stringify(data))));
                                const StockInData = Object.values(JSON.parse(JSON.stringify(data)));
                                console.log("::::::::", prevoiusQuantity - req.body.mfProductQty);
                                const stockOutData = [
                                    { mfProductId: req.body.mfProductId, stockOutQuantity: prevoiusQuantity }
                                ];

                                // const StockInData = [
                                //     { mfProductId: 1, remainingStock: 5, mfProductQty: 5, stockInPrice: 70 },
                                //     { mfProductId: 1, remainingStock: 5, mfProductQty: 5, stockInPrice: 60 },
                                //     { mfProductId: 1, remainingStock: 2, mfProductQty: 5, stockInPrice: 50 },
                                //     { mfProductId: 1, remainingStock: 0, mfProductQty: 5, stockInPrice: 40 },
                                //     { mfProductId: 1, remainingStock: 0, mfProductQty: 5, stockInPrice: 30 },
                                // ];

                                let desiredQuantity = stockOutData[0].stockOutQuantity; // Desired quantity to be inserted into the buckets
                                console.log("><?", desiredQuantity);
                                let totalCost = 0; // Total cost of filling the buckets

                                for (let i = 0; i < StockInData.length; i++) {
                                    const stockIn = StockInData[i];
                                    const availableSpace = stockIn.mfProductQty - stockIn.remainingStock; // Calculate the available space for the product

                                    if (desiredQuantity <= availableSpace) {
                                        // If the desired quantity can fit completely in the current stock in entry
                                        stockIn.remainingStock += desiredQuantity;
                                        totalCost += desiredQuantity * stockIn.stockInPrice;
                                        break; // Exit the loop since the desired quantity has been inserted
                                    } else {
                                        // If the desired quantity cannot fit completely in the current stock in entry
                                        stockIn.remainingStock = stockIn.mfProductQty;
                                        totalCost += availableSpace * stockIn.stockInPrice;
                                        desiredQuantity -= availableSpace;
                                    }
                                }

                                console.log("Updated StockInData:", StockInData);
                                console.log("Total Cost of Filling: ", totalCost);

                                const sopq = StockInData.filter((obj) => {
                                    if (obj.stockInQuantity != obj.mfProductQty) {
                                        return obj;
                                    }
                                })

                                function generateUpdateQuery(data) {
                                    let query = 'UPDATE factory_mfProductStockIn_data\nSET remainingQty = CASE\n';

                                    data.forEach((item) => {
                                        const { mfStockInID, remainingStock } = item;
                                        query += `    WHEN mfStockInID = '${mfStockInID}' THEN ROUND(${remainingStock},4)\n`;
                                    });

                                    query += '    ELSE remainingQty\nEND\n';

                                    const stockInIds = data.map((item) => `'${item.mfStockInID}'`).join(', ');
                                    query += `WHERE mfStockInID IN (${stockInIds});`;

                                    return query;
                                }

                                console.log(generateUpdateQuery(sopq))
                                const sql_qurey_updatedRemainQty = generateUpdateQuery(sopq);
                                pool.query(sql_qurey_updatedRemainQty, (err, data) => {
                                    if (err) {
                                        console.error("An error occurd in SQL Queery", err);
                                        return res.status(500).send('Database Error');
                                    }
                                    const sql_querry_removedetails = `DELETE FROM factory_mfProductStockOut_data WHERE mfStockOutId = '${mfStockOutId}';
                                                                      DELETE FROM inventory_stockIn_data WHERE stockInId = '${mfStockOutId}'`;
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
                req.query.mfStockOutId = pool.query(`SELECT mfStockOutId, mfProductQty FROM factory_mfProductStockOut_data WHERE mfStockOutId = '${mfStockOutId}'`, (err, row) => {
                    if (err) {
                        console.error("An error occurd in SQL Queery", err);
                        return res.status(500).send('Database Error');
                    }
                    const prevoiusQuantity = row && row[0] ? row[0].mfProductQty : 0;
                    if (row && row.length) {
                        sql_get_sowsoid = `SELECT
                                               factory_mfProductStockIn_data.mfStockInID,
                                               mfProductId,
                                               (
                                                   factory_mfProductStockIn_data.remainingQty + sowsid.cutMfQty
                                               ) AS mfProductQty,
                                               mfProductPrice AS stockInPrice,
                                               remainingQty AS remainingStock
                                           FROM
                                               factory_mfProductStockIn_data
                                           INNER JOIN(
                                               SELECT
                                                   factory_mfProductInwiseOut_data.mfStockInID,
                                                   factory_mfProductInwiseOut_data.cutMfQty AS cutMfQty
                                               FROM
                                                   factory_mfProductInwiseOut_data
                                               WHERE
                                                   factory_mfProductInwiseOut_data.mfStockOutId = '${mfStockOutId}'
                                           ) AS sowsid
                                           ON
                                               factory_mfProductStockIn_data.mfStockInID = sowsid.mfStockInID
                                           WHERE
                                               factory_mfProductStockIn_data.mfStockInID IN(
                                               SELECT
                                                   COALESCE(
                                                       factory_mfProductInwiseOut_data.mfStockInID,
                                                       NULL
                                                   )
                                               FROM
                                                   factory_mfProductInwiseOut_data
                                               WHERE
                                                   mfStockOutId = '${mfStockOutId}'
                                           )
                                           ORDER BY
                                               mfStockInCreationDate ASC`;
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
                            console.log("::::::::", prevoiusQuantity - req.body.mfProductQty);
                            const stockOutData = [
                                { mfProductId: req.body.mfProductId, stockOutQuantity: prevoiusQuantity }
                            ];

                            // const StockInData = [
                            //     { mfProductId: 1, remainingStock: 5, mfProductQty: 5, stockInPrice: 70 },
                            //     { mfProductId: 1, remainingStock: 5, mfProductQty: 5, stockInPrice: 60 },
                            //     { mfProductId: 1, remainingStock: 2, mfProductQty: 5, stockInPrice: 50 },
                            //     { mfProductId: 1, remainingStock: 0, mfProductQty: 5, stockInPrice: 40 },
                            //     { mfProductId: 1, remainingStock: 0, mfProductQty: 5, stockInPrice: 30 },
                            // ];

                            let desiredQuantity = stockOutData[0].stockOutQuantity; // Desired quantity to be inserted into the buckets
                            console.log("><?", desiredQuantity);
                            let totalCost = 0; // Total cost of filling the buckets

                            for (let i = 0; i < StockInData.length; i++) {
                                const stockIn = StockInData[i];
                                const availableSpace = stockIn.mfProductQty - stockIn.remainingStock; // Calculate the available space for the product

                                if (desiredQuantity <= availableSpace) {
                                    // If the desired quantity can fit completely in the current stock in entry
                                    stockIn.remainingStock += desiredQuantity;
                                    totalCost += desiredQuantity * stockIn.stockInPrice;
                                    break; // Exit the loop since the desired quantity has been inserted
                                } else {
                                    // If the desired quantity cannot fit completely in the current stock in entry
                                    stockIn.remainingStock = stockIn.mfProductQty;
                                    totalCost += availableSpace * stockIn.stockInPrice;
                                    desiredQuantity -= availableSpace;
                                }
                            }

                            console.log("Updated StockInData:", StockInData);
                            console.log("Total Cost of Filling: ", totalCost);

                            const sopq = StockInData.filter((obj) => {
                                if (obj.stockInQuantity != obj.mfProductQty) {
                                    return obj;
                                }
                            })

                            function generateUpdateQuery(data) {
                                let query = 'UPDATE factory_mfProductStockIn_data\nSET remainingQty = CASE\n';

                                data.forEach((item) => {
                                    const { mfStockInID, remainingStock } = item;
                                    query += `    WHEN mfStockInID = '${mfStockInID}' THEN ROUND(${remainingStock},4)\n`;
                                });

                                query += '    ELSE remainingQty\nEND\n';

                                const stockInIds = data.map((item) => `'${item.mfStockInID}'`).join(', ');
                                query += `WHERE mfStockInID IN (${stockInIds});`;

                                return query;
                            }

                            console.log(generateUpdateQuery(sopq))
                            const sql_qurey_updatedRemainQty = generateUpdateQuery(sopq);
                            pool.query(sql_qurey_updatedRemainQty, (err, data) => {
                                if (err) {
                                    console.error("An error occurd in SQL Queery", err);
                                    return res.status(500).send('Database Error');
                                }
                                const sql_querry_removedetails = `DELETE FROM factory_mfProductStockOut_data WHERE mfStockOutId = '${mfStockOutId}';
                                                                  DELETE FROM factory_distributorWiseOut_data WHERE mfStockOutId = '${mfStockOutId}'`;
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

// Update Manufacture Product StockOut Data

const updateMfStockOutTransaction = async (req, res) => {
    try {
        let token;
        token = req.headers ? req.headers.authorization.split(" ")[1] : null;
        if (token) {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const userId = decoded.id.id;
            const uid1 = new Date();
            const stockOutHistoryId = String("modifiedSO_" + uid1.getTime());

            const mfStockOutId = req.body.mfStockOutId;
            const mfProductId = req.body.mfProductId;
            const mfProductQty = req.body.mfProductQty;
            const productUnit = req.body.productUnit.trim();
            const mfProductOutCategory = req.body.mfProductOutCategory.trim();
            const mfStockOutComment = req.body.mfStockOutComment ? req.body.mfStockOutComment.trim() : null;
            const mfStockOutDate = new Date(req.body.mfStockOutDate ? req.body.mfStockOutDate : "10/10/1001").toString().slice(4, 15);
            const isSupplyBranch = req.body.isSupplyBranch ? req.body.isSupplyBranch : false;
            const branchId = req.body.branchId ? req.body.branchId : '';
            const billNumber = req.body.billNumber ? req.body.billNumber : '';
            const distributorId = req && req.body.distributorId ? req.body.distributorId : null;
            const payType = req && req.body.payType ? req.body.payType : 'cash';
            const sellAmount = req && req.body.sellAmount ? req.body.sellAmount : 0;
            const reason = req.body.reason ? req.body.reason : null;
            const currentModifyDate = new Date().toString().slice(4, 24)
            if (!mfProductId || !mfProductQty || !productUnit || !mfProductOutCategory || !mfStockOutDate) {
                return res.status(400).send("Please Fill all the feilds");
            }

            const sql_query_chkIdIsDeleteOrNot = `SELECT stockInId, productQty, remainingQty FROM inventory_stockIn_data WHERE stockInId = '${mfStockOutId}'`;
            console.log(sql_query_chkIdIsDeleteOrNot);
            pool.query(sql_query_chkIdIsDeleteOrNot, (err, chk) => {
                if (err) {
                    console.error("An error occurd in SQL Queery", err);
                    return res.status(500).send('Database Error');
                }
                const isStockInId = chk.length ? chk[0].stockInId : null;

                if (isStockInId) {
                    if (chk[0].productQty != chk[0].remainingQty) {
                        return res.status(400).send('You Can not Edit Transaction Because It is Used....!');
                    } else {
                        const sql_queries_getNeedData = `SELECT bigUnitName AS largerUnit, unitNumber AS value, smallUnitName AS smallerUnit FROM product_unit_preference WHERE productId = '${mfProductId}' ORDER BY product_unit_preference.priorityNumber ASC;
                                                         SELECT ipd.minProductUnit AS  minProductUnit, ipd.isExpired AS isExpired, ipd.expiredDays AS expiredDays FROM inventory_product_data AS ipd WHERE ipd.productId = '${mfProductId}'`;
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

                            const StockInProductFinalQty = (stockInneedData.unitsData && stockInneedData.unitsData.length !== 0) ? convertUnits(stockInneedData.unitsData, mfProductQty, productUnit, stockInneedData.toUnit) : mfProductQty;

                            const sql_queries_getNeedData = `SELECT bigUnitName AS largerUnit, unitNumber AS value, smallUnitName AS smallerUnit FROM mfProduct_unit_preference WHERE mfProductId = '${mfProductId}' ORDER BY mfProduct_unit_preference.priorityNumber ASC;
                                                             SELECT ipd.minMfProductUnit AS  minMfProductUnit, ipd.isExpired AS isExpired, ipd.expiredDays AS expiredDays FROM factory_manufactureProduct_data AS ipd WHERE ipd.mfProductId = '${mfProductId}'`;
                            pool.query(sql_queries_getNeedData, (err, result) => {
                                if (err) {
                                    console.error("An error occurd in SQL Queery", err);
                                    return res.status(500).send('Database Error');
                                }
                                const needData = {
                                    unitsData: result && result[0] ? Object.values(JSON.parse(JSON.stringify(result[0]))) : null,
                                    toUnit: result && result[1][0] && result[1][0].minMfProductUnit ? result[1][0].minMfProductUnit : null,
                                    isExpired: result && result[1][0] && result[1][0].isExpired ? result[1][0].isExpired : 0,
                                    expiredDays: result && result[1][0] && result[1][0].expiredDays ? result[1][0].expiredDays : 0
                                }
                                const productFinalQty = (needData.unitsData && needData.unitsData.length !== 0) ? convertUnits(needData.unitsData, mfProductQty, productUnit, needData.toUnit) : mfProductQty;
                                get_remaining_stock = `SELECT COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) AS remainingStock FROM factory_manufactureProduct_data AS p
                                                         LEFT JOIN
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
                                                        ) AS so ON p.mfProductId = so.mfProductId
                                                    WHERE p.mfProductId = '${mfProductId}';
                                                SELECT mfProductQty FROM factory_mfProductStockOut_data WHERE mfStockOutId = '${mfStockOutId}'`;
                                pool.query(get_remaining_stock, (err, remaindata) => {
                                    if (err) {
                                        console.error("An error occurd in SQL Queery", err);
                                        return res.status(500).send('Database Error');
                                    }
                                    const remainStock = remaindata[0][0].remainingStock;
                                    const previousQty = remaindata[1][0].mfProductQty;

                                    const remainIngUpdateStock = remainStock + previousQty;
                                    if (remainIngUpdateStock < productFinalQty) {
                                        return res.status(400).send(`You Can Not Stock Out more Then Remain Stock...!`);
                                    } else {
                                        const get_previous_data = `SELECT factory_mfProductStockOut_data.mfProductId, mfProductQty, mfProductOutPrice FROM factory_mfProductStockOut_data
                                                                   WHERE mfStockOutId = '${mfStockOutId}'`;
                                        pool.query(get_previous_data, (err, data) => {
                                            if (err) {
                                                console.error("An error occurd in SQL Queery", err);
                                                return res.status(500).send('Database Error');
                                            }
                                            const previousStockOutPrice = data[0].mfProductOutPrice;
                                            const prevoiusQuantity = data[0].mfProductQty;

                                            sql_querry_getStockIndetail = `SELECT mfStockInID, mfProductId, mfProductQty, mfProductPrice AS stockInPrice, remainingQty AS stockInQuantity FROM factory_mfProductStockIn_data WHERE factory_mfProductStockIn_data.mfProductId = '${mfProductId}' AND factory_mfProductStockIn_data.remainingQty != 0 ORDER BY mfStockInDate ASC;
                                                                           SELECT mfStockInID FROM factory_mfProductInwiseOut_data WHERE mfStockOutId = '${mfStockOutId}'`;
                                            pool.query(sql_querry_getStockIndetail, (err, data) => {
                                                if (err) {
                                                    console.error("An error occurd in SQL Queery", err);
                                                    return res.status(500).send('Database Error');
                                                }
                                                console.log(">>>???", prevoiusQuantity);
                                                console.log(">>>", req.body.mfProductQty);
                                                if (prevoiusQuantity < productFinalQty) {
                                                    const orignalStockInData = Object.values(JSON.parse(JSON.stringify(data[0])));
                                                    const stockInData = Object.values(JSON.parse(JSON.stringify(data[0])));
                                                    const oldIdsArray = Object.values(JSON.parse(JSON.stringify(data[1])));
                                                    console.log(">>>", Object.values(JSON.parse(JSON.stringify(data[1]))));
                                                    console.log("::::::::", productFinalQty - prevoiusQuantity);
                                                    const stockOutData = [
                                                        { mfProductId: req.body.mfProductId, stockOutQuantity: productFinalQty - prevoiusQuantity }
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
                                                                const mfProductOutPrice = stockInPrice * quantityToUse;

                                                                totalStockOutPrice += mfProductOutPrice;
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
                                                    const mfProductOutPrice = Number(totalofStockOutPrice).toFixed(2);

                                                    const sopq = stockInData.filter((obj) => {
                                                        if (obj.stockInQuantity != obj.mfProductQty) {
                                                            return obj;
                                                        }
                                                    })

                                                    const sowsiId = sopq.map((obj) => {
                                                        if (obj.stockInQuantity != obj.mfProductQty) {
                                                            return obj.mfStockInID;
                                                        }
                                                    });

                                                    const oldId = oldIdsArray.map((obj) => {
                                                        return obj.mfStockInID;
                                                    });

                                                    const similarStockInIds = sowsiId.filter(id => oldId.includes(id));

                                                    const removeSameId = sowsiId.filter(id => !similarStockInIds.includes(id));

                                                    console.log('jojojojojo', removeSameId);

                                                    if (similarStockInIds.length != 0) {
                                                        const remainingStockByIds = similarStockInIds.map(mfStockInID => {
                                                            const stockIn = orignalStockInData.find(item => item.mfStockInID === mfStockInID);
                                                            return stockIn ? stockIn.stockInQuantity : undefined;
                                                        });

                                                        const remainingStockByIds1 = similarStockInIds.map(mfStockInID => {
                                                            const stockIn = stockInData.find(item => item.mfStockInID === mfStockInID);
                                                            return stockIn ? stockIn.stockInQuantity : undefined;
                                                        });

                                                        console.log('orignalStockInData', remainingStockByIds);
                                                        console.log('stockInData', remainingStockByIds1);

                                                        const remainStockCutQty = remainingStockByIds.map((value, index) => value - remainingStockByIds1[index].toFixed(10));

                                                        console.log(';;;;;;;;', stockInData)
                                                        console.log('???????', orignalStockInData);
                                                        console.log(">?>?>?<<<<.,,,", sowsiId);
                                                        console.log(">?>?>?<<<<.,,,", oldId);
                                                        console.log('same id', similarStockInIds);
                                                        console.log("RRRRR", remainStockCutQty);
                                                        sql_qurey_updateExistingId = `UPDATE factory_mfProductInwiseOut_data SET cutMfQty = cutMfQty + ${remainStockCutQty[0]} WHERE mfStockOutId = '${mfStockOutId}' AND mfStockInID = '${similarStockInIds[0]}'`;
                                                        pool.query(sql_qurey_updateExistingId, (err, result) => {
                                                            if (err) {
                                                                console.error("An error occurd in SQL Queery", err);
                                                                return res.status(500).send('Database Error');
                                                            }
                                                            console.log('Existing Data Updated SuccessFully');
                                                        })
                                                    }

                                                    if (removeSameId.length != 0) {
                                                        const remainingStockByIds = removeSameId.map(mfStockInID => {
                                                            const stockIn = orignalStockInData.find(item => item.mfStockInID === mfStockInID);
                                                            return stockIn ? stockIn.stockInQuantity : undefined;
                                                        });

                                                        const remainingStockByIds1 = removeSameId.map(mfStockInID => {
                                                            const stockIn = stockInData.find(item => item.mfStockInID === mfStockInID);
                                                            return stockIn ? stockIn.stockInQuantity : undefined;
                                                        });

                                                        console.log('orignalStockInData', remainingStockByIds);
                                                        console.log('stockInData', remainingStockByIds1);

                                                        const remainStockCutQty = remainingStockByIds.map((value, index) => value - remainingStockByIds1[index].toFixed(10));

                                                        console.log(';;;;;;;;', stockInData)
                                                        console.log('???????', orignalStockInData);
                                                        console.log(">?>?>?<<<<.,,,", sowsiId);
                                                        console.log(">?>?>?<<<<.,,,", oldId);
                                                        console.log('same id', similarStockInIds);
                                                        console.log("RRRRR", remainStockCutQty);

                                                        // Use map to combine the arrays and format them
                                                        const combinedData = removeSameId.map((id, index) => `('${mfStockOutId}','${id}',${remainStockCutQty[index]})`);

                                                        // Join the array elements into a single string
                                                        const stockOutWiseStockInId = combinedData.join(',');

                                                        // Output the resulting string
                                                        console.log(stockOutWiseStockInId);

                                                        sql_querry_addsowsiId = `INSERT INTO factory_mfProductInwiseOut_data (mfStockOutId, mfStockInID, cutMfQty) VALUES ${stockOutWiseStockInId}`;
                                                        pool.query(sql_querry_addsowsiId, (err, data) => {
                                                            if (err) {
                                                                console.error("An error occurd in SQL Queery", err);
                                                                return res.status(500).send('Database Error');
                                                            }
                                                            console.log("Data Added Successfully");
                                                        })
                                                    }

                                                    function generateUpdateQuery(data) {
                                                        let query = 'UPDATE factory_mfProductStockIn_data\nSET remainingQty = CASE\n';

                                                        data.forEach((item) => {
                                                            const { mfStockInID, stockInQuantity } = item;
                                                            query += `    WHEN mfStockInID = '${mfStockInID}' THEN ROUND(${stockInQuantity},4)\n`;
                                                        });

                                                        query += '    ELSE remainingQty\nEND\n';

                                                        const stockInIds = data.map((item) => `'${item.mfStockInID}'`).join(', ');
                                                        query += `WHERE mfStockInID IN (${stockInIds});`;

                                                        return query;
                                                    }

                                                    console.log(generateUpdateQuery(sopq))
                                                    const sql_qurey_updatedRemainQty = generateUpdateQuery(sopq);
                                                    pool.query(sql_qurey_updatedRemainQty, (err, data) => {
                                                        if (err) {
                                                            console.error("An error occurd in SQL Queery", err);
                                                            return res.status(500).send('Database Error');
                                                        }
                                                        const sql_querry_updatedetails = `UPDATE factory_mfProductStockOut_data SET 
                                                                                                        userId = '${userId}',
                                                                                                        mfProductId = '${mfProductId}',
                                                                                                        mfProductQty = ${productFinalQty},
                                                                                                        mfProductOutPrice = ${mfProductOutPrice},
                                                                                                        mfStockOutDisplayQty = ${mfProductQty},
                                                                                                        mfStockOutDisplayUnit = '${productUnit}',
                                                                                                        mfProductOutCategory = '${mfProductOutCategory}',
                                                                                                        mfStockOutComment = NULLIF('${mfStockOutComment}','null'),
                                                                                                        mfStockOutDate = STR_TO_DATE('${mfStockOutDate}','%b %d %Y') 
                                                                                                  WHERE mfStockOutId = '${mfStockOutId}';
                                                                                                  UPDATE inventory_stockIn_data SET
                                                                                                        branchId = '${branchId}',
                                                                                                        userId = '${userId}',
                                                                                                        productId = '${mfProductId}',
                                                                                                        productQty = ${StockInProductFinalQty},
                                                                                                        productPrice = ${sellAmount / StockInProductFinalQty},
                                                                                                        totalPrice = ${sellAmount},
                                                                                                        billNumber = ${billNumber ? `'${billNumber}'` : null},
                                                                                                        stockInDisplayQty = ${mfProductQty},
                                                                                                        stockInDisplayUnit = '${productUnit}',
                                                                                                        supplierId = '${process.env.RAJ_MANDIR_FACTORY_ID}',
                                                                                                        stockInPaymentMethod = 'cash',
                                                                                                        stockInComment = ${mfStockOutComment ? `'${mfStockOutComment}'` : null},
                                                                                                        productExpiryDate = ${stockInneedData && stockInneedData.isExpired && stockInneedData.expiredDays > 0 ? `DATE_ADD(STR_TO_DATE('${mfStockOutDate}','%b %d %Y'), INTERVAL ${stockInneedData.expiredDays} DAY)` : null},
                                                                                                        remainingQty = ${StockInProductFinalQty},
                                                                                                        stockInDate = STR_TO_DATE('${mfStockOutDate}','%b %d %Y') 
                                                                                                  WHERE stockInId = '${mfStockOutId}'`;
                                                        pool.query(sql_querry_updatedetails, (err, data) => {
                                                            if (err) {
                                                                console.error("An error occurd in SQL Queery", err);
                                                                return res.status(500).send('Database Error');
                                                            }
                                                            return res.status(200).send("Transaction Updated Successfully");
                                                        })
                                                    })
                                                } else if (req.body.mfProductQty == 0) {
                                                    return res.status(401).send('Please Delete Transaction');
                                                } else if (prevoiusQuantity > productFinalQty) {
                                                    sql_get_sowsoid = `SELECT
                                                                               factory_mfProductStockIn_data.mfStockInID,
                                                                               mfProductId,
                                                                               (
                                                                                   factory_mfProductStockIn_data.remainingQty + sowsid.cutMfQty
                                                                               ) AS mfProductQty,
                                                                               mfProductPrice AS stockInPrice,
                                                                               remainingQty AS remainingStock
                                                                           FROM
                                                                               factory_mfProductStockIn_data
                                                                           INNER JOIN(
                                                                               SELECT
                                                                                   factory_mfProductInwiseOut_data.mfStockInID,
                                                                                   factory_mfProductInwiseOut_data.cutMfQty AS cutMfQty
                                                                               FROM
                                                                                   factory_mfProductInwiseOut_data
                                                                               WHERE
                                                                                   factory_mfProductInwiseOut_data.mfStockOutId = '${mfStockOutId}'
                                                                           ) AS sowsid
                                                                           ON
                                                                               factory_mfProductStockIn_data.mfStockInID = sowsid.mfStockInID
                                                                           WHERE
                                                                               factory_mfProductStockIn_data.mfStockInID IN(
                                                                               SELECT
                                                                                   COALESCE(
                                                                                       factory_mfProductInwiseOut_data.mfStockInID,
                                                                                       NULL
                                                                                   )
                                                                               FROM
                                                                                   factory_mfProductInwiseOut_data
                                                                               WHERE
                                                                                   mfStockOutId = '${mfStockOutId}'
                                                                           )
                                                                           ORDER BY
                                                                                mfStockInDate ASC, mfStockInCreationDate ASC`;
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
                                                            { mfProductId: req.body.mfProductId, stockOutQuantity: prevoiusQuantity - productFinalQty }
                                                        ];

                                                        // const StockInData = [
                                                        //     { mfProductId: 1, remainingStock: 5, mfProductQty: 5, stockInPrice: 70 },
                                                        //     { mfProductId: 1, remainingStock: 5, mfProductQty: 5, stockInPrice: 60 },
                                                        //     { mfProductId: 1, remainingStock: 2, mfProductQty: 5, stockInPrice: 50 },
                                                        //     { mfProductId: 1, remainingStock: 0, mfProductQty: 5, stockInPrice: 40 },
                                                        //     { mfProductId: 1, remainingStock: 0, mfProductQty: 5, stockInPrice: 30 },
                                                        // ];

                                                        let desiredQuantity = stockOutData[0].stockOutQuantity; // Desired quantity to be inserted into the buckets
                                                        console.log("><?", desiredQuantity);
                                                        let totalCost = 0; // Total cost of filling the buckets

                                                        for (let i = 0; i < StockInData.length; i++) {
                                                            const stockIn = StockInData[i];
                                                            const availableSpace = stockIn.mfProductQty - stockIn.remainingStock; // Calculate the available space for the product

                                                            if (desiredQuantity <= availableSpace) {
                                                                // If the desired quantity can fit completely in the current stock in entry
                                                                stockIn.remainingStock += desiredQuantity;
                                                                totalCost += desiredQuantity * stockIn.stockInPrice;
                                                                break; // Exit the loop since the desired quantity has been inserted
                                                            } else {
                                                                // If the desired quantity cannot fit completely in the current stock in entry
                                                                stockIn.remainingStock = stockIn.mfProductQty;
                                                                totalCost += availableSpace * stockIn.stockInPrice;
                                                                desiredQuantity -= availableSpace;
                                                            }
                                                        }
                                                        const updatedStockInData = StockInData;
                                                        console.log("Updated StockInData:", StockInData);
                                                        console.log("Total Cost of Filling: ", totalCost);

                                                        const totalofStockOutPrice = previousStockOutPrice - totalCost;
                                                        const mfProductOutPrice = Number(totalofStockOutPrice).toFixed(2);

                                                        const sopq = StockInData.filter((obj) => {
                                                            return obj;
                                                        })
                                                        const sowsiId = StockInData.map((obj) => {
                                                            return obj.mfStockInID;
                                                        })
                                                        const remainingStockByIds = sowsiId.map(mfStockInID => {
                                                            const stockIn = junoJson.find(item => item.mfStockInID === mfStockInID);
                                                            return stockIn ? stockIn.mfProductQty : undefined;
                                                        });

                                                        const remainingStockByIds1 = sowsiId.map(mfStockInID => {
                                                            const stockIn = updatedStockInData.find(item => item.mfStockInID === mfStockInID);
                                                            return stockIn ? stockIn.remainingStock : undefined;
                                                        });

                                                        console.log('orignalStockInData', remainingStockByIds);
                                                        console.log('stockInData', remainingStockByIds1);

                                                        const remainStockCutQty = remainingStockByIds.map((value, index) => value - remainingStockByIds1[index].toFixed(10));

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

                                                        const combinedData = filteredId.map((id, index) => `('${mfStockOutId}','${id}',${filteredQty[index]})`);

                                                        // Join the array elements into a single string
                                                        const stockOutWiseStockInId = combinedData.join(',');

                                                        // Output the resulting string
                                                        console.log(stockOutWiseStockInId);

                                                        function generateUpdateQuery(data) {
                                                            let query = 'UPDATE factory_mfProductStockIn_data\nSET remainingQty = CASE\n';

                                                            data.forEach((item) => {
                                                                const { mfStockInID, remainingStock } = item;
                                                                query += `    WHEN mfStockInID = '${mfStockInID}' THEN ROUND(${remainingStock},4)\n`;
                                                            });

                                                            query += '    ELSE remainingQty\nEND\n';

                                                            const stockInIds = data.map((item) => `'${item.mfStockInID}'`).join(', ');
                                                            query += `WHERE mfStockInID IN (${stockInIds})`;

                                                            return query;
                                                        }

                                                        console.log(generateUpdateQuery(sopq))
                                                        const sql_qurey_updatedRemainQty = `${generateUpdateQuery(sopq)};
                                                                        DELETE FROM factory_mfProductInwiseOut_data WHERE mfStockOutId = '${mfStockOutId}';
                                                                        INSERT INTO factory_mfProductInwiseOut_data (mfStockOutId, mfStockInID, cutMfQty) VALUES ${stockOutWiseStockInId}`;
                                                        pool.query(sql_qurey_updatedRemainQty, (err, data) => {
                                                            if (err) {
                                                                console.error("An error occurd in SQL Queery", err);
                                                                return res.status(500).send('Database Error');
                                                            }
                                                            const sql_querry_updatedetails = `UPDATE factory_mfProductStockOut_data SET
                                                                                                            userId = '${userId}',
                                                                                                            mfProductId = '${mfProductId}',
                                                                                                            mfProductQty = ${productFinalQty},
                                                                                                            mfProductOutPrice = ${mfProductOutPrice},
                                                                                                            mfStockOutDisplayQty = ${mfProductQty},
                                                                                                            mfStockOutDisplayUnit = '${productUnit}',
                                                                                                            mfProductOutCategory = '${mfProductOutCategory}',
                                                                                                            mfStockOutComment = NULLIF('${mfStockOutComment}','null'),
                                                                                                            mfStockOutDate = STR_TO_DATE('${mfStockOutDate}','%b %d %Y') 
                                                                                                      WHERE mfStockOutId = '${mfStockOutId}';
                                                                                                      UPDATE inventory_stockIn_data SET
                                                                                                                         branchId = '${branchId}',
                                                                                                                         userId = '${userId}',
                                                                                                                         productId = '${mfProductId}',
                                                                                                                         productQty = ${StockInProductFinalQty},
                                                                                                                         productPrice = ${sellAmount / StockInProductFinalQty},
                                                                                                                         totalPrice = ${sellAmount},
                                                                                                                         billNumber = ${billNumber ? `'${billNumber}'` : null},
                                                                                                                         stockInDisplayQty = ${mfProductQty},
                                                                                                                         stockInDisplayUnit = '${productUnit}',
                                                                                                                         supplierId = '${process.env.RAJ_MANDIR_FACTORY_ID}',
                                                                                                                         stockInPaymentMethod = 'cash',
                                                                                                                         stockInComment = ${mfStockOutComment ? `'${mfStockOutComment}'` : null},
                                                                                                                         productExpiryDate = ${stockInneedData && stockInneedData.isExpired && stockInneedData.expiredDays > 0 ? `DATE_ADD(STR_TO_DATE('${mfStockOutDate}','%b %d %Y'), INTERVAL ${stockInneedData.expiredDays} DAY)` : null},
                                                                                                                         remainingQty = ${StockInProductFinalQty},
                                                                                                                         stockInDate = STR_TO_DATE('${mfStockOutDate}','%b %d %Y') 
                                                                                                      WHERE stockInId = '${mfStockOutId}'`;
                                                            pool.query(sql_querry_updatedetails, (err, data) => {
                                                                if (err) {
                                                                    console.error("An error occurd in SQL Queery", err);
                                                                    return res.status(500).send('Database Error');
                                                                }
                                                                return res.status(200).send("Transaction Updated Successfully");
                                                            })
                                                        })
                                                    })
                                                } else {
                                                    console.log('Avi gyu')
                                                    const sql_querry_updatedetails = `UPDATE factory_mfProductStockOut_data SET 
                                                                                                                 userId = '${userId}',
                                                                                                                 mfProductId = '${mfProductId}',
                                                                                                                 mfProductQty = ${productFinalQty},
                                                                                                                 mfStockOutDisplayQty = ${mfProductQty},
                                                                                                                 mfStockOutDisplayUnit = '${productUnit}',
                                                                                                                 mfProductOutCategory = '${mfProductOutCategory}',
                                                                                                                 mfStockOutComment = NULLIF('${mfStockOutComment}','null'),
                                                                                                                 mfStockOutDate = STR_TO_DATE('${mfStockOutDate}','%b %d %Y') 
                                                                                              WHERE mfStockOutId = '${mfStockOutId}';
                                                                                              UPDATE inventory_stockIn_data SET
                                                                                                                 branchId = '${branchId}',
                                                                                                                 userId = '${userId}',
                                                                                                                 productId = '${mfProductId}',
                                                                                                                 productQty = ${StockInProductFinalQty},
                                                                                                                 productPrice = ${sellAmount / StockInProductFinalQty},
                                                                                                                 totalPrice = ${sellAmount},
                                                                                                                 billNumber = ${billNumber ? `'${billNumber}'` : null},
                                                                                                                 stockInDisplayQty = ${mfProductQty},
                                                                                                                 stockInDisplayUnit = '${productUnit}',
                                                                                                                 supplierId = '${process.env.RAJ_MANDIR_FACTORY_ID}',
                                                                                                                 stockInPaymentMethod = 'cash',
                                                                                                                 stockInComment = ${mfStockOutComment ? `'${mfStockOutComment}'` : null},
                                                                                                                 productExpiryDate = ${stockInneedData && stockInneedData.isExpired && stockInneedData.expiredDays > 0 ? `DATE_ADD(STR_TO_DATE('${mfStockOutDate}','%b %d %Y'), INTERVAL ${stockInneedData.expiredDays} DAY)` : null},
                                                                                                                 remainingQty = ${StockInProductFinalQty},
                                                                                                                 stockInDate = STR_TO_DATE('${mfStockOutDate}','%b %d %Y') 
                                                                                                           WHERE stockInId = '${mfStockOutId}'`;
                                                    pool.query(sql_querry_updatedetails, (err, data) => {
                                                        if (err) {
                                                            console.error("An error occurd in SQL Queery", err);
                                                            return res.status(500).send('Database Error');
                                                        }
                                                        return res.status(200).send("Transaction Updated Successfully");
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
                    const sql_queries_getNeedData = `SELECT bigUnitName AS largerUnit, unitNumber AS value, smallUnitName AS smallerUnit FROM mfProduct_unit_preference WHERE mfProductId = '${mfProductId}' ORDER BY mfProduct_unit_preference.priorityNumber ASC;
                                                     SELECT ipd.minMfProductUnit AS  minMfProductUnit, ipd.isExpired AS isExpired, ipd.expiredDays AS expiredDays FROM factory_manufactureProduct_data AS ipd WHERE ipd.mfProductId = '${mfProductId}'`;
                    pool.query(sql_queries_getNeedData, (err, result) => {
                        if (err) {
                            console.error("An error occurd in SQL Queery", err);
                            return res.status(500).send('Database Error');
                        }
                        const needData = {
                            unitsData: result && result[0] ? Object.values(JSON.parse(JSON.stringify(result[0]))) : null,
                            toUnit: result && result[1][0] && result[1][0].minMfProductUnit ? result[1][0].minMfProductUnit : null,
                            isExpired: result && result[1][0] && result[1][0].isExpired ? result[1][0].isExpired : 0,
                            expiredDays: result && result[1][0] && result[1][0].expiredDays ? result[1][0].expiredDays : 0
                        }
                        console.log(needData.unitsData);
                        const productFinalQty = (needData.unitsData && needData.unitsData.length !== 0) ? convertUnits(needData.unitsData, mfProductQty, productUnit, needData.toUnit) : mfProductQty;
                        get_remaining_stock = `SELECT COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) AS remainingStock FROM factory_manufactureProduct_data AS p
                                             LEFT JOIN
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
                                            ) AS so ON p.mfProductId = so.mfProductId
                                        WHERE p.mfProductId = '${mfProductId}';
                                    SELECT mfProductQty FROM factory_mfProductStockOut_data WHERE mfStockOutId = '${mfStockOutId}'`;
                        pool.query(get_remaining_stock, (err, remaindata) => {
                            if (err) {
                                console.error("An error occurd in SQL Queery", err);
                                return res.status(500).send('Database Error');
                            }
                            const remainStock = remaindata[0][0].remainingStock;
                            const previousQty = remaindata[1][0].mfProductQty;
                            console.log("./././", remainStock + previousQty);
                            const remainIngUpdateStock = remainStock + previousQty;
                            if (remainIngUpdateStock < productFinalQty) {
                                return res.status(400).send(`You Can Not Stock Out more Then Remain Stock...!`);
                            } else {
                                const get_previous_data = `SELECT factory_mfProductStockOut_data.mfProductId, mfProductQty, mfProductOutPrice FROM factory_mfProductStockOut_data
                                                           WHERE mfStockOutId = '${mfStockOutId}'`;
                                pool.query(get_previous_data, (err, data) => {
                                    if (err) {
                                        console.error("An error occurd in SQL Queery", err);
                                        return res.status(500).send('Database Error');
                                    }
                                    const previousStockOutPrice = data[0].mfProductOutPrice;
                                    const prevoiusQuantity = data[0].mfProductQty;

                                    sql_querry_getStockIndetail = `SELECT mfStockInID, mfProductId, mfProductQty, mfProductPrice AS stockInPrice, remainingQty AS stockInQuantity FROM factory_mfProductStockIn_data WHERE factory_mfProductStockIn_data.mfProductId = '${mfProductId}' AND factory_mfProductStockIn_data.remainingQty != 0 ORDER BY mfStockInDate ASC;
                                                                   SELECT mfStockInID FROM factory_mfProductInwiseOut_data WHERE mfStockOutId = '${mfStockOutId}'`;
                                    pool.query(sql_querry_getStockIndetail, (err, data) => {
                                        if (err) {
                                            console.error("An error occurd in SQL Queery", err);
                                            return res.status(500).send('Database Error');
                                        }
                                        console.log(">>>???", prevoiusQuantity);
                                        console.log(">>>", req.body.mfProductQty);
                                        if (prevoiusQuantity < productFinalQty) {
                                            const orignalStockInData = Object.values(JSON.parse(JSON.stringify(data[0])));
                                            const stockInData = Object.values(JSON.parse(JSON.stringify(data[0])));
                                            const oldIdsArray = Object.values(JSON.parse(JSON.stringify(data[1])));
                                            console.log(">>>", Object.values(JSON.parse(JSON.stringify(data[1]))));
                                            console.log("::::::::", productFinalQty - prevoiusQuantity);
                                            const stockOutData = [
                                                { mfProductId: req.body.mfProductId, stockOutQuantity: productFinalQty - prevoiusQuantity }
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
                                                        const mfProductOutPrice = stockInPrice * quantityToUse;

                                                        totalStockOutPrice += mfProductOutPrice;
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
                                            const mfProductOutPrice = Number(totalofStockOutPrice).toFixed(2);

                                            const sopq = stockInData.filter((obj) => {
                                                if (obj.stockInQuantity != obj.mfProductQty) {
                                                    return obj;
                                                }
                                            })

                                            const sowsiId = sopq.map((obj) => {
                                                if (obj.stockInQuantity != obj.mfProductQty) {
                                                    return obj.mfStockInID;
                                                }
                                            });

                                            const oldId = oldIdsArray.map((obj) => {
                                                return obj.mfStockInID;
                                            });

                                            const similarStockInIds = sowsiId.filter(id => oldId.includes(id));

                                            const removeSameId = sowsiId.filter(id => !similarStockInIds.includes(id));

                                            console.log('jojojojojo', removeSameId);

                                            if (similarStockInIds.length != 0) {
                                                const remainingStockByIds = similarStockInIds.map(mfStockInID => {
                                                    const stockIn = orignalStockInData.find(item => item.mfStockInID === mfStockInID);
                                                    return stockIn ? stockIn.stockInQuantity : undefined;
                                                });

                                                const remainingStockByIds1 = similarStockInIds.map(mfStockInID => {
                                                    const stockIn = stockInData.find(item => item.mfStockInID === mfStockInID);
                                                    return stockIn ? stockIn.stockInQuantity : undefined;
                                                });

                                                console.log('orignalStockInData', remainingStockByIds);
                                                console.log('stockInData', remainingStockByIds1);

                                                const remainStockCutQty = remainingStockByIds.map((value, index) => value - remainingStockByIds1[index].toFixed(10));

                                                console.log(';;;;;;;;', stockInData)
                                                console.log('???????', orignalStockInData);
                                                console.log(">?>?>?<<<<.,,,", sowsiId);
                                                console.log(">?>?>?<<<<.,,,", oldId);
                                                console.log('same id', similarStockInIds);
                                                console.log("RRRRR", remainStockCutQty);
                                                sql_qurey_updateExistingId = `UPDATE factory_mfProductInwiseOut_data SET cutMfQty = cutMfQty + ${remainStockCutQty[0]} WHERE mfStockOutId = '${mfStockOutId}' AND mfStockInID = '${similarStockInIds[0]}'`;
                                                pool.query(sql_qurey_updateExistingId, (err, result) => {
                                                    if (err) {
                                                        console.error("An error occurd in SQL Queery", err);
                                                        return res.status(500).send('Database Error');
                                                    }
                                                    console.log('Existing Data Updated SuccessFully');
                                                })
                                            }

                                            if (removeSameId.length != 0) {
                                                const remainingStockByIds = removeSameId.map(mfStockInID => {
                                                    const stockIn = orignalStockInData.find(item => item.mfStockInID === mfStockInID);
                                                    return stockIn ? stockIn.stockInQuantity : undefined;
                                                });

                                                const remainingStockByIds1 = removeSameId.map(mfStockInID => {
                                                    const stockIn = stockInData.find(item => item.mfStockInID === mfStockInID);
                                                    return stockIn ? stockIn.stockInQuantity : undefined;
                                                });

                                                console.log('orignalStockInData', remainingStockByIds);
                                                console.log('stockInData', remainingStockByIds1);

                                                const remainStockCutQty = remainingStockByIds.map((value, index) => value - remainingStockByIds1[index].toFixed(10));

                                                console.log(';;;;;;;;', stockInData)
                                                console.log('???????', orignalStockInData);
                                                console.log(">?>?>?<<<<.,,,", sowsiId);
                                                console.log(">?>?>?<<<<.,,,", oldId);
                                                console.log('same id', similarStockInIds);
                                                console.log("RRRRR", remainStockCutQty);

                                                // Use map to combine the arrays and format them
                                                const combinedData = removeSameId.map((id, index) => `('${mfStockOutId}','${id}',${remainStockCutQty[index]})`);

                                                // Join the array elements into a single string
                                                const stockOutWiseStockInId = combinedData.join(',');

                                                // Output the resulting string
                                                console.log(stockOutWiseStockInId);

                                                sql_querry_addsowsiId = `INSERT INTO factory_mfProductInwiseOut_data (mfStockOutId, mfStockInID, cutMfQty) VALUES ${stockOutWiseStockInId}`;
                                                pool.query(sql_querry_addsowsiId, (err, data) => {
                                                    if (err) {
                                                        console.error("An error occurd in SQL Queery", err);
                                                        return res.status(500).send('Database Error');
                                                    }
                                                    console.log("Data Added Successfully");
                                                })
                                            }

                                            function generateUpdateQuery(data) {
                                                let query = 'UPDATE factory_mfProductStockIn_data\nSET remainingQty = CASE\n';

                                                data.forEach((item) => {
                                                    const { mfStockInID, stockInQuantity } = item;
                                                    query += `    WHEN mfStockInID = '${mfStockInID}' THEN ROUND(${stockInQuantity},4)\n`;
                                                });

                                                query += '    ELSE remainingQty\nEND\n';

                                                const stockInIds = data.map((item) => `'${item.mfStockInID}'`).join(', ');
                                                query += `WHERE mfStockInID IN (${stockInIds});`;

                                                return query;
                                            }

                                            console.log(generateUpdateQuery(sopq))
                                            const sql_qurey_updatedRemainQty = generateUpdateQuery(sopq);
                                            pool.query(sql_qurey_updatedRemainQty, (err, data) => {
                                                if (err) {
                                                    console.error("An error occurd in SQL Queery", err);
                                                    return res.status(500).send('Database Error');
                                                }

                                                const sql_querry_updatedetails = `UPDATE factory_mfProductStockOut_data SET 
                                                                                                      userId = '${userId}',
                                                                                                      mfProductId = '${mfProductId}',
                                                                                                      mfProductQty = ${productFinalQty},
                                                                                                      mfProductOutPrice = ${mfProductOutPrice},
                                                                                                      mfStockOutDisplayQty = ${mfProductQty},
                                                                                                      mfStockOutDisplayUnit = '${productUnit}',
                                                                                                      mfProductOutCategory = '${mfProductOutCategory}',
                                                                                                      mfStockOutComment = NULLIF('${mfStockOutComment}','null'),
                                                                                                      mfStockOutDate = STR_TO_DATE('${mfStockOutDate}','%b %d %Y') 
                                                                                                WHERE mfStockOutId = '${mfStockOutId}';
                                                                                                UPDATE
                                                                                                    factory_distributorWiseOut_data
                                                                                                SET
                                                                                                    userId = '${userId}',
                                                                                                    mfProductId = '${mfProductId}',
                                                                                                    distributorId = '${distributorId}',
                                                                                                    payType = '${payType}',
                                                                                                    sellAmount = ${sellAmount},
                                                                                                    sellDate = STR_TO_DATE('${mfStockOutDate}', '%b %d %Y')
                                                                                                WHERE mfStockOutId = '${mfStockOutId}'`;
                                                pool.query(sql_querry_updatedetails, (err, data) => {
                                                    if (err) {
                                                        console.error("An error occurd in SQL Queery", err);
                                                        return res.status(500).send('Database Error');
                                                    }
                                                    return res.status(200).send("Transaction Updated Successfully");
                                                })
                                            })
                                        } else if (req.body.mfProductQty == 0) {
                                            return res.status(401).send('Please Delete Transaction');
                                        } else if (prevoiusQuantity > productFinalQty) {
                                            sql_get_sowsoid = `SELECT
                                                                   factory_mfProductStockIn_data.mfStockInID,
                                                                   mfProductId,
                                                                   (
                                                                       factory_mfProductStockIn_data.remainingQty + sowsid.cutMfQty
                                                                   ) AS mfProductQty,
                                                                   mfProductPrice AS stockInPrice,
                                                                   remainingQty AS remainingStock
                                                               FROM
                                                                   factory_mfProductStockIn_data
                                                               INNER JOIN(
                                                                   SELECT
                                                                       factory_mfProductInwiseOut_data.mfStockInID,
                                                                       factory_mfProductInwiseOut_data.cutMfQty AS cutMfQty
                                                                   FROM
                                                                       factory_mfProductInwiseOut_data
                                                                   WHERE
                                                                       factory_mfProductInwiseOut_data.mfStockOutId = '${mfStockOutId}'
                                                               ) AS sowsid
                                                               ON
                                                                   factory_mfProductStockIn_data.mfStockInID = sowsid.mfStockInID
                                                               WHERE
                                                                   factory_mfProductStockIn_data.mfStockInID IN(
                                                                   SELECT
                                                                       COALESCE(
                                                                           factory_mfProductInwiseOut_data.mfStockInID,
                                                                           NULL
                                                                       )
                                                                   FROM
                                                                       factory_mfProductInwiseOut_data
                                                                   WHERE
                                                                       mfStockOutId = '${mfStockOutId}'
                                                               )
                                                               ORDER BY
                                                                    mfStockInDate ASC, mfStockInCreationDate ASC`;
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
                                                    { mfProductId: req.body.mfProductId, stockOutQuantity: prevoiusQuantity - productFinalQty }
                                                ];

                                                // const StockInData = [
                                                //     { mfProductId: 1, remainingStock: 5, mfProductQty: 5, stockInPrice: 70 },
                                                //     { mfProductId: 1, remainingStock: 5, mfProductQty: 5, stockInPrice: 60 },
                                                //     { mfProductId: 1, remainingStock: 2, mfProductQty: 5, stockInPrice: 50 },
                                                //     { mfProductId: 1, remainingStock: 0, mfProductQty: 5, stockInPrice: 40 },
                                                //     { mfProductId: 1, remainingStock: 0, mfProductQty: 5, stockInPrice: 30 },
                                                // ];

                                                let desiredQuantity = stockOutData[0].stockOutQuantity; // Desired quantity to be inserted into the buckets
                                                console.log("><?", desiredQuantity);
                                                let totalCost = 0; // Total cost of filling the buckets

                                                for (let i = 0; i < StockInData.length; i++) {
                                                    const stockIn = StockInData[i];
                                                    const availableSpace = stockIn.mfProductQty - stockIn.remainingStock; // Calculate the available space for the product

                                                    if (desiredQuantity <= availableSpace) {
                                                        // If the desired quantity can fit completely in the current stock in entry
                                                        stockIn.remainingStock += desiredQuantity;
                                                        totalCost += desiredQuantity * stockIn.stockInPrice;
                                                        break; // Exit the loop since the desired quantity has been inserted
                                                    } else {
                                                        // If the desired quantity cannot fit completely in the current stock in entry
                                                        stockIn.remainingStock = stockIn.mfProductQty;
                                                        totalCost += availableSpace * stockIn.stockInPrice;
                                                        desiredQuantity -= availableSpace;
                                                    }
                                                }
                                                const updatedStockInData = StockInData;
                                                console.log("Updated StockInData:", StockInData);
                                                console.log("Total Cost of Filling: ", totalCost);

                                                const totalofStockOutPrice = previousStockOutPrice - totalCost;
                                                const mfProductOutPrice = Number(totalofStockOutPrice).toFixed(2);

                                                const sopq = StockInData.filter((obj) => {
                                                    return obj;
                                                })
                                                const sowsiId = StockInData.map((obj) => {
                                                    return obj.mfStockInID;
                                                })
                                                const remainingStockByIds = sowsiId.map(mfStockInID => {
                                                    const stockIn = junoJson.find(item => item.mfStockInID === mfStockInID);
                                                    return stockIn ? stockIn.mfProductQty : undefined;
                                                });

                                                const remainingStockByIds1 = sowsiId.map(mfStockInID => {
                                                    const stockIn = updatedStockInData.find(item => item.mfStockInID === mfStockInID);
                                                    return stockIn ? stockIn.remainingStock : undefined;
                                                });

                                                console.log('orignalStockInData', remainingStockByIds);
                                                console.log('stockInData', remainingStockByIds1);

                                                const remainStockCutQty = remainingStockByIds.map((value, index) => value - remainingStockByIds1[index].toFixed(10));

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

                                                const combinedData = filteredId.map((id, index) => `('${mfStockOutId}','${id}',${filteredQty[index]})`);

                                                // Join the array elements into a single string
                                                const stockOutWiseStockInId = combinedData.join(',');

                                                // Output the resulting string
                                                console.log(stockOutWiseStockInId);

                                                function generateUpdateQuery(data) {
                                                    let query = 'UPDATE factory_mfProductStockIn_data\nSET remainingQty = CASE\n';

                                                    data.forEach((item) => {
                                                        const { mfStockInID, remainingStock } = item;
                                                        query += `    WHEN mfStockInID = '${mfStockInID}' THEN ROUND(${remainingStock},4)\n`;
                                                    });

                                                    query += '    ELSE remainingQty\nEND\n';

                                                    const stockInIds = data.map((item) => `'${item.mfStockInID}'`).join(', ');
                                                    query += `WHERE mfStockInID IN (${stockInIds})`;

                                                    return query;
                                                }

                                                console.log(generateUpdateQuery(sopq))
                                                const sql_qurey_updatedRemainQty = `${generateUpdateQuery(sopq)};
                                                                                    DELETE FROM factory_mfProductInwiseOut_data WHERE mfStockOutId = '${mfStockOutId}';
                                                                                    INSERT INTO factory_mfProductInwiseOut_data (mfStockOutId, mfStockInID, cutMfQty) VALUES ${stockOutWiseStockInId}`;
                                                pool.query(sql_qurey_updatedRemainQty, (err, data) => {
                                                    if (err) {
                                                        console.error("An error occurd in SQL Queery", err);
                                                        return res.status(500).send('Database Error');
                                                    }
                                                    const sql_querry_updatedetails = `UPDATE 
                                                                                          factory_mfProductStockOut_data 
                                                                                      SET 
                                                                                          userId = '${userId}',
                                                                                          mfProductId = '${mfProductId}',
                                                                                          mfProductQty = ${productFinalQty},
                                                                                          mfProductOutPrice = ${mfProductOutPrice},
                                                                                          mfStockOutDisplayQty = ${mfProductQty},
                                                                                          mfStockOutDisplayUnit = '${productUnit}',
                                                                                          mfProductOutCategory = '${mfProductOutCategory}',
                                                                                          mfStockOutComment = NULLIF('${mfStockOutComment}','null'),
                                                                                          mfStockOutDate = STR_TO_DATE('${mfStockOutDate}','%b %d %Y') 
                                                                                      WHERE mfStockOutId = '${mfStockOutId}';
                                                                                      UPDATE
                                                                                          factory_distributorWiseOut_data
                                                                                      SET
                                                                                          userId = '${userId}',
                                                                                          mfProductId = '${mfProductId}',
                                                                                          distributorId = '${distributorId}',
                                                                                          payType = '${payType}',
                                                                                          sellAmount = ${sellAmount},
                                                                                          sellDate = STR_TO_DATE('${mfStockOutDate}', '%b %d %Y')
                                                                                      WHERE mfStockOutId = '${mfStockOutId}'`;
                                                    pool.query(sql_querry_updatedetails, (err, data) => {
                                                        if (err) {
                                                            console.error("An error occurd in SQL Queery", err);
                                                            return res.status(500).send('Database Error');
                                                        }
                                                        return res.status(200).send("Transaction Updated Successfully");
                                                    })
                                                })
                                            })
                                        } else {
                                            const sql_querry_updatedetails = `UPDATE 
                                                                                      factory_mfProductStockOut_data 
                                                                                  SET 
                                                                                      userId = '${userId}',
                                                                                      mfProductId = '${mfProductId}',
                                                                                      mfProductQty = ${productFinalQty},
                                                                                      mfStockOutDisplayQty = ${mfProductQty},
                                                                                      mfStockOutDisplayUnit = '${productUnit}',
                                                                                      mfProductOutCategory = '${mfProductOutCategory}',
                                                                                      mfStockOutComment = NULLIF('${mfStockOutComment}','null'),
                                                                                      mfStockOutDate = STR_TO_DATE('${mfStockOutDate}','%b %d %Y') 
                                                                                  WHERE mfStockOutId = '${mfStockOutId}';
                                                                                  UPDATE
                                                                                      factory_distributorWiseOut_data
                                                                                  SET
                                                                                      userId = '${userId}',
                                                                                      mfProductId = '${mfProductId}',
                                                                                      distributorId = '${distributorId}',
                                                                                      payType = '${payType}',
                                                                                      sellAmount = ${sellAmount},
                                                                                      sellDate = STR_TO_DATE('${mfStockOutDate}', '%b %d %Y')
                                                                                  WHERE mfStockOutId = '${mfStockOutId}'`;
                                            pool.query(sql_querry_updatedetails, (err, data) => {
                                                if (err) {
                                                    console.error("An error occurd in SQL Queery", err);
                                                    return res.status(500).send('Database Error');
                                                }
                                                return res.status(200).send("Transaction Updated Successfully");
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

// Fill Manufacture Product Stock Out Details

const fillMfProductStockOutData = (req, res) => {
    try {
        const mfStockOutId = req.query.mfStockOutId;
        if (!mfStockOutId) {
            return res.status(404).send('Id Not Found....!');
        }
        const sql_guery_getFillDetails = `SELECT
                                              mfso.mfStockOutId,
                                              mfso.mfProductId,
                                              fmp.mfProductName,
                                              mfso.mfStockOutDisplayQty,
                                              mfso.mfStockOutDisplayUnit,
                                              mfso.mfProductOutCategory,
                                              mfso.mfStockOutComment,
                                              mfso.mfStockOutDate,
                                              (SELECT fdwo.distributorId FROM factory_distributorWiseOut_data AS fdwo WHERE fdwo.mfStockOutId = mfso.mfStockOutId) AS distributorId,
                                              (SELECT fdwo.payType FROM factory_distributorWiseOut_data AS fdwo WHERE fdwo.mfStockOutId = mfso.mfStockOutId) AS payType,
                                              COALESCE(
                                                (SELECT fdwo.sellAmount FROM factory_distributorWiseOut_data AS fdwo WHERE fdwo.mfStockOutId = mfso.mfStockOutId),
                                                (SELECT isd.totalPrice FROM inventory_stockIn_data AS isd WHERE isd.stockInId = mfso.mfStockOutId),
                                                0) AS sellAmount,
                                              (SELECT isd.branchId FROM inventory_stockIn_data AS isd WHERE isd.stockInId = mfso.mfStockOutId) AS branchId
                                          FROM
                                              factory_mfProductStockOut_data AS mfso
                                          INNER JOIN factory_manufactureProduct_data AS fmp ON fmp.mfProductId = mfso.mfProductId
                                          WHERE mfso.mfStockOutId = '${mfStockOutId}'`
        pool.query(sql_guery_getFillDetails, (err, data) => {
            if (err) {
                console.error("An error occurd in SQL Queery", err);
                return res.status(500).send('Database Error');
            }
            return res.status(200).send(data[0]);
        })
    } catch (error) {
        console.error('An error occurd', error);
        res.status(500).json('Internal Server Error');
    }
}

// Export Excel for Stock Out

const exportExcelSheetForMfStockOut = (req, res) => {
    let token;
    token = req.headers.authorization ? req.headers.authorization.split(" ")[1] : null;
    if (token) {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const departmentId = decoded && decoded.id && decoded.id.categoryId ? decoded.id.categoryId : null;
        if (departmentId) {
            const data = {
                startDate: (req.query.startDate ? req.query.startDate : '').slice(4, 15),
                endDate: (req.query.endDate ? req.query.endDate : '').slice(4, 15),
                mfProductId: req.query.mfProductId,
            }
            const commonQuery = `SELECT 
                                    CONCAT(user_details.userFirstName,' ',user_details.userLastName) AS enterBy,
                                    factory_manufactureProduct_data.mfProductName AS mfProductName, 
                                    CONCAT(mfStockOutDisplayQty,' ',mfStockOutDisplayUnit) AS Qty,
                                    ROUND(mfProductOutPrice) AS mfProductOutPrice,
                                    CASE
                                        WHEN factory_mfProductStockOut_data.mfProductOutCategory = 'Wastage' THEN 0
                                        WHEN factory_mfProductStockOut_data.mfProductOutCategory = 'Auto' THEN ROUND(mfProductOutPrice)
                                        ELSE COALESCE(dwo.sellAmount,isd.totalPrice,0)
                                    END AS sellAmt,
                                    factory_mfProductOutCategory_data.stockOutCategoryName AS stockOutCategoryName, 
                                    mfStockOutComment As comment, 
                                    DATE_FORMAT(mfStockOutDate,'%d-%m-%Y') AS mfStockOutDate,
                                    DATE_FORMAT(mfStockOutCreationDate, '%h:%i:%s %p') AS mfStockOutTime
                                 FROM factory_mfProductStockOut_data
                                 INNER JOIN user_details ON user_details.userId = factory_mfProductStockOut_data.userId
                                 INNER JOIN factory_manufactureProduct_data ON factory_manufactureProduct_data.mfProductId = factory_mfProductStockOut_data.mfProductId
                                 INNER JOIN factory_mfProductOutCategory_data ON factory_mfProductOutCategory_data.stockOutCategoryId = factory_mfProductStockOut_data.mfProductOutCategory
                                 LEFT JOIN factory_distributorWiseOut_data AS dwo ON dwo.mfStockOutId = factory_mfProductStockOut_data.mfStockOutId
                                 LEFT JOIN inventory_stockIn_data AS isd ON isd.stockInId = factory_mfProductStockOut_data.mfStockOutId
                                 WHERE factory_mfProductStockOut_data.mfProductId IN (SELECT COALESCE(fmp.mfProductId, null) FROM factory_manufactureProduct_data AS fmp WHERE fmp.mfProductCategoryId = '${departmentId}')`;
            if (req.query.mfProductId && req.query.startDate && req.query.endDate) {
                sql_queries_getdetails = `${commonQuery}
                                                AND factory_mfProductStockOut_data.mfProductId = '${data.mfProductId}' AND factory_mfProductStockOut_data.mfStockOutDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')
                                                ORDER BY factory_mfProductStockOut_data.mfStockOutDate DESC, factory_mfProductStockOut_data.mfStockOutCreationDate DESC`;
            } else if (req.query.startDate && req.query.endDate) {
                sql_queries_getdetails = `${commonQuery}
                                                AND factory_mfProductStockOut_data.mfStockOutDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')
                                                ORDER BY factory_mfProductStockOut_data.mfStockOutDate DESC, factory_mfProductStockOut_data.mfStockOutCreationDate DESC`;
            } else if (req.query.mfProductId) {
                sql_queries_getdetails = `${commonQuery}
                                                AND factory_mfProductStockOut_data.mfProductId = '${data.mfProductId}'
                                                ORDER BY factory_mfProductStockOut_data.mfStockOutDate DESC, factory_mfProductStockOut_data.mfStockOutCreationDate DESC`;
            } else {
                sql_queries_getdetails = `${commonQuery}
                                                ORDER BY factory_mfProductStockOut_data.mfStockOutDate DESC, factory_mfProductStockOut_data.mfStockOutCreationDate DESC`
            }
            pool.query(sql_queries_getdetails, async (err, rows) => {
                if (err) return res.status(404).send(err);
                const workbook = new excelJS.Workbook();  // Create a new workbook
                const worksheet = workbook.addWorksheet("StockOut List"); // New Worksheet

                if (req.query.startDate && req.query.endDate) {
                    worksheet.mergeCells('A1', 'H1');
                    worksheet.getCell('A1').value = `Stock Out From ${data.startDate} To ${data.endDate}`;
                } else {
                    worksheet.mergeCells('A1', 'H1');
                    worksheet.getCell('A1').value = `ALL Stock Out`;
                }

                /*Column headers*/
                worksheet.getRow(2).values = ['S no.', 'Entered By', 'Product', 'Quantity', 'Production Cost', 'Sold Price', 'Comment', 'Date', "Time"];

                // Column for data in excel. key must match data key
                worksheet.columns = [
                    { key: "s_no", width: 10, },
                    { key: "enterBy", width: 20 },
                    { key: "mfProductName", width: 30 },
                    { key: "Qty", width: 20 },
                    { key: "mfProductOutPrice", width: 10 },
                    { key: "sellAmt", width: 10 },
                    { key: "comment", width: 30 },
                    { key: "mfStockOutDate", width: 20 },
                    { key: "mfStockOutTime", width: 20 },
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
                worksheet.getRow(arr.length + 3).values = ['Total:', '', '', '', { formula: `SUM(E3:E${arr.length + 2})` }, { formula: `SUM(F3:F${arr.length + 2})` }];

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
            })
        } else {
            return res.status(401).send("Department Not Found");
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

// Export PDF For Stock Out

const exportPdfForMfStockOut = (req, res) => {
    try {
        let token;
        token = req.headers.authorization ? req.headers.authorization.split(" ")[1] : null;
        if (token) {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const departmentId = decoded && decoded.id && decoded.id.categoryId ? decoded.id.categoryId : null;
            if (departmentId) {
                const data = {
                    startDate: (req.query.startDate ? req.query.startDate : '').slice(4, 15),
                    endDate: (req.query.endDate ? req.query.endDate : '').slice(4, 15),
                    mfProductId: req.query.mfProductId,
                }
                const commonQuery = `SELECT 
                                    CONCAT(user_details.userFirstName,' ',user_details.userLastName) AS "Enter By",
                                    factory_manufactureProduct_data.mfProductName AS "Product Name", 
                                    CONCAT(mfStockOutDisplayQty,' ',mfStockOutDisplayUnit) AS "Qty",
                                    ROUND(mfProductOutPrice) AS "Production Cost",
                                    CASE
                                        WHEN factory_mfProductStockOut_data.mfProductOutCategory = 'Wastage' THEN 0
                                        WHEN factory_mfProductStockOut_data.mfProductOutCategory = 'Auto' THEN ROUND(mfProductOutPrice)
                                        ELSE COALESCE(dwo.sellAmount,isd.totalPrice,0)
                                    END AS "Sold Price",
                                    factory_mfProductOutCategory_data.stockOutCategoryName AS "Category", 
                                    mfStockOutComment As "Comment", 
                                    DATE_FORMAT(mfStockOutDate,'%d-%m-%Y') AS "Date",
                                    DATE_FORMAT(mfStockOutCreationDate, '%h:%i:%s %p') AS "Time"
                                 FROM factory_mfProductStockOut_data
                                 INNER JOIN user_details ON user_details.userId = factory_mfProductStockOut_data.userId
                                 INNER JOIN factory_manufactureProduct_data ON factory_manufactureProduct_data.mfProductId = factory_mfProductStockOut_data.mfProductId
                                 INNER JOIN factory_mfProductOutCategory_data ON factory_mfProductOutCategory_data.stockOutCategoryId = factory_mfProductStockOut_data.mfProductOutCategory
                                 LEFT JOIN factory_distributorWiseOut_data AS dwo ON dwo.mfStockOutId = factory_mfProductStockOut_data.mfStockOutId
                                 LEFT JOIN inventory_stockIn_data AS isd ON isd.stockInId = factory_mfProductStockOut_data.mfStockOutId
                                 WHERE factory_mfProductStockOut_data.mfProductId IN (SELECT COALESCE(fmp.mfProductId, null) FROM factory_manufactureProduct_data AS fmp WHERE fmp.mfProductCategoryId = '${departmentId}')`;
                if (req.query.mfProductId && req.query.startDate && req.query.endDate) {
                    sql_queries_getdetails = `${commonQuery}
                                                AND factory_mfProductStockOut_data.mfProductId = '${data.mfProductId}' AND factory_mfProductStockOut_data.mfStockOutDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')
                                                ORDER BY factory_mfProductStockOut_data.mfStockOutDate DESC, factory_mfProductStockOut_data.mfStockOutCreationDate DESC`;
                } else if (req.query.startDate && req.query.endDate) {
                    sql_queries_getdetails = `${commonQuery}
                                                AND factory_mfProductStockOut_data.mfStockOutDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')
                                                ORDER BY factory_mfProductStockOut_data.mfStockOutDate DESC, factory_mfProductStockOut_data.mfStockOutCreationDate DESC`;
                } else if (req.query.mfProductId) {
                    sql_queries_getdetails = `${commonQuery}
                                                AND factory_mfProductStockOut_data.mfProductId = '${data.mfProductId}'
                                                ORDER BY factory_mfProductStockOut_data.mfStockOutDate DESC, factory_mfProductStockOut_data.mfStockOutCreationDate DESC`;
                } else {
                    sql_queries_getdetails = `${commonQuery}
                                                ORDER BY factory_mfProductStockOut_data.mfStockOutDate DESC, factory_mfProductStockOut_data.mfStockOutCreationDate DESC`
                }
                pool.query(sql_queries_getdetails, (err, rows) => {
                    if (err) {
                        console.error("An error occurd in SQL Queery", err);
                        return res.status(500).send('Database Error');
                    } else if (rows && rows.length <= 0) {
                        return res.status(400).send('No Data Found');
                    }
                    const abc = Object.values(JSON.parse(JSON.stringify(rows)));
                    const sumOfTotalPrice = abc.reduce((total, item) => total + (item['Out Price'] || 0), 0);
                    const soldPrice = abc.reduce((total, item) => total + (item['Sold Price'] || 0), 0);
                    const sumFooterArray = ['Total', '', '', '', parseFloat(sumOfTotalPrice).toLocaleString('en-IN'), parseFloat(soldPrice).toLocaleString('en-IN')];
                    if (req.query.startMonth && req.query.endMonth) {
                        tableHeading = `StockOut Data From ${data.startDate} To ${data.endDate}`;
                    } else {
                        tableHeading = `All StockOut Data`;
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
                return res.status(401).send("Department Not Found");
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
    getMfStockOutList,
    addMfProductStockOutData,
    removeMfProductStockOutTransaction,
    updateMfStockOutTransaction,
    fillMfProductStockOutData,
    exportExcelSheetForMfStockOut,
    exportPdfForMfStockOut
}