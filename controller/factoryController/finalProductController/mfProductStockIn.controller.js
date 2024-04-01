const pool = require('../../../database');
const jwt = require("jsonwebtoken");
const excelJS = require("exceljs");
const { jsPDF } = require('jspdf');
require('jspdf-autotable');
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
                batchQty: req.body.batchQty ? req.body.batchQty : 0,
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
                                                                                            batchQty,
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
                                                                                            ${data.batchQty},
                                                                                            ${productFinalQty},
                                                                                            ${data.totalPrice / productFinalQty},
                                                                                            ${data.totalPrice},
                                                                                            ${data.mfProductQty},
                                                                                            '${data.mfProductUnit}',
                                                                                            ${data.mfStockInComment ? `'${data.mfStockInComment}'` : null},
                                                                                            ${productFinalQty},
                                                                                            STR_TO_DATE('${data.mfStockInDate}','%b %d %Y'))`;
                    pool.query(sql_querry_addStockIn, (err, raw) => {
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
                                                    mfStockOutComment: 'Auto StockOut',
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
        const mfStockInID = req.query.mfStockInId
        req.query.mfStockInID = pool.query(`SELECT mfStockInID, mfProductQty, remainingQty FROM factory_mfProductStockIn_data WHERE mfStockInID = '${mfStockInID}'`, (err, row) => {
            if (err) {
                console.error("An error occurd in SQL Queery", err);
                return res.status(500).send('Database Error');
            }
            console.log()
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
                                         batchQty,
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
                                         (SELECT COALESCE(SUM(sd.remainingQty),0) FROM factory_rmStockIn_data AS sd WHERE sd.rawMaterialId =  rsod.rawMaterialId AND sd.remainingQty != 0) AS remainQty,
                                         rsod.rmStockOutPrice AS rmStockOutPrice
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
                                         (SELECT COALESCE(SUM(sd.remainingQty),0) FROM factory_mfProductStockIn_data AS sd WHERE sd.mfProductId = mpso.mfProductId AND sd.remainingQty != 0) AS remainQty,
                                         mpso.mfProductOutPrice AS mfProductOutPrice
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
                    const newData = rmData ? rmData.map((element, index) => ({ ...element, remainQty: data[index].xyz })
                    ) : []
                    processDatas1(mfData)
                        .then(async (mfDatas) => {
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

// Export Excel for StockIn

const exportExcelSheetForMfStockIn = (req, res) => {
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
            const commanQuarry = `SELECT
                                    CONCAT(
                                              user_details.userFirstName,
                                              ' ',
                                              user_details.userLastName
                                          ) AS enterBy,
                                          UPPER(factory_manufactureProduct_data.mfProductName) AS productName,
                                          CONCAT(mfStockInDisplayQty,' ',mfStockInDisplayUnit) AS Qty,
                                          ROUND(mfProductPrice,2) AS Price,
                                          totalPrice AS totalPrice,
                                          mfStockInComment AS comment,
                                          DATE_FORMAT(mfStockInDate, '%d-%m-%Y') AS mfStockInDate,
                                          DATE_FORMAT(mfStockInCreationDate, '%h:%i %p') AS mfStockInTime
                                  FROM
                                        factory_mfProductStockIn_data
                                  INNER JOIN user_details ON user_details.userId = factory_mfProductStockIn_data.userId
                                  INNER JOIN factory_manufactureProduct_data ON factory_manufactureProduct_data.mfProductId = factory_mfProductStockIn_data.mfProductId
                                  WHERE factory_mfProductStockIn_data.mfProductId IN (SELECT COALESCE(fmp.mfProductId, null) FROM factory_manufactureProduct_data AS fmp WHERE fmp.mfProductCategoryId = '${departmentId}')`;
            if (req.query.mfProductId && req.query.startDate && req.query.endDate) {
                sql_queries_getdetails = `${commanQuarry}
                                                  AND factory_mfProductStockIn_data.mfProductId = '${data.mfProductId}' AND factory_mfProductStockIn_data.mfStockInDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')
                                                  ORDER BY factory_mfProductStockIn_data.mfStockInDate DESC, factory_mfProductStockIn_data.mfStockInCreationDate DESC`;
            } else if (req.query.startDate && req.query.endDate) {
                sql_queries_getdetails = `${commanQuarry}
                                                  AND factory_mfProductStockIn_data.mfStockInDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y') 
                                                  ORDER BY factory_mfProductStockIn_data.mfStockInDate DESC, factory_mfProductStockIn_data.mfStockInCreationDate DESC`;
            } else if (req.query.mfProductId) {
                sql_queries_getdetails = `${commanQuarry}
                                                  AND factory_mfProductStockIn_data.mfProductId = '${data.mfProductId}'
                                                  ORDER BY factory_mfProductStockIn_data.mfStockInDate DESC, factory_mfProductStockIn_data.mfStockInCreationDate DESC`;
            } else {
                sql_queries_getdetails = `${commanQuarry}
                                                  ORDER BY factory_mfProductStockIn_data.mfStockInDate DESC, factory_mfProductStockIn_data.mfStockInCreationDate DESC`;
            }
            pool.query(sql_queries_getdetails, async (err, rows) => {
                if (err) return res.status(404).send(err);
                const workbook = new excelJS.Workbook();  // Create a new workbook
                const worksheet = workbook.addWorksheet("StockIn List"); // New Worksheet

                if (req.query.startDate && req.query.endDate) {
                    worksheet.mergeCells('A1', 'I1');
                    worksheet.getCell('A1').value = `Stock In From ${data.startDate} To ${data.endDate}`;
                } else {
                    worksheet.mergeCells('A1', 'I1');
                    worksheet.getCell('A1').value = `ALL Stock In`;
                }

                /*Column headers*/
                worksheet.getRow(2).values = ['S no.', 'Entered By', 'Product', 'Quantity', 'Price', 'Total', 'Comment', 'Date', "Time"];

                // Column for data in excel. key must match data key
                worksheet.columns = [
                    { key: "s_no", width: 10, },
                    { key: "enterBy", width: 20 },
                    { key: "productName", width: 30 },
                    { key: "Qty", width: 20 },
                    { key: "Price", width: 10 },
                    { key: "totalPrice", width: 10 },
                    { key: "comment", width: 30 },
                    { key: "mfStockInDate", width: 20 },
                    { key: "mfStockInTime", width: 20 },
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
                worksheet.getRow(arr.length + 3).values = ['Total:', '', '', '', '', { formula: `SUM(F3:F${arr.length + 2})` }];

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

// Export PDF For StockIn

const exportPdfForMfStockIn = (req, res) => {
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
                const commanQuarry = `SELECT
                                          CONCAT(
                                              user_details.userFirstName,
                                              ' ',
                                              user_details.userLastName
                                          ) AS "Enter By",
                                          UPPER(factory_manufactureProduct_data.mfProductName) AS "Product Name",
                                          CONCAT(mfStockInDisplayQty,' ',mfStockInDisplayUnit) AS "Quantity",
                                          ROUND(mfProductPrice,2) AS "Price",
                                          totalPrice AS "Total Price",
                                          mfStockInComment AS "Comment",
                                          DATE_FORMAT(mfStockInDate, '%d-%m-%Y') AS "Date",
                                          DATE_FORMAT(mfStockInCreationDate, '%h:%i %p') AS "Time"
                                      FROM
                                          factory_mfProductStockIn_data
                                      INNER JOIN user_details ON user_details.userId = factory_mfProductStockIn_data.userId
                                      INNER JOIN factory_manufactureProduct_data ON factory_manufactureProduct_data.mfProductId = factory_mfProductStockIn_data.mfProductId
                                      WHERE factory_mfProductStockIn_data.mfProductId IN (SELECT COALESCE(fmp.mfProductId, null) FROM factory_manufactureProduct_data AS fmp WHERE fmp.mfProductCategoryId = '${departmentId}')`;
                if (req.query.mfProductId && req.query.startDate && req.query.endDate) {
                    sql_queries_getdetails = `${commanQuarry}
                                                  AND factory_mfProductStockIn_data.mfProductId = '${data.mfProductId}' AND factory_mfProductStockIn_data.mfStockInDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')
                                                  ORDER BY factory_mfProductStockIn_data.mfStockInDate DESC, factory_mfProductStockIn_data.mfStockInCreationDate DESC`;
                } else if (req.query.startDate && req.query.endDate) {
                    sql_queries_getdetails = `${commanQuarry}
                                                  AND factory_mfProductStockIn_data.mfStockInDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y') 
                                                  ORDER BY factory_mfProductStockIn_data.mfStockInDate DESC, factory_mfProductStockIn_data.mfStockInCreationDate DESC`;
                } else if (req.query.mfProductId) {
                    sql_queries_getdetails = `${commanQuarry}
                                                  AND factory_mfProductStockIn_data.mfProductId = '${data.mfProductId}'
                                                  ORDER BY factory_mfProductStockIn_data.mfStockInDate DESC, factory_mfProductStockIn_data.mfStockInCreationDate DESC`;
                } else {
                    sql_queries_getdetails = `${commanQuarry}
                                                  ORDER BY factory_mfProductStockIn_data.mfStockInDate DESC, factory_mfProductStockIn_data.mfStockInCreationDate DESC`;
                }
                pool.query(sql_queries_getdetails, (err, rows) => {
                    if (err) {
                        console.error("An error occurd in SQL Queery", err);
                        return res.status(500).send('Database Error');
                    } else if (rows && rows.length <= 0) {
                        return res.status(400).send('No Data Found');
                    }
                    const abc = Object.values(JSON.parse(JSON.stringify(rows)));
                    const sumOfTotalPrice = abc.reduce((total, item) => total + (item['Total Price'] || 0), 0);;
                    const sumFooterArray = ['Total', '', '', '', '', parseFloat(sumOfTotalPrice).toLocaleString('en-IN')];
                    if (req.query.startMonth && req.query.endMonth) {
                        tableHeading = `StockIn Data From ${data.startDate} To ${data.endDate}`;
                    } else {
                        tableHeading = `All StockIn Data`;
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
    addMfProductStockInData,
    removeMfProductStockInData,
    getmfProductStockInList,
    fillMfProductStockInData,
    exportExcelSheetForMfStockIn,
    exportPdfForMfStockIn
}