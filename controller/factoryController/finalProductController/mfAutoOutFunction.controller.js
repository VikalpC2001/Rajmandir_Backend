const pool = require('../../../database');
const jwt = require("jsonwebtoken");

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

// ADD Raw Material Stock Out Details Auto Function

const addRmStockOutDetailsAuto = (data) => {
    return new Promise((resolve, reject) => {
        try {
            // Destructure the passed object
            console.log('jo baka', data);
            const { rmStockOutId, rawMaterialId, rawMaterialQty, rawMaterialUnit, rmStockOutCategory, rmStockOutComment, userId, rmStockOutDate } = data;
            console.log('fffddd', rawMaterialId, rawMaterialId, rawMaterialQty, rawMaterialUnit, rmStockOutCategory);
            // Add the logic from your original function here
            if (!rawMaterialId || !rawMaterialQty || !rawMaterialUnit || !rmStockOutCategory) {
                console.error("Raw Material Please Fill All The Fields");
                reject('Raw Material Please Fill All The Fields');
            }
            else {
                const sql_queries_getNeedData = `SELECT bigUnitName AS largerUnit, unitNumber AS value, smallUnitName AS smallerUnit FROM factory_rmUnit_preference WHERE rawMaterialId = '${rawMaterialId}' ORDER BY factory_rmUnit_preference.priorityNumber ASC;
                                                 SELECT ipd.minRawMaterialUnit AS  minRawMaterialUnit, ipd.isExpired AS isExpired, ipd.expiredDays AS expiredDays FROM factory_rawMaterial_data AS ipd WHERE ipd.rawMaterialId = '${rawMaterialId}'`;
                pool.query(sql_queries_getNeedData, (err, result) => {
                    if (err) {
                        console.error("An error occurred in SQL Query", err);
                        reject('Database Error');
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
                            console.error("An error occurred in SQL Query", err);
                            reject('Database Error');
                        }
                        const remainStock = data[0].remainingStock
                        console.log("./././", remainStock);
                        if (remainStock < productFinalQty) {
                            reject(`You Can Not Stock Out more Then Remain Stock...!`);
                        } else {
                            sql_querry_getStockIndetail = `SELECT rmStockInId, rawMaterialId, rawMaterialQty, rawMaterialPrice AS stockInPrice, remainingQty AS stockInQuantity FROM factory_rmStockIn_data WHERE factory_rmStockIn_data.rawMaterialId = '${rawMaterialId}' AND factory_rmStockIn_data.remainingQty != 0 ORDER BY rmStockInDate ASC, rmStockInCreationDate ASC`;
                            pool.query(sql_querry_getStockIndetail, (err, data) => {
                                if (err) {
                                    console.error("An error occurred in SQL Query", err);
                                    reject('Database Error');
                                }
                                const orignalStockInData = Object.values(JSON.parse(JSON.stringify(data)));
                                const stockInData = Object.values(JSON.parse(JSON.stringify(data)));
                                // console.log(">>>", Object.values(JSON.parse(JSON.stringify(data))));
                                const stockOutData = [
                                    { rawMaterialId: rawMaterialId, stockOutQuantity: productFinalQty }
                                ];

                                // Desired quantity
                                const desiredQuantity = stockOutData[0].stockOutQuantity;

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
                                        query += `    WHEN rmStockInId = '${rmStockInId}' THEN ROUND(${stockInQuantity},4)\n`;
                                    });

                                    query += '    ELSE remainingQty\nEND\n';

                                    const stockInIds = data.map((item) => `'${item.rmStockInId}'`).join(', ');
                                    query += `WHERE rmStockInId IN (${stockInIds});`;

                                    return query;
                                }

                                // console.log(generateUpdateQuery(sopq))
                                const sql_qurey_updatedRemainQty = generateUpdateQuery(sopq);
                                pool.query(sql_qurey_updatedRemainQty, (err, data) => {
                                    if (err) {
                                        console.error("An error occurred in SQL Query", err);
                                        reject('Database Error');
                                    }
                                    const sql_querry_addStockOut = `INSERT INTO factory_rmStockOut_data (rmStockOutId, userId, rawMaterialId, rawMaterialQty, rmStockOutPrice, rmStockOutDisplayQty, rmStockOutDisplayUnit, rmStockOutCategory, rmStockOutComment, rmStockOutDate)
                                                                    VALUES ('${rmStockOutId}', '${userId}', '${rawMaterialId}', ${productFinalQty}, ${stocokOutPrice}, ${rawMaterialQty}, '${rawMaterialUnit}', '${rmStockOutCategory}', NULLIF('${rmStockOutComment}','null'), STR_TO_DATE('${rmStockOutDate}','%b %d %Y'))`;
                                    pool.query(sql_querry_addStockOut, (err, data) => {
                                        if (err) {
                                            console.error("An error occurred in SQL Query", err);
                                            reject('Database Error');
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

                                        const remainStockCutQty = remainingStockByIds.map((value, index) => value - remainingStockByIds1[index].toFixed(10));

                                        console.log(';;;;;;;;', stockInData)
                                        console.log('???????', orignalStockInData);
                                        console.log(">?>?>?<<<<.,,,", sowsiId);
                                        console.log("RRRRR", remainStockCutQty);

                                        // Use map to combine the arrays and format them
                                        const combinedData = sowsiId.map((id, index) => `('${rmStockOutId}','${id}',${remainStockCutQty[index]})`);

                                        // Join the array elements into a single string
                                        const stockOutWiseStockInId = combinedData.join(',');

                                        // Output the resulting string
                                        console.log(stockOutWiseStockInId);

                                        sql_querry_addsowsiId = `INSERT INTO factory_stockOutwiseStockInId_data (rmStockOutId, rmStockInId, cutRmQty) VALUES ${stockOutWiseStockInId}`;

                                        pool.query(sql_querry_addsowsiId, (err, data) => {
                                            if (err) {
                                                console.error("An error occurred in SQL Query", err);
                                                reject('Database Error');
                                            }
                                            resolve("Data Added Successfuly");
                                        })
                                    })
                                })
                            })
                        }
                    })
                })
            }
        } catch (error) {
            console.error('An error occurred', error);
            reject('Internal Server Error');
        }
    })
}

// ADD Produce Product Stock Out Details Auto Function

const addMfStockOutDetailsAuto = (data) => {

    return new Promise((resolve, reject) => {
        try {
            // Destructure the passed object
            const { mfStockOutId, mfProductId, mfProductQty, productUnit, mfProductOutCategory, mfStockOutComment, userId, mfStockOutDate } = data;
            if (!mfProductId || !mfProductQty || !productUnit || !mfProductOutCategory || !mfStockOutDate) {
                console.error("Manufacture Product Please Fill All The Fields");
                reject('Manufacture Product Please Fill All The Fields');
            }
            else {
                const sql_queries_getNeedData = `SELECT bigUnitName AS largerUnit, unitNumber AS value, smallUnitName AS smallerUnit FROM mfProduct_unit_preference WHERE mfProductId = '${mfProductId}' ORDER BY mfProduct_unit_preference.priorityNumber ASC;
                                                 SELECT mfpd.minMfProductUnit AS  minProductUnit FROM factory_manufactureProduct_data AS mfpd WHERE mfpd.mfProductId = '${mfProductId}'`;
                pool.query(sql_queries_getNeedData, (err, result) => {
                    if (err) {
                        console.error("An error occurred in SQL Query", err);
                        reject('Database Error');
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
                            console.error("An error occurred in SQL Query", err);
                            reject('Database Error');
                        }
                        const remainStock = data[0].remainingStock
                        console.log("./././", remainStock);
                        if (remainStock < productFinalQty) {
                            reject(`You Can Not Stock Out more Then Remain Stock...!`);
                        } else {
                            sql_querry_getStockIndetail = `SELECT mfStockInID, mfProductId, mfProductQty, mfProductPrice AS stockInPrice, remainingQty AS stockInQuantity FROM factory_mfProductStockIn_data WHERE factory_mfProductStockIn_data.mfProductId = '${mfProductId}' AND factory_mfProductStockIn_data.remainingQty != 0 ORDER BY mfStockInDate ASC, mfStockInCreationDate ASC`;
                            pool.query(sql_querry_getStockIndetail, (err, data) => {
                                if (err) {
                                    console.error("An error occurred in SQL Query", err);
                                    reject('Database Error');
                                }
                                const orignalStockInData = Object.values(JSON.parse(JSON.stringify(data)));
                                const stockInData = Object.values(JSON.parse(JSON.stringify(data)));
                                // console.log(">>>", Object.values(JSON.parse(JSON.stringify(data))));
                                const stockOutData = [
                                    { mfProductId: data[0].mfProductId, stockOutQuantity: productFinalQty }
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
                                        query += `    WHEN mfStockInID = '${mfStockInID}' THEN ROUND(${stockInQuantity},4)\n`;
                                    });

                                    query += '    ELSE remainingQty\nEND\n';

                                    const stockInIds = data.map((item) => `'${item.mfStockInID}'`).join(', ');
                                    query += `WHERE mfStockInID IN (${stockInIds});`;

                                    return query;
                                }

                                // console.log(generateUpdateQuery(sopq))
                                const sql_qurey_updatedRemainQty = generateUpdateQuery(sopq);
                                pool.query(sql_qurey_updatedRemainQty, (err, data) => {
                                    if (err) {
                                        console.error("An error occurred in SQL Query", err);
                                        reject('Database Error');
                                    }
                                    const sql_querry_addStockOut = `INSERT INTO factory_mfProductStockOut_data (mfStockOutId, userId, mfProductId, mfProductQty, mfProductOutPrice, mfStockOutDisplayQty, mfStockOutDisplayUnit, mfProductOutCategory, mfStockOutComment, mfStockOutDate)
                                                                    VALUES ('${mfStockOutId}', '${userId}', '${mfProductId}', ${productFinalQty}, ${stocokOutPrice}, ${mfProductQty}, '${productUnit}', '${mfProductOutCategory}', NULLIF('${mfStockOutComment}','null'), STR_TO_DATE('${mfStockOutDate}','%b %d %Y'))`;
                                    pool.query(sql_querry_addStockOut, (err, data) => {
                                        if (err) {
                                            console.error("An error occurred in SQL Query", err);
                                            reject('Database Error');
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
                                                console.error("An error occurred in SQL Query", err);
                                                reject('Database Error');
                                            }
                                            resolve("Data Added Successfuly");
                                        })
                                    })
                                })
                            })
                        }
                    })
                })
            }
        } catch (error) {
            console.error('An error occurred', error);
            reject('Internal Server Error');
        }
    })
}

// Function to add RM StockOut details

function addRmStockOutDetailsAutoPromise(jesu, mfStockInId) {
    return new Promise((resolve, reject) => {
        if (jesu.length != 0) {
            Promise.all(
                jesu.map(e => addRmStockOutDetailsAuto(e))
            ).then(response => {
                const combinedData = jesu.map((id) => `('${mfStockInId}', '${id.rmStockOutId}')`).join(',');
                let sql_query_inWiseOut = `INSERT INTO factory_mfStockInWiseRmStockOut_data(mfStockInId, rmStockOutId)
                                           VALUES ${combinedData}`;
                pool.query(sql_query_inWiseOut, (err, inOut) => {
                    if (err) {
                        console.error("An error occurred in SQL Query", err);
                        reject('Database Error');
                    } else {
                        console.log("inWiseOut Added Successfully");
                        resolve(response); // Resolve with the success response
                    }
                });
            }).catch(error => {
                console.error(error); // Handle any errors
                reject(error); // Reject with the error
            });
        } else {
            resolve('No Data');
        }

    });
}

// Function to add Other Source data

function addOtherSourceDataPromise(otherExpenseJesu) {
    return new Promise((resolve, reject) => {
        if (otherExpenseJesu && otherExpenseJesu.length != 0) {
            const combinedData = otherExpenseJesu.map((v) => `('${v.usedSourceId}', '${v.userId}', '${v.otherSourceId}', ${v.usedSourceQty}, ${v.usedSourcePrice}, STR_TO_DATE('${v.usedSourceDate}','%b %d %Y'), '${v.mfStockInId}')`).join(',');
            console.log(combinedData);

            let sql_query_addOtherSourceData = `INSERT INTO factory_otherSourceUsed_data(usedSourceId, userId, otherSourceId, usedSourceQty, usedSourcePrice, usedSourceDate, mfStockInId)
                                                VALUES ${combinedData}`;

            pool.query(sql_query_addOtherSourceData, (err, osdata) => {
                if (err) {
                    console.error("An error occurred in SQL Query", err);
                    reject('Database Error');
                } else {
                    console.log("Other Source Added Successfully");
                    resolve(osdata); // Resolve with the success response
                }
            });
        } else {
            resolve("No Other Expense Data");
        }
    });
}

// Function to add MF StockOut details

function addMfStockOutDetailsAutoPromise(jesu, mfStockInId) {
    return new Promise((resolve, reject) => {
        console.log('jesu', jesu);
        if (jesu.length != 0) {
            Promise.all(
                jesu.map(e => addMfStockOutDetailsAuto(e))
            ).then(response => {
                const combinedData = jesu.map((id) => `('${mfStockInId}', '${id.mfStockOutId}')`).join(',');
                let sql_query_inWiseOut = `INSERT INTO factory_mfStockInWiseMfStockOut_data(mfStockInId, mfStockOutId)
                                           VALUES ${combinedData}`;
                pool.query(sql_query_inWiseOut, (err, inOut) => {
                    if (err) {
                        console.error("An error occurred in SQL Query", err);
                        reject('Database Error');
                    } else {
                        console.log("inWiseOut Added Successfully");
                        resolve(response); // Resolve with the success response
                    }
                });
            }).catch(error => {
                console.error(error); // Handle any errors
                reject(error); // Reject with the error
            });
        } else {
            resolve('No Data');
        }

    });
}

// Function To Delete Multiple Raw Material Stock Out

const removeMultipleRmStockOutTransaction = (rmStockOutId) => {
    return new Promise((resolve, reject) => {
        try {
            pool.query(`SELECT rmStockOutId, rawMaterialQty FROM factory_rmStockOut_data WHERE rmStockOutId = '${rmStockOutId}'`, (err, row) => {
                if (err) {
                    console.error("An error occurred in SQL Query", err);
                    reject('Database Error');
                }
                if (row && row.length) {
                    let prevoiusQuantity = row[0].rawMaterialQty;
                    console.log('joneeee', rmStockOutId, prevoiusQuantity)
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
                            console.error("An error occurred in SQL Query", err);
                            reject('Database Error');
                        }
                        let junoJson = Object.values(JSON.parse(JSON.stringify(data)));
                        let StockInData = Object.values(JSON.parse(JSON.stringify(data)));
                        console.log('junoo', StockInData)

                        let stockOutData = [
                            { rawMaterialId: data[0].rawMaterialId, stockOutQuantity: prevoiusQuantity }
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
                            let availableSpace = stockIn.rawMaterialQty - stockIn.remainingStock; // Calculate the available space for the product

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

                        let sopq = StockInData.filter((obj) => {
                            if (obj.stockInQuantity != obj.rawMaterialQty) {
                                return obj;
                            }
                        })

                        function generateUpdateQuery(data) {
                            let query = 'UPDATE factory_rmStockIn_data\nSET remainingQty = CASE\n';

                            data.forEach((item) => {
                                const { rmStockInId, remainingStock } = item;
                                query += `    WHEN rmStockInId = '${rmStockInId}' THEN ROUND(${remainingStock},4)\n`;
                            });

                            query += '    ELSE remainingQty\nEND\n';

                            const stockInIds = data.map((item) => `'${item.rmStockInId}'`).join(', ');
                            query += `WHERE rmStockInId IN (${stockInIds});`;

                            return query;
                        }

                        console.log(generateUpdateQuery(sopq))
                        let sql_qurey_updatedRemainQty = generateUpdateQuery(sopq);
                        pool.query(sql_qurey_updatedRemainQty, (err, data) => {
                            if (err) {
                                console.error("An error occurred in SQL Query", err);
                                reject('Database Error');
                            }
                            const sql_querry_removedetails = `DELETE FROM factory_rmStockOut_data WHERE rmStockOutId = '${rmStockOutId}'`;
                            pool.query(sql_querry_removedetails, (err, data) => {
                                if (err) {
                                    console.error("An error occurred in SQL Query", err);
                                    reject('Database Error');
                                }
                                resolve('Transaction Deleted Successfully');
                            })
                        })
                    })
                } else {
                    reject('Transaction Not Found');
                }
            })
        } catch (error) {
            console.error('An error occurred', error);
            reject('Internal Server Error');
        }
    })
}

function removeRmStockIn(jesu) {
    let index = 0;
    function insertNext() {
        if (index < jesu.length) {
            const id = jesu[index]
            removeMultipleRmStockOutTransaction(id)
                .then(() => {
                    index++;
                    insertNext();
                }).catch((error) => {
                    console.log(error);
                })
        }
    }
    insertNext();
}

// Function To Delete Multiple Manufacture Product Stock Out

const removeMultipleMfStockOutTransaction = (mfStockOutId) => {
    return new Promise((resolve, reject) => {
        try {
            console.log(mfStockOutId, 'babu')
            pool.query(`SELECT mfStockOutId, mfProductQty FROM factory_mfProductStockOut_data WHERE mfStockOutId = '${mfStockOutId}'`, (err, row) => {
                if (err) {
                    console.error("An error occurred in SQL Query", err);
                    reject('Database Error');
                }
                if (row && row.length) {
                    let prevoiusQuantity = row[0].mfProductQty;
                    console.log('joneeee', mfStockOutId, prevoiusQuantity)
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
                            console.error("An error occurred in SQL Query", err);
                            reject('Database Error');
                        }
                        let junoJson = Object.values(JSON.parse(JSON.stringify(data)));
                        let StockInData = Object.values(JSON.parse(JSON.stringify(data)));
                        console.log('junoo', StockInData)

                        let stockOutData = [
                            { mfProductId: data[0].mfProductId, stockOutQuantity: prevoiusQuantity }
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
                            let availableSpace = stockIn.mfProductQty - stockIn.remainingStock; // Calculate the available space for the product

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

                        let sopq = StockInData.filter((obj) => {
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
                        let sql_qurey_updatedRemainQty = generateUpdateQuery(sopq);
                        pool.query(sql_qurey_updatedRemainQty, (err, data) => {
                            if (err) {
                                console.error("An error occurred in SQL Query", err);
                                reject('Database Error');
                            }
                            const sql_querry_removedetails = `DELETE FROM factory_mfProductStockOut_data WHERE mfStockOutId = '${mfStockOutId}'`;
                            pool.query(sql_querry_removedetails, (err, data) => {
                                if (err) {
                                    console.error("An error occurred in SQL Query", err);
                                    reject('Database Error');
                                }
                                resolve('Transaction Deleted Successfully');
                            })
                        })
                    })
                } else {
                    reject('Transaction Not Found');
                }
            })
        } catch (error) {
            console.error('An error occurred', error);
            reject('Internal Server Error');
        }
    })
}

function removeMfStockIn(jesu) {
    let index = 0;
    function insertNext() {
        if (index < jesu.length) {
            const id = jesu[index]
            removeMultipleMfStockOutTransaction(id)
                .then(() => {
                    index++;
                    insertNext();
                }).catch((error) => {
                    console.log(error);
                })
        }
    }
    insertNext();
}

module.exports = {
    addRmStockOutDetailsAuto,
    addRmStockOutDetailsAutoPromise,
    addOtherSourceDataPromise,
    removeRmStockIn,
    addMfStockOutDetailsAutoPromise,
    removeMfStockIn
}