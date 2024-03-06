const pool = require('../../../database');
const jwt = require("jsonwebtoken");
const {
    addRmStockOutDetailsAutoPromise,
    addOtherSourceDataPromise,
    addMfStockOutDetailsAutoPromise,
    removeRmStockIn,
    removeMfStockIn
} = require("./mfAutoOutFunction.controller");
const { processDatas1, processDatas } = require("./recipee.controller");

// Function For Convert Units

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

// Manufacture Product StockIn List API

const getmfProductStockInList = async (req, res) => {
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
                    mfProductId: req.query.mfProductId,
                }
                let sql_countCommon_query = `SELECT count(*) as numRows FROM factory_mfProductStockIn_data WHERE factory_mfProductStockIn_data.mfProductId IN (SELECT COALESCE(fmp.mfProductId, null) FROM factory_manufactureProduct_data AS fmp WHERE fmp.mfProductCategoryId = '${departmentId}')`;
                if (req.query.mfProductId && req.query.startDate && req.query.endDate) {
                    sql_querry_getCountdetails = `${sql_countCommon_query} 
                                                  AND factory_mfProductStockIn_data.mfProductId = '${data.mfProductId}' AND factory_mfProductStockIn_data.mfStockInDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')`;
                } else if (req.query.startDate && req.query.endDate) {
                    sql_querry_getCountdetails = `${sql_countCommon_query}
                                                  AND factory_mfProductStockIn_data.mfStockInDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')`;
                } else if (req.query.mfProductId) {
                    sql_querry_getCountdetails = `${sql_countCommon_query} 
                                                  AND factory_mfProductStockIn_data.mfProductId = '${data.mfProductId}'`;
                } else {
                    sql_querry_getCountdetails = `${sql_countCommon_query}`;
                }
                pool.query(sql_querry_getCountdetails, (err, rows, fields) => {
                    if (err) {
                        console.error("An error occurd in SQL Queery", err);
                        return res.status(500).send('Database Error');
                    } else {
                        const numRows = rows[0].numRows;
                        const numPages = Math.ceil(numRows / numPerPage);
                        const commanQuarry = `SELECT
                                          mfStockInID AS mfStockInId,
                                          user_details.userName AS enteredBy,
                                          CONCAT(
                                              user_details.userFirstName,
                                              ' ',
                                              user_details.userLastName
                                          ) AS userName,
                                          UPPER(factory_manufactureProduct_data.mfProductName) AS mfProductName,
                                          CONCAT(mfStockInDisplayQty,' ',mfStockInDisplayUnit) AS Quantity,
                                          ROUND(mfProductPrice,2) AS mfProductPrice,
                                          totalPrice,
                                          mfStockInComment,
                                          mfProductQty,
                                          remainingQty,
                                          CONCAT(DATE_FORMAT(mfStockInDate, '%d-%m-%Y'),' ',DATE_FORMAT(mfStockInCreationDate, '%h:%i %p')) AS mfStockInDate
                                      FROM
                                          factory_mfProductStockIn_data
                                      INNER JOIN user_details ON user_details.userId = factory_mfProductStockIn_data.userId
                                      INNER JOIN factory_manufactureProduct_data ON factory_manufactureProduct_data.mfProductId = factory_mfProductStockIn_data.mfProductId
                                      WHERE factory_mfProductStockIn_data.mfProductId IN(SELECT COALESCE(fmp.mfProductId, null) FROM factory_manufactureProduct_data AS fmp WHERE fmp.mfProductCategoryId = '${departmentId}')`;
                        if (req.query.mfProductId && req.query.startDate && req.query.endDate) {
                            sql_queries_getdetails = `${commanQuarry}
                                                  AND factory_mfProductStockIn_data.mfProductId = '${data.mfProductId}' AND factory_mfProductStockIn_data.mfStockInDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')
                                                  ORDER BY factory_mfProductStockIn_data.mfStockInDate DESC, factory_mfProductStockIn_data.mfStockInCreationDate DESC LIMIT ${limit}`;
                        } else if (req.query.startDate && req.query.endDate) {
                            sql_queries_getdetails = `${commanQuarry}
                                                  AND factory_mfProductStockIn_data.mfStockInDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y') 
                                                  ORDER BY factory_mfProductStockIn_data.mfStockInDate DESC, factory_mfProductStockIn_data.mfStockInCreationDate DESC LIMIT ${limit}`;
                        } else if (req.query.mfProductId) {
                            sql_queries_getdetails = `${commanQuarry}
                                                  AND factory_mfProductStockIn_data.mfProductId = '${data.mfProductId}'
                                                  ORDER BY factory_mfProductStockIn_data.mfStockInDate DESC, factory_mfProductStockIn_data.mfStockInCreationDate DESC LIMIT ${limit}`;
                        } else {
                            sql_queries_getdetails = `${commanQuarry}
                                                  ORDER BY factory_mfProductStockIn_data.mfStockInDate DESC, factory_mfProductStockIn_data.mfStockInCreationDate DESC LIMIT ${limit}`;
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

// Add Manufacture Product Stock IN

const addMfProductStockInData = async (req, res) => {
    try {
        let token;
        token = req.headers && req.headers.authorization ? req.headers.authorization.split(" ")[1] : null;
        if (token) {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const userId = decoded.id.id;
            const uid1 = new Date();
            const mfStockInId = String("mfStockIn_" + uid1.getTime());
            const outCategory = process.env.AUTO_RMOUT_ID;
            const ppOutCategory = process.env.OUT_AUTO_ID;
            const data = {
                mfProductId: req.body.mfProductId,
                mfProductQty: req.body.mfProductQty,
                mfProductUnit: req.body.mfProductUnit,
                totalPrice: req.body.totalPrice ? req.body.totalPrice : 0,
                mfStockInComment: req.body.mfStockInComment ? req.body.mfStockInComment.trim() : null,
                mfStockInDate: new Date(req.body.mfStockInDate ? req.body.mfStockInDate : null).toString().slice(4, 15),
                isAuto: req.body.isAuto ? req.body.isAuto : false,
                autoJson: req.body.autoJson ? req.body.autoJson : []
            }
            if (!data.mfProductId || !data.mfProductQty || !data.mfProductUnit || !data.mfStockInDate) {
                res.status(404).send("Please Fill All The Fields");
            } else {
                const sql_queries_getNeedData = `SELECT bigUnitName AS largerUnit, unitNumber AS value, smallUnitName AS smallerUnit FROM mfProduct_unit_preference WHERE mfProductId = '${data.mfProductId}' ORDER BY mfProduct_unit_preference.priorityNumber ASC;
                                                 SELECT mfpd.minMfProductUnit AS  minProductUnit FROM factory_manufactureProduct_data AS mfpd WHERE mfpd.mfProductId = '${data.mfProductId}'`;
                pool.query(sql_queries_getNeedData, (err, result) => {
                    if (err) {
                        console.error("An error occurd in SQL Queery", err);
                        return res.status(500).send('Database Error');
                    }
                    const needData = {
                        unitsData: result && result[0] ? Object.values(JSON.parse(JSON.stringify(result[0]))) : null,
                        toUnit: result && result[1][0] && result[1][0].minProductUnit ? result[1][0].minProductUnit : null,
                    }
                    console.log(needData.unitsData);
                    const productFinalQty = (needData.unitsData && needData.unitsData.length !== 0) ? convertUnits(needData.unitsData, data.mfProductQty, data.mfProductUnit, needData.toUnit) : data.mfProductQty;
                    const sql_querry_addStockIn = `INSERT INTO factory_mfProductStockIn_data(
                                                                                            mfStockInID,
                                                                                            userId,
                                                                                            mfProductId,
                                                                                            mfProductQty,
                                                                                            mfProductPrice,
                                                                                            totalPrice,
                                                                                            mfStockInDisplayQty,
                                                                                            mfStockInDisplayUnit,
                                                                                            mfStockInComment,
                                                                                            remainingQty,
                                                                                            mfStockInDate)
                                                                                          VALUES(
                                                                                            '${mfStockInId}',
                                                                                            '${userId}',
                                                                                            '${data.mfProductId}',
                                                                                            ${productFinalQty},
                                                                                            ${data.totalPrice / productFinalQty},
                                                                                            ${data.totalPrice},
                                                                                            ${data.mfProductQty},
                                                                                            '${data.mfProductUnit}',
                                                                                            ${data.mfStockInComment ? `'${data.mfStockInComment}'` : null},
                                                                                            ${productFinalQty},
                                                                                            STR_TO_DATE('${data.mfStockInDate}','%b %d %Y')
                                                                                            )`;
                    pool.query(sql_querry_addStockIn, (err, raw) => {
                        if (err) {
                            console.error("An error occurd in SQL Queery", err);
                            return res.status(500).send('Database Error');
                        }
                        if (data.isAuto) {
                            const autoJson = data.autoJson ? data.autoJson : null
                            console.log(autoJson, '.....');

                            const recipeMaterial = autoJson && autoJson.recipeMaterial ? autoJson.recipeMaterial : [];
                            const otherExpense = autoJson && autoJson.otherExpense ? autoJson.otherExpense : [];
                            const produceProductdata = autoJson && autoJson.produceProductdata ? autoJson.produceProductdata : [];

                            const newRowMaterialJson = recipeMaterial.map((e, i) => {
                                console.log(e, ';;;;;;;;')
                                let jesu = {
                                    rmStockOutId: String("stockOut_" + Number(uid1.getTime() + i)),
                                    rawMaterialId: e.rawMaterialId,
                                    rawMaterialQty: e.usedMaterial,
                                    rawMaterialUnit: e.rmUnit,
                                    rmStockOutCategory: outCategory,
                                    rmStockOutComment: 'Auto StockOut',
                                    userId: userId,
                                    rmStockOutDate: data.mfStockInDate
                                }
                                return jesu;
                            })

                            addRmStockOutDetailsAutoPromise(newRowMaterialJson, mfStockInId)
                                .then(response => {
                                    const newOtherSourcelJson = otherExpense.map((e, i) => {
                                        let jesu = {
                                            usedSourceId: String("usedSource_" + Number(uid1.getTime() + i)),
                                            userId: userId,
                                            otherSourceId: e.otherSourceId,
                                            usedSourceQty: e.usedSource,
                                            usedSourcePrice: e.usedPrice,
                                            usedSourceDate: data.mfStockInDate,
                                            mfStockInId: mfStockInId,
                                        }
                                        return jesu;
                                    })
                                    addOtherSourceDataPromise(newOtherSourcelJson)
                                        .then(response => {
                                            const newProduceProductJson = produceProductdata.map((e, i) => {
                                                let jesu = {
                                                    mfStockOutId: String("stockOut_" + Number(uid1.getTime() + i)),
                                                    mfProductId: e.produceProductId,
                                                    mfProductQty: e.usedValue,
                                                    productUnit: e.ppUnit,
                                                    mfProductOutCategory: ppOutCategory,
                                                    rmStockOutComment: 'Auto StockOut',
                                                    userId: userId,
                                                    mfStockOutDate: data.mfStockInDate
                                                }
                                                return jesu;
                                            })
                                            console.log('.....', newProduceProductJson, produceProductdata)
                                            addMfStockOutDetailsAutoPromise(newProduceProductJson, mfStockInId)
                                                .then(response => {
                                                    console.log("response", response);
                                                    let sql_queries_getUsedCost = `-- CALCULATE RAW MATERIAL USED PRICE
                                                            SELECT COALESCE(SUM(rsod.rmStockOutPrice),0) AS usedRmStockOutPrice FROM factory_rmStockOut_data AS rsod
                                                            WHERE rsod.rmStockOutId IN (SELECT 
                                                                                            COALESCE(srsd.rmStockOutId,null) 
                                                                                        FROM 
                                                                                            factory_mfStockInWiseRmStockOut_data AS srsd 
                                                                                        WHERE srsd.mfStockInId = '${mfStockInId}');
                                                       -- CALCULATE OTHER SOURCE USED PRICE
                                                            SELECT COALESCE(SUM(usedSourcePrice),0) AS usedOtherSourcePrice FROM factory_otherSourceUsed_data WHERE mfStockInId = '${mfStockInId}';
                                                       -- CALCULATE MANUFACTURE PRODUCT USED PRICE
                                                            SELECT COALESCE(SUM(mfsod.mfProductOutPrice),0) AS usedMfStockOutPrice FROM factory_mfProductStockOut_data AS mfsod
                                                            WHERE mfsod.mfStockOutId IN(SELECT
                                                                                            COALESCE(mfrsd.mfStockOutId, NULL)
                                                                                        FROM
                                                                                            factory_mfStockInWiseMfStockOut_data AS mfrsd
                                                                                        WHERE mfrsd.mfStockInId = '${mfStockInId}')`;
                                                    pool.query(sql_queries_getUsedCost, (err, cost) => {
                                                        if (err) {
                                                            console.error("An error occurd in SQL Queery", err);
                                                            return res.status(500).send('Database Error');
                                                        }
                                                        const usedRmStockOutPrice = cost && cost[0].length ? cost[0][0].usedRmStockOutPrice : 0;
                                                        const usedOtherSourcePrice = cost && cost[1].length ? cost[1][0].usedOtherSourcePrice : 0;
                                                        const usedMfStockOutPrice = cost && cost[2].length ? cost[2][0].usedMfStockOutPrice : 0;
                                                        const eastimateCost = usedRmStockOutPrice + usedOtherSourcePrice + usedMfStockOutPrice

                                                        const sql_queries_getNeedData = `SELECT bigUnitName AS largerUnit, unitNumber AS value, smallUnitName AS smallerUnit FROM mfProduct_unit_preference WHERE mfProductId = '${data.mfProductId}' ORDER BY mfProduct_unit_preference.priorityNumber ASC;
                                                             SELECT mfpd.minMfProductUnit AS  minProductUnit FROM factory_manufactureProduct_data AS mfpd WHERE mfpd.mfProductId = '${data.mfProductId}'`;
                                                        pool.query(sql_queries_getNeedData, (err, result) => {
                                                            if (err) {
                                                                console.error("An error occurd in SQL Queery", err);
                                                                return res.status(500).send('Database Error');
                                                            }
                                                            const needData = {
                                                                unitsData: result && result[0] ? Object.values(JSON.parse(JSON.stringify(result[0]))) : null,
                                                                toUnit: result && result[1][0] && result[1][0].minProductUnit ? result[1][0].minProductUnit : null,
                                                            }
                                                            console.log(needData.unitsData);
                                                            const productFinalQty = (needData.unitsData && needData.unitsData.length !== 0) ? convertUnits(needData.unitsData, data.mfProductQty, data.mfProductUnit, needData.toUnit) : data.mfProductQty;
                                                            const productPrice = eastimateCost / productFinalQty;
                                                            const sql_querry_updatePrice = `UPDATE
                                                                    factory_mfProductStockIn_data
                                                                SET
                                                                    mfProductPrice = ${productPrice},
                                                                    totalPrice = ${eastimateCost}
                                                                WHERE mfStockInID = '${mfStockInId}'`;
                                                            pool.query(sql_querry_updatePrice, (err, data) => {
                                                                if (err) {
                                                                    console.error("An error occurd in SQL Queery", err);
                                                                    return res.status(500).send('Database Error');
                                                                }
                                                                return res.status(200).send("Data Added Successfully");
                                                            })
                                                        })
                                                    })
                                                }).catch(error => {
                                                    console.error('error', error); // Handle any errors
                                                })
                                        }).catch(error => {
                                            console.error(error); // Handle any errors
                                        });
                                }).catch(error => {
                                    console.error(error); // Handle any errors
                                });
                        } else {
                            return res.status(200).send("Data Added Successfully");
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

// Remove Manufacture Product StockIn Details

const removeMfProductStockInData = (req, res) => {
    try {
        const mfStockInID = req.query.mfStockInID
        req.query.mfStockInID = pool.query(`SELECT mfStockInID, mfProductQty, remainingQty FROM factory_mfProductStockIn_data WHERE mfStockInID = '${mfStockInID}'`, (err, row) => {
            if (err) {
                console.error("An error occurd in SQL Queery", err);
                return res.status(500).send('Database Error');
            }
            let isMfStockInID = row && row[0] ? row[0].mfStockInID : null;
            if (row && isMfStockInID) {
                const qty = row[0].mfProductQty;
                const remainQty = row[0].remainingQty;
                if (qty != remainQty) {
                    return res.status(400).send('You Can Not Delete This Transaction');
                } else {
                    const sql_query_getJesu = `SELECT rmStockOutId FROM factory_mfStockInWiseRmStockOut_data WHERE mfStockInId = '${mfStockInID}';
                                               SELECT mfStockOutId FROM factory_mfProductInwiseOut_data WHERE mfStockInId = '${mfStockInID}'`;
                    pool.query(sql_query_getJesu, (err, ids) => {
                        if (err) {
                            console.error("An error occurd in SQL Queery", err);
                            return res.status(500).send('Database Error');
                        }
                        const rawMaterialsId = ids && ids[0].length ? ids[0].map(item => item.rmStockOutId) : [];
                        const mfProductsId = ids && ids[1].length ? ids[1].map(item => item.mfStockOutId) : [];

                        if (rawMaterialsId && rawMaterialsId.length) {
                            removeRmStockIn(rawMaterialsId);
                        }
                        if (mfProductsId && mfProductsId.length) {
                            removeMfStockIn(rawMaterialsId);
                        }
                        const sql_querry_removedetails = `DELETE FROM factory_otherSourceUsed_data WHERE mfStockInId = '${mfStockInID}';
                                                          DELETE FROM factory_mfProductStockIn_data WHERE mfStockInID = '${mfStockInID}'`;
                        pool.query(sql_querry_removedetails, (err, data) => {
                            if (err) {
                                console.error("An error occurd in SQL Queery", err);
                                return res.status(500).send('Database Error');
                            }
                            return res.status(200).send("Transaction Deleted Successfully");
                        })
                    })
                }
            } else {
                return res.status(400).send('Transaction Not Found');
            }
        })
    } catch (error) {
        console.error('An error occurd', error);
        res.status(500).json('Internal Server Error');
    }
}

// Update Manufacture Product Stock IN

const updateMfProductStockInData = (req, res) => {
    try {
        let token;
        token = req.headers && req.headers.authorization ? req.headers.authorization.split(" ")[1] : null;
        if (token) {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const userId = decoded.id.id;
            const uid1 = new Date();
            const mfStockInId = req.body.mfStockInId;
            const outCategory = process.env.AUTO_RMOUT_ID;;
            const data = {
                mfProductId: req.body.mfProductId,
                mfProductQty: req.body.mfProductQty,
                mfProductUnit: req.body.mfProductUnit,
                totalPrice: req.body.totalPrice ? req.body.totalPrice : 0,
                mfStockInComment: req.body.mfStockInComment ? req.body.mfStockInComment.trim() : null,
                mfStockInDate: new Date(req.body.mfStockInDate ? req.body.mfStockInDate : null).toString().slice(4, 15),
                isAuto: req.body.isAuto ? req.body.isAuto : false,
                autoJson: req.body.autoJson ? req.body.autoJson : []
            }
            console.log(data.isAuto, 'dfasfasfasfa');
            if (!data.mfProductId || !data.mfProductQty || !data.mfProductUnit || !data.mfStockInDate) {
                res.status(404).send("Please Fill All The Fields");
            }
            const sql_queries_getNeedData = `SELECT bigUnitName AS largerUnit, unitNumber AS value, smallUnitName AS smallerUnit FROM mfProduct_unit_preference WHERE mfProductId = '${data.mfProductId}' ORDER BY mfProduct_unit_preference.priorityNumber ASC;
                                             SELECT mfpd.minMfProductUnit AS  minProductUnit FROM factory_manufactureProduct_data AS mfpd WHERE mfpd.mfProductId = '${data.mfProductId}'`;
            pool.query(sql_queries_getNeedData, (err, result) => {
                if (err) {
                    console.error("An error occurd in SQL Queery", err);
                    return res.status(500).send('Database Error');
                }
                const needData = {
                    unitsData: result && result[0] ? Object.values(JSON.parse(JSON.stringify(result[0]))) : null,
                    toUnit: result && result[1][0] && result[1][0].minProductUnit ? result[1][0].minProductUnit : null,
                }
                console.log(needData.unitsData);
                const productFinalQty = (needData.unitsData && needData.unitsData.length !== 0) ? convertUnits(needData.unitsData, data.mfProductQty, data.mfProductUnit, needData.toUnit) : data.mfProductQty;
                const sql_querry_addStockIn = `UPDATE
                                                    factory_mfProductStockIn_data
                                                SET
                                                    userId = '${userId}',
                                                    mfProductId = '${data.mfProductId}',
                                                    mfProductQty = ${productFinalQty},
                                                    mfProductPrice = ${data.totalPrice / productFinalQty},
                                                    totalPrice = ${data.totalPrice},
                                                    mfStockInDisplayQty =  ${data.mfProductQty},
                                                    mfStockInDisplayUnit = '${data.mfProductUnit}',
                                                    mfStockInComment = ${data.mfStockInComment ? `'${data.mfStockInComment}'` : null},
                                                    remainingQty = ${productFinalQty},
                                                    mfStockInDate = STR_TO_DATE('${data.mfStockInDate}','%b %d %Y')
                                                WHERE mfStockInID = '${mfStockInId}'`;
                pool.query(sql_querry_addStockIn, (err, raw) => {
                    if (err) {
                        console.error("An error occurd in SQL Queery", err);
                        return res.status(500).send('Database Error');
                    }
                    const sql_query_getJesu = `SELECT rmStockOutId  FROM factory_mfStockInWiseRmStockOut_data WHERE mfStockInId = '${mfStockInId}';
                                               SELECT mfStockOutId FROM factory_mfProductInwiseOut_data WHERE mfStockInId = '${mfStockInId}'`;
                    pool.query(sql_query_getJesu, (err, ids) => {
                        if (err) {
                            console.error("An error occurd in SQL Queery", err);
                            return res.status(500).send('Database Error');
                        }

                        const rawMaterialsId = ids && ids[0].length ? ids[0].map(item => item.rmStockOutId) : [];
                        const mfProductsId = ids && ids[1].length ? ids[1].map(item => item.mfStockOutId) : [];

                        if (rawMaterialsId && rawMaterialsId.length) {
                            removeRmStockIn(rawMaterialsId);
                        }
                        if (mfProductsId && mfProductsId.length) {
                            removeMfStockIn(rawMaterialsId);
                        }

                        const sql_querry_removedetails = `DELETE FROM factory_otherSourceUsed_data WHERE mfStockInId = '${mfStockInId}'`;
                        pool.query(sql_querry_removedetails, (err, result) => {
                            if (err) {
                                console.error("An error occurd in SQL Queery", err);
                                return res.status(500).send('Database Error');
                            }
                            if (data.isAuto) {
                                const autoJson = data.autoJson ? data.autoJson : null

                                const recipeMaterial = autoJson && autoJson.recipeMaterial ? autoJson.recipeMaterial : [];
                                const otherExpense = autoJson && autoJson.otherExpense ? autoJson.otherExpense : [];
                                const produceProductdata = autoJson && autoJson.produceProductdata ? autoJson.produceProductdata : [];

                                const newRowMaterialJson = recipeMaterial.map((e, i) => {
                                    console.log('joto', e);
                                    let jesu = {
                                        rmStockOutId: String("stockOut_" + Number(uid1.getTime() + i)),
                                        rawMaterialId: e.rawMaterialId,
                                        rawMaterialQty: e.usedMaterial,
                                        rawMaterialUnit: e.rmUnit,
                                        rmStockOutCategory: outCategory,
                                        rmStockOutComment: 'Auto StockOut',
                                        userId: userId,
                                        rmStockOutDate: data.mfStockInDate
                                    }
                                    return jesu;
                                })

                                addRmStockOutDetailsAutoPromise(newRowMaterialJson, mfStockInId)
                                    .then(response => {
                                        const newOtherSourcelJson = otherExpense.map((e, i) => {
                                            let jesu = {
                                                usedSourceId: String("usedSource_" + Number(uid1.getTime() + i)),
                                                userId: userId,
                                                otherSourceId: e.otherSourceId,
                                                usedSourceQty: e.usedSource,
                                                usedSourcePrice: e.usedPrice,
                                                usedSourceDate: data.mfStockInDate,
                                                mfStockInId: mfStockInId,
                                            }
                                            return jesu;
                                        })
                                        addOtherSourceDataPromise(newOtherSourcelJson)
                                            .then(response => {
                                                const newProduceProductJson = produceProductdata.map((e, i) => {
                                                    let jesu = {
                                                        mfStockOutId: String("stockOut_" + Number(uid1.getTime() + i)),
                                                        mfProductId: e.produceProductId,
                                                        mfProductQty: e.usedValue,
                                                        productUnit: e.ppUnit,
                                                        mfProductOutCategory: ppOutCategory,
                                                        rmStockOutComment: 'Auto StockOut',
                                                        userId: userId,
                                                        mfStockOutDate: data.mfStockInDate
                                                    }
                                                    return jesu;
                                                })
                                                console.log('.....', newProduceProductJson, produceProductdata)
                                                addMfStockOutDetailsAutoPromise(newProduceProductJson, mfStockInId)
                                                    .then(response => {
                                                        console.log("response", response);
                                                        let sql_queries_getUsedCost = `-- CALCULATE RAW MATERIAL USED PRICE
                                                                                            SELECT COALESCE(SUM(rsod.rmStockOutPrice),0) AS usedRmStockOutPrice FROM factory_rmStockOut_data AS rsod
                                                                                            WHERE rsod.rmStockOutId IN (SELECT 
                                                                                                                            COALESCE(srsd.rmStockOutId,null) 
                                                                                                                        FROM 
                                                                                                                            factory_mfStockInWiseRmStockOut_data AS srsd 
                                                                                                                        WHERE srsd.mfStockInId = '${mfStockInId}');
                                                                                       -- CALCULATE OTHER SOURCE USED PRICE
                                                                                            SELECT COALESCE(SUM(usedSourcePrice),0) AS usedOtherSourcePrice FROM factory_otherSourceUsed_data WHERE mfStockInId = '${mfStockInId}';
                                                                                       -- CALCULATE MANUFACTURE PRODUCT USED PRICE
                                                                                            SELECT COALESCE(SUM(mfsod.mfProductOutPrice),0) AS usedMfStockOutPrice FROM factory_mfProductStockOut_data AS mfsod
                                                                                            WHERE mfsod.mfStockOutId IN(SELECT
                                                                                                                            COALESCE(mfrsd.mfStockOutId, NULL)
                                                                                                                        FROM
                                                                                                                            factory_mfStockInWiseMfStockOut_data AS mfrsd
                                                                                                                        WHERE mfrsd.mfStockInId = '${mfStockInId}')`;
                                                        pool.query(sql_queries_getUsedCost, (err, cost) => {
                                                            if (err) {
                                                                console.error("An error occurd in SQL Queery", err);
                                                                return res.status(500).send('Database Error');
                                                            }
                                                            const usedRmStockOutPrice = cost && cost[0].length ? cost[0][0].usedRmStockOutPrice : 0;
                                                            const usedOtherSourcePrice = cost && cost[1].length ? cost[1][0].usedOtherSourcePrice : 0;
                                                            const usedMfStockOutPrice = cost && cost[2].length ? cost[2][0].usedMfStockOutPrice : 0;
                                                            const eastimateCost = usedRmStockOutPrice + usedOtherSourcePrice + usedMfStockOutPrice

                                                            const sql_queries_getNeedData = `SELECT bigUnitName AS largerUnit, unitNumber AS value, smallUnitName AS smallerUnit FROM mfProduct_unit_preference WHERE mfProductId = '${data.mfProductId}' ORDER BY mfProduct_unit_preference.priorityNumber ASC;
                                                             SELECT mfpd.minMfProductUnit AS  minProductUnit FROM factory_manufactureProduct_data AS mfpd WHERE mfpd.mfProductId = '${data.mfProductId}'`;
                                                            pool.query(sql_queries_getNeedData, (err, result) => {
                                                                if (err) {
                                                                    console.error("An error occurd in SQL Queery", err);
                                                                    return res.status(500).send('Database Error');
                                                                }
                                                                const needData = {
                                                                    unitsData: result && result[0] ? Object.values(JSON.parse(JSON.stringify(result[0]))) : null,
                                                                    toUnit: result && result[1][0] && result[1][0].minProductUnit ? result[1][0].minProductUnit : null,
                                                                }
                                                                console.log(needData.unitsData);
                                                                const productFinalQty = (needData.unitsData && needData.unitsData.length !== 0) ? convertUnits(needData.unitsData, data.mfProductQty, data.mfProductUnit, needData.toUnit) : data.mfProductQty;
                                                                const productPrice = eastimateCost / productFinalQty;
                                                                const sql_querry_updatePrice = `UPDATE
                                                                    factory_mfProductStockIn_data
                                                                SET
                                                                    mfProductPrice = ${productPrice},
                                                                    totalPrice = ${eastimateCost}
                                                                WHERE mfStockInID = '${mfStockInId}'`;
                                                                pool.query(sql_querry_updatePrice, (err, data) => {
                                                                    if (err) {
                                                                        console.error("An error occurd in SQL Queery", err);
                                                                        return res.status(500).send('Database Error');
                                                                    }
                                                                    return res.status(200).send("Data Updated Successfully");
                                                                })
                                                            })
                                                        })
                                                    }).catch(error => {
                                                        console.error('error', error); // Handle any errors
                                                    })
                                            }).catch(error => {
                                                console.error(error); // Handle any errors
                                            });
                                    }).catch(error => {
                                        console.error(error); // Handle any errors
                                    });
                            } else {
                                return res.status(200).send("Data Updated Successfully");
                            }
                        })
                    })

                })
            })
        } else {
            res.status(401).send("Please Login Firest.....!");
        }
    } catch (error) {
        console.error('An error occurd', error);
        res.status(500).json('Internal Server Error');
    }
}

// Fill Manufacture Products Stock In Data

const fillMfProductStockInData = (req, res) => {
    try {
        const mfStockInId = req.query.mfStockInId;
        if (!mfStockInId) {
            return res.status(404).send('ID Not Found');
        }
        let sql_query_getFillData = `SELECT
                                         mfStockInID AS mfStockInId,
                                         factory_mfProductStockIn_data.mfProductId,
                                         fmpd.mfProductName,
                                         mfProductPrice,
                                         totalPrice,
                                         mfStockInDisplayQty,
                                         mfStockInDisplayUnit,
                                         mfStockInComment,
                                         mfStockInDate
                                     FROM
                                         factory_mfProductStockIn_data
                                     INNER JOIN factory_manufactureProduct_data AS fmpd ON fmpd.mfProductId = factory_mfProductStockIn_data.mfProductId
                                     WHERE mfStockInID = '${mfStockInId}';
                                     SELECT
                                         rsod.rawMaterialId,
                                         rmd.rawMaterialName,
                                         rsod.rmStockOutDisplayQty AS usedMaterial,
                                         rsod.rmStockOutDisplayUnit AS rmUnit,
                                         (SELECT COALESCE(SUM(sd.remainingQty),0) FROM factory_rmStockIn_data AS sd WHERE sd.rawMaterialId =  rsod.rawMaterialId AND sd.remainingQty != 0) AS remainQty
                                     FROM
                                         factory_rmStockOut_data AS rsod
                                     INNER JOIN factory_rawMaterial_data AS rmd ON rmd.rawMaterialId = rsod.rawMaterialId
                                     WHERE
                                         rmStockOutId IN(
                                            SELECT
                                                COALESCE(rmStockOutId, NULL)
                                            FROM
                                                factory_mfStockInWiseRmStockOut_data
                                            WHERE
                                                mfStockInId = '${mfStockInId}'
                                         );
                                     SELECT
                                         fosud.otherSourceId,
                                         fosd.otherSourceName,
                                         fosd.otherSourcePrice AS unitPrice,
                                         fosud.usedSourceQty AS usedSource,
                                         fosd.otherSourceUnit AS osUnit,
                                         fosud.usedSourcePrice AS usedPrice
                                     FROM
                                         factory_otherSourceUsed_data AS fosud
                                     INNER JOIN factory_otherSource_data as fosd ON fosd.otherSourceId = fosud.otherSourceId
                                     WHERE mfStockInId = '${mfStockInId}';
                                     SELECT
                                         mpso.mfProductId AS produceProductId,
                                         mfpd.mfProductName,
                                         mpso.mfStockOutDisplayQty AS usedValue,
                                         mpso.mfStockOutDisplayUnit AS ppUnit,
                                         (SELECT COALESCE(SUM(sd.remainingQty),0) FROM factory_mfProductStockIn_data AS sd WHERE sd.mfProductId = mpso.mfProductId AND sd.remainingQty != 0) AS remainQty
                                     FROM
                                         factory_mfProductStockOut_data AS mpso
                                     INNER JOIN factory_manufactureProduct_data AS mfpd ON mfpd.mfProductId = mpso.mfProductId
                                     WHERE
                                         mfStockOutId IN(
                                            SELECT
                                                COALESCE(mfStockOutId, NULL)
                                            FROM
                                                factory_mfStockInWiseMfStockOut_data
                                            WHERE
                                                mfStockInId = '${mfStockInId}'
                                         )`;
        pool.query(sql_query_getFillData, (err, data) => {
            if (err) {
                console.error("An error occurd in SQL Queery", err);
                return res.status(500).send('Database Error');
            }
            const stockInData = data && data[0].length ? Object.values(JSON.parse(JSON.stringify(data[0]))) : [];
            const rmData = data && data[1].length ? Object.values(JSON.parse(JSON.stringify(data[1]))) : [];
            const osData = data && data[2].length ? Object.values(JSON.parse(JSON.stringify(data[2]))) : [];
            const mfData = data && data[3].length ? Object.values(JSON.parse(JSON.stringify(data[3]))) : [];

            processDatas(rmData)
                .then(async (data) => {
                    // console.log('json 1', datas);
                    // console.log('json 2', data);
                    const newData = rmData ? rmData.map((element, index) => ({ ...element, remainQty: data[index].xyz })
                    ) : []
                    processDatas1(mfData)
                        .then(async (mfDatas) => {
                            // console.log('json 1', newDats);
                            // console.log('json 2', mfdata);
                            const mfnewData = mfData ? mfData.map((element, index) => ({ ...element, remainQty: mfDatas[index].xyz })
                            ) : []
                            const fillStockInJson = {
                                ...stockInData[0],
                                isAuto: (newData.length == 0 && osData.length == 0 && mfnewData == 0) ? false : true,
                                autoJson: {
                                    recipeMaterial: newData,
                                    otherExpense: osData,
                                    produceProductdata: mfnewData
                                }
                            }
                            return res.status(200).send(fillStockInJson);
                        }).catch(error => {
                            console.error('Error in processing datas:', error);
                            return //res.status(500).send('Internal Error');
                        });
                }).catch(error => {
                    console.error('Error in processing datas:', error);
                    return //res.status(500).send('Internal Error');
                });
        })
    } catch (error) {
        console.error('An error occurd', error);
        res.status(500).json('Internal Server Error');
    }
}

module.exports = {
    addMfProductStockInData,
    removeMfProductStockInData,
    updateMfProductStockInData,
    getmfProductStockInList,
    fillMfProductStockInData
}