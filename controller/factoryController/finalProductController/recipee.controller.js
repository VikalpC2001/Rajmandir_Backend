const { json } = require('express');
const pool = require('../../../database');

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

// FUNCTION FOR RAW MATERIAL

function lowToHeighConversation(rmId, qty, unit, callback) {
    let sql_queries_getNeedData = `SELECT bigUnitName AS largerUnit, unitNumber AS value, smallUnitName AS smallerUnit FROM factory_rmUnit_preference WHERE rawMaterialId = '${rmId}' ORDER BY factory_rmUnit_preference.priorityNumber ASC;
                                   SELECT ipd.minRawMaterialUnit AS  minRawMaterialUnit FROM factory_rawMaterial_data AS ipd WHERE ipd.rawMaterialId = '${rmId}'`;
    pool.query(sql_queries_getNeedData, (err, result) => {
        if (err) {
            console.error("An error occurd in SQL Queery", err);
            return callback('Database Error', null);
        }
        const needData = {
            unitsData: result && result[0] ? Object.values(JSON.parse(JSON.stringify(result[0]))) : null,
            toUnit: result && result[1][0] && result[1][0].minRawMaterialUnit ? result[1][0].minRawMaterialUnit : null,
        }
        console.log(needData.unitsData);
        let productFinalQty = (needData.unitsData && needData.unitsData.length !== 0) ? convertUnits(needData.unitsData, qty, needData.toUnit, unit) : qty;
        callback(null, { xyz: productFinalQty });
    })
}

function temp(id, qty, unit) {
    return new Promise((resolve, reject) => {
        lowToHeighConversation(id, qty, unit, (err, newJson) => {
            if (err) {
                console.error(err);
                reject(err);
            } else {
                resolve(newJson);
            }
        });
    });
}

async function processDatas(datas) {
    const updatedDatas = [];
    for (const e of datas) {
        try {
            const newJson = await temp(e.rawMaterialId, e.remainQty, e.rmUnit);
            updatedDatas.push(newJson);
        } catch (error) {
            // Handle errors here
            console.error(error);
        }
    }
    return updatedDatas;
}

// FUNCTION FOR MANUFACTURE PRODUCT DATA

function conversation(id, qty, unit, callback) {
    let sql_queries_getNeedData = `SELECT bigUnitName AS largerUnit, unitNumber AS value, smallUnitName AS smallerUnit FROM mfProduct_unit_preference WHERE mfProductId = '${id}' ORDER BY mfProduct_unit_preference.priorityNumber ASC;
                                   SELECT ipd.minMfProductUnit AS minMfProductUnit FROM factory_manufactureProduct_data AS ipd WHERE ipd.mfProductId = '${id}'`;
    pool.query(sql_queries_getNeedData, (err, result) => {
        if (err) {
            console.error("An error occurd in SQL Queery", err);
            return callback('Database Error', null);
        }
        const needData = {
            unitsData: result && result[0] ? Object.values(JSON.parse(JSON.stringify(result[0]))) : null,
            toUnit: result && result[1][0] && result[1][0].minMfProductUnit ? result[1][0].minMfProductUnit : null,
        }
        console.log(needData.unitsData);
        let productFinalQty = (needData.unitsData && needData.unitsData.length !== 0) ? convertUnits(needData.unitsData, qty, needData.toUnit, unit) : qty;
        callback(null, { xyz: productFinalQty });
    })
}

function temp1(id, qty, unit) {
    return new Promise((resolve, reject) => {
        conversation(id, qty, unit, (err, newJson) => {
            if (err) {
                console.error(err);
                reject(err);
            } else {
                resolve(newJson);
            }
        });
    });
}

async function processDatas1(datas) {
    const updatedDatas = [];
    for (const e of datas) {
        try {
            const newJson = await temp1(e.produceProductId, e.remainQty, e.ppUnit);
            updatedDatas.push(newJson);
        } catch (error) {
            // Handle errors here
            console.error(error);
        }
    }
    return updatedDatas;
}

// Function TO Get Units Raw Material

async function getMaterialUnits(rawMaterialId, callback) {

    if (!rawMaterialId) {
        callback("rawMaterialId Not Found");
    }
    sql_querry_getUnitById = `SELECT 0 AS priorityNum, minRawMaterialUnit AS unitName FROM factory_rawMaterial_data WHERE rawMaterialId = '${rawMaterialId}';
                              SELECT priorityNumber AS priorityNum, bigUnitName AS unitName FROM factory_rmUnit_preference WHERE rawMaterialId = '${rawMaterialId}' ORDER BY priorityNum ASC`;
    pool.query(sql_querry_getUnitById, (err, data) => {
        if (err) {
            console.error("An error occurd in SQL Queery", err);
            callback('Database Error');
        }
        const combinedData = [].concat(...data);
        callback(Object.values(JSON.parse(JSON.stringify(combinedData))));
    })
}

function asd(id) {
    return new Promise((resolve, reject) => {
        getMaterialUnits(id, (newJson, err) => {
            if (err) {
                console.error(err);
                reject(err);
            } else {
                console.log('???', newJson)
                resolve(newJson);
            }
        });
    });
}

async function rmUnits(datas) {
    const updatedDatas = [];
    for (const e of datas) {
        try {
            const newJson = await asd(e.materialId);
            updatedDatas.push(newJson);
        } catch (error) {
            console.error(error);
        }
    }
    return updatedDatas;
}

// Function TO Get Units Manufacture Products

async function getMfProductsUnits(mfProductId, callback) {

    if (!mfProductId) {
        callback("mfProductId Not Found");
    }
    sql_querry_getUnitById = `SELECT 0 AS priorityNum, minMfProductUnit AS unitName FROM factory_manufactureProduct_data WHERE mfProductId = '${mfProductId}';
                              SELECT priorityNumber AS priorityNum, bigUnitName AS unitName FROM mfProduct_unit_preference WHERE mfProductId = '${mfProductId}' ORDER BY priorityNum ASC`;
    pool.query(sql_querry_getUnitById, (err, data) => {
        if (err) {
            console.error("An error occurd in SQL Queery", err);
            callback(500).send('Database Error');
        }
        const combinedData = [].concat(...data);
        callback(Object.values(JSON.parse(JSON.stringify(combinedData))));
    })
}

function asdf(id) {
    return new Promise((resolve, reject) => {
        getMfProductsUnits(id, (newJson, err) => {
            if (err) {
                console.error(err);
                reject(err);
            } else {
                console.log('???', newJson)
                resolve(newJson);
            }
        });
    });
}

async function mfUnits(datas) {
    const updatedDatas = [];
    for (const e of datas) {
        try {
            const newJson = await asdf(e.produceProductId);
            updatedDatas.push(newJson);
        } catch (error) {
            console.error(error);
        }
    }
    return updatedDatas;
}


// ADD Recipee Details

const addRecipeeData = (req, res) => {
    try {
        const recipeeData = req.body;
        // var recipeeData = {
        //     mfProductId: '90909ff',
        //     recipeMaterial: [
        //         {
        //             materialId: "rawMaterial_1706172256680",
        //             unit: "Kg",
        //             value: 1,
        //         },
        //     ],
        //     otherExpense: [
        //         {
        //             otherSouceId: "elc",
        //             unit: "kw",
        //             value: 1

        //         },
        //         {
        //             otherSouceId: "other",
        //             unit: "ltr",
        //             value: 20
        //         }
        //     ],
        //     produceProduct: [
        //         {
        //             produceProductId: "IUIUIUIU",
        //             unit: "box",
        //             value: 5
        //         },
        //         {
        //             produceProductId: "IUIUIUIU",
        //             unit: "box",
        //             value: 5
        //         }
        //     ]
        // }

        const mfProductId = recipeeData && recipeeData.mfProductId && recipeeData.mfProductId.length ? recipeeData.mfProductId : null;
        const recipeMaterial = recipeeData && recipeeData.recipeMaterial && recipeeData.recipeMaterial.length != 0 ? recipeeData.recipeMaterial : [];
        const otherExpense = recipeeData && recipeeData.otherExpense && recipeeData.otherExpense.length != 0 ? recipeeData.otherExpense : [];
        const produceProduct = recipeeData && recipeeData.produceProduct && recipeeData.produceProduct.length != 0 ? recipeeData.produceProduct : [];
        console.log(recipeeData);
        if (!mfProductId && mfProductId == null) {
            return res.status(404).send('mfProductId Not Found');
        }
        const sql_query_chkRecipee = `SELECT mfProductId FROM factory_rawMaterialRecipee_data WHERE mfProductId = '${mfProductId}';
                                      SELECT mfProductId FROM factory_otherSourceRecipee_data WHERE mfProductId = '${mfProductId}';
                                      SELECT mfProductId FROM factory_mfProductRecipee_data WHERE mfProductId = '${mfProductId}'`;

        pool.query(sql_query_chkRecipee, (err, chk) => {
            if (err) {
                console.error("An error occurd in SQL Queery", err);
                return res.status(500).send('Database Error');
            }
            const chkId = chk.flat();
            console.log(chkId);
            if (chkId && chkId.length) {
                return res.status(400).send('Recipee Alredy Exist');
            } else {
                // Add Recipee Material Data Function

                let addRecipeeMaterialData = recipeMaterial.map((item, index) => {
                    let uniqueId = `rmRecipeeId_${Date.now() + index}`; // Generating a unique ID using current timestamp
                    return `('${uniqueId}', '${mfProductId}', '${item.materialId}', ${item.value}, '${item.unit}')`;
                }).join(', ');

                // Add Other Source Data Function

                let addOtherExpenseData = otherExpense.map((item, index) => {
                    let uniqueId = `osRecipeeId_${Date.now() + index}`; // Generating a unique ID using current timestamp
                    return `('${uniqueId}', '${mfProductId}', '${item.otherSouceId}', ${item.value}, '${item.unit}')`;
                }).join(', ');

                // Produce Product Data Function

                let addProduceProductData = produceProduct.map((item, index) => {
                    let uniqueId = `osRecipeeId_${Date.now() + index}`; // Generating a unique ID using current timestamp
                    return `('${uniqueId}', '${mfProductId}', '${item.produceProductId}', ${item.value}, '${item.unit}')`;
                }).join(', ');

                const sql_query_addRawMaterialRecipee = `INSERT INTO factory_rawMaterialRecipee_data(recipeeId, mfProductId, rawMaterialId, rmValue, rmUnit)
                                                         VALUES ${addRecipeeMaterialData}`;

                const sql_query_addOtherExpenseRecipee = `INSERT INTO factory_otherSourceRecipee_data(recipeeId, mfProductId, otherSourceId, osValue, osUnit)
                                                          VALUES ${addOtherExpenseData}`;

                const sql_query_addProduceProductRecipee = `INSERT INTO factory_mfProductRecipee_data(recipeeId, mfProductId, produceProductId, ppValue, ppUnit)
                                                            VALUES ${addProduceProductData}`

                if (recipeMaterial && otherExpense && produceProduct && recipeMaterial.length && otherExpense.length && produceProduct.length && addRecipeeMaterialData.length && addOtherExpenseData.length && addProduceProductData.length) {
                    sql_queries_addRecipee = `${sql_query_addRawMaterialRecipee};
                                              ${sql_query_addOtherExpenseRecipee};
                                              ${sql_query_addProduceProductRecipee}`;
                    console.log('1');
                } else if (recipeMaterial && otherExpense && recipeMaterial.length && otherExpense.length && addRecipeeMaterialData.length && addOtherExpenseData.length) {
                    sql_queries_addRecipee = `${sql_query_addRawMaterialRecipee};
                                              ${sql_query_addOtherExpenseRecipee}`;
                    console.log('2');
                } else if (otherExpense && produceProduct && otherExpense.length && produceProduct.length && addOtherExpenseData.length && addProduceProductData.length) {
                    sql_queries_addRecipee = `${sql_query_addOtherExpenseRecipee};
                                              ${sql_query_addProduceProductRecipee}`;
                    console.log('3');
                } else if (recipeMaterial && produceProduct && recipeMaterial.length && produceProduct.length && addRecipeeMaterialData.length && addProduceProductData.length) {
                    sql_queries_addRecipee = `${sql_query_addRawMaterialRecipee};
                                              ${sql_query_addProduceProductRecipee}`;
                    console.log('4');
                } else if (recipeMaterial && recipeMaterial.length && addRecipeeMaterialData.length) {
                    sql_queries_addRecipee = `${sql_query_addRawMaterialRecipee}`;
                    console.log('5');
                } else if (otherExpense && otherExpense.length && addOtherExpenseData.length) {
                    sql_queries_addRecipee = `${sql_query_addOtherExpenseRecipee}`;
                    console.log('6');
                } else if (produceProduct && produceProduct.length && addProduceProductData.length) {
                    sql_queries_addRecipee = `${sql_query_addProduceProductRecipee}`;
                    console.log('7');
                } else {
                    return res.status(404).send('No Json Array Found');
                }
                console.log(sql_queries_addRecipee);
                pool.query(sql_queries_addRecipee, (err, data) => {
                    if (err) {
                        console.error("An error occurd in SQL Queery", err);
                        return res.status(500).send('Database Error');;
                    }
                    return res.status(200).send('Recipee Add Successfully');
                })
            }
        })
    } catch (error) {
        console.error('An error occurd', error);
        res.status(500).send('Internal Server Error');
    }
}

// Remove Recipee Data

const removeRecipeeData = (req, res) => {
    try {
        const mfProductId = req.query.mfProductId;
        const sql_query_chkRecipee = `SELECT mfProductId FROM factory_rawMaterialRecipee_data WHERE mfProductId = '${mfProductId}';
                                      SELECT mfProductId FROM factory_otherSourceRecipee_data WHERE mfProductId = '${mfProductId}';
                                      SELECT mfProductId FROM factory_mfProductRecipee_data WHERE mfProductId = '${mfProductId}'`;

        pool.query(sql_query_chkRecipee, (err, chk) => {
            if (err) {
                console.error("An error occurd in SQL Queery", err);
                return res.status(500).send('Database Error');
            }
            const chkId = chk.flat();
            console.log(chkId && chkId.length);
            if (chkId && chkId.length) {
                const sql_qurey_removeRecipee = `DELETE FROM factory_rawMaterialRecipee_data WHERE mfProductId = '${mfProductId}';
                                                 DELETE FROM factory_otherSourceRecipee_data WHERE mfProductId = '${mfProductId}';
                                                 DELETE FROM factory_mfProductRecipee_data WHERE mfProductId = '${mfProductId}'`;
                pool.query(sql_qurey_removeRecipee, (err, data) => {
                    if (err) {
                        console.error("An error occurd in SQL Queery", err);
                        return res.status(500).send('Database Error');
                    }
                    return res.status(200).send('Recipee Deleted Successfully');
                })
            } else {
                return res.status(404).send('Recipee Not Found');
            }
        })
    } catch (error) {
        console.error('An error occurd', error);
        res.status(500).send('Internal Server Error');
    }
}

// Update Recipee Data

const updateRecipeeData = (req, res) => {
    try {
        const recipeeData = req.body;

        const mfProductId = recipeeData && recipeeData.mfProductId && recipeeData.mfProductId.length ? recipeeData.mfProductId : null;
        const recipeMaterial = recipeeData && recipeeData.recipeMaterial && recipeeData.recipeMaterial.length != 0 ? recipeeData.recipeMaterial : [];
        const otherExpense = recipeeData && recipeeData.otherExpense && recipeeData.otherExpense.length != 0 ? recipeeData.otherExpense : [];
        const produceProduct = recipeeData && recipeeData.produceProduct && recipeeData.produceProduct.length != 0 ? recipeeData.produceProduct : [];

        if (!mfProductId && mfProductId == null) {
            return res.status(404).send('mfProductId Not Found');
        }

        const sql_query_chkRecipee = `SELECT mfProductId FROM factory_rawMaterialRecipee_data WHERE mfProductId = '${mfProductId}';
                                      SELECT mfProductId FROM factory_otherSourceRecipee_data WHERE mfProductId = '${mfProductId}';
                                      SELECT mfProductId FROM factory_mfProductRecipee_data WHERE mfProductId = '${mfProductId}'`;

        pool.query(sql_query_chkRecipee, (err, chk) => {
            if (err) {
                console.error("An error occurd in SQL Queery", err);
                return res.status(500).send('Database Error');
            }
            const chkId = chk.flat();
            console.log(chkId);
            if (chkId && chkId.length) {
                // Step 1 Firest Delete Old All Recipee

                const sql_qurey_removeRecipee = `DELETE FROM factory_rawMaterialRecipee_data WHERE mfProductId = '${mfProductId}';
                                                 DELETE FROM factory_otherSourceRecipee_data WHERE mfProductId = '${mfProductId}';
                                                 DELETE FROM factory_mfProductRecipee_data WHERE mfProductId = '${mfProductId}'`;
                pool.query(sql_qurey_removeRecipee, (err, data) => {
                    if (err) {
                        console.error("An error occurd in SQL Queery", err);
                        return res.status(500).send('Database Error');
                    }
                    // Step 2 Add New Updated Recipee
                    // Add Recipee Material Data Function

                    let addRecipeeMaterialData = recipeMaterial.map((item, index) => {
                        let uniqueId = `rmRecipeeId_${Date.now() + index}`; // Generating a unique ID using current timestamp
                        return `('${uniqueId}', '${mfProductId}', '${item.materialId}', ${item.value}, '${item.unit}')`;
                    }).join(', ');

                    // Add Other Source Data Function

                    let addOtherExpenseData = otherExpense.map((item, index) => {
                        let uniqueId = `osRecipeeId_${Date.now() + index}`; // Generating a unique ID using current timestamp
                        return `('${uniqueId}', '${mfProductId}', '${item.otherSourceId}', ${item.value}, '${item.unit}')`;
                    }).join(', ');

                    // Produce Product Data Function

                    let addProduceProductData = produceProduct.map((item, index) => {
                        let uniqueId = `osRecipeeId_${Date.now() + index}`; // Generating a unique ID using current timestamp
                        return `('${uniqueId}', '${mfProductId}', '${item.produceProductId}', ${item.value}, '${item.unit}')`;
                    }).join(', ');

                    const sql_query_addRawMaterialRecipee = `INSERT INTO factory_rawMaterialRecipee_data(recipeeId, mfProductId, rawMaterialId, rmValue, rmUnit)
                                                             VALUES ${addRecipeeMaterialData}`;

                    const sql_query_addOtherExpenseRecipee = `INSERT INTO factory_otherSourceRecipee_data(recipeeId, mfProductId, otherSourceId, osValue, osUnit)
                                                              VALUES ${addOtherExpenseData}`;

                    const sql_query_addProduceProductRecipee = `INSERT INTO factory_mfProductRecipee_data(recipeeId, mfProductId, produceProductId, ppValue, ppUnit)
                                                                VALUES ${addProduceProductData}`

                    if (recipeMaterial && otherExpense && produceProduct && recipeMaterial.length && otherExpense.length && produceProduct.length && addRecipeeMaterialData.length && addOtherExpenseData.length && addProduceProductData.length) {
                        sql_queries_addRecipee = `${sql_query_addRawMaterialRecipee};
                                          ${sql_query_addOtherExpenseRecipee};
                                          ${sql_query_addProduceProductRecipee}`;
                        console.log('1');
                    } else if (recipeMaterial && otherExpense && recipeMaterial.length && otherExpense.length && addRecipeeMaterialData.length && addOtherExpenseData.length) {
                        sql_queries_addRecipee = `${sql_query_addRawMaterialRecipee};
                                          ${sql_query_addOtherExpenseRecipee}`;
                        console.log('2');
                    } else if (otherExpense && produceProduct && otherExpense.length && produceProduct.length && addOtherExpenseData.length && addProduceProductData.length) {
                        sql_queries_addRecipee = `${sql_query_addOtherExpenseRecipee};
                                          ${sql_query_addProduceProductRecipee}`;
                        console.log('3');
                    } else if (recipeMaterial && produceProduct && recipeMaterial.length && produceProduct.length && addRecipeeMaterialData.length && addProduceProductData.length) {
                        sql_queries_addRecipee = `${sql_query_addRawMaterialRecipee};
                                          ${sql_query_addProduceProductRecipee}`;
                        console.log('4');
                    } else if (recipeMaterial && recipeMaterial.length && addRecipeeMaterialData.length) {
                        sql_queries_addRecipee = `${sql_query_addRawMaterialRecipee}`;
                        console.log('5');
                    } else if (otherExpense && otherExpense.length && addOtherExpenseData.length) {
                        sql_queries_addRecipee = `${sql_query_addOtherExpenseRecipee}`;
                        console.log('6');
                    } else if (produceProduct && produceProduct.length && addProduceProductData.length) {
                        sql_queries_addRecipee = `${sql_query_addProduceProductRecipee}`;
                        console.log('7');
                    } else {
                        return res.status(404).send('No Json Array Found');
                    }
                    pool.query(sql_queries_addRecipee, (err, data) => {
                        if (err) {
                            console.error("An error occurd in SQL Queery", err);
                            return res.status(500).send('Database Error');;
                        }
                        return res.status(200).send('Recipee Updated Successfully');
                    })
                })
            } else {
                return res.status(400).send('Recipee Not Exist');
            }
        })
    } catch (error) {
        console.error('An error occurd', error);
        res.status(500).send('Internal Server Error');
    }
}

// Fill Recipee wise Data

const fillRecipeeDataById = (req, res) => {
    try {
        const mfProductId = req.query.mfProductId;
        const qty = req.query.qty ? req.query.qty : 0;
        const unit = req.query.unit;
        console.log(unit, 'ffffff');

        const sql_queries_getNeedData = `SELECT bigUnitName AS largerUnit, unitNumber AS value, smallUnitName AS smallerUnit FROM mfProduct_unit_preference mfProduct_unit_preference WHERE mfProductId = '${mfProductId}' ORDER BY mfProduct_unit_preference.priorityNumber ASC;
                                         SELECT minMfProductUnit AS  minProductUnit FROM factory_manufactureProduct_data WHERE mfProductId = '${mfProductId}'`;
        pool.query(sql_queries_getNeedData, (err, result) => {
            if (err) {
                console.error("An error occurd in SQL Queery", err);
                return res.status(500).send('Database Error');
            }
            const needData = {
                unitsData: result && result[0] ? Object.values(JSON.parse(JSON.stringify(result[0]))) : null,
                toUnit: result && result[0] && result[0].minProductUnit ? result[1][0].minProductUnit : null,
            }
            const productFinalQty = (needData.unitsData && needData.unitsData.length !== 0) ? convertUnits(needData.unitsData, qty, unit, needData.toUnit) : qty;
            console.log(productFinalQty, 'jarrrr')
            const sql_query_fillRecipeeData = `-- RAW MATERIAL RECIPEE DATA
                                               SELECT
                                                   frd.rawMaterialId,
                                                   frmd.rawMaterialName,
                                                   ROUND((frd.rmValue * ${productFinalQty}),4) AS usedMaterial,
                                                   frd.rmUnit,
                                                   (SELECT COALESCE(SUM(sd.remainingQty),0) FROM factory_rmStockIn_data AS sd WHERE sd.rawMaterialId = frd.rawMaterialId AND sd.remainingQty != 0) AS remainQty
                                               FROM
                                                   factory_rawMaterialRecipee_data AS frd
                                               INNER JOIN factory_rawMaterial_data AS frmd ON frmd.rawMaterialId = frd.rawMaterialId
                                               WHERE frd.mfProductId = '${mfProductId}';
                                               -- OTHER SOURCE RECIPEE DATA
                                               SELECT
                                                   fosrd.otherSourceId,
                                                   fosd.otherSourceName,
                                                   ROUND((fosrd.osValue * ${productFinalQty}),4) AS usedSource,
                                                   fosrd.osUnit,
                                                   fosd.otherSourcePrice AS unitPrice,
                                                   ((fosrd.osValue * ${productFinalQty}) * fosd.otherSourcePrice) AS usedPrice
                                               FROM
                                                   factory_otherSourceRecipee_data AS fosrd
                                               INNER JOIN factory_otherSource_data AS fosd ON fosd.otherSourceId = fosrd.otherSourceId
                                               WHERE fosrd.mfProductId = '${mfProductId}';
                                               -- MANUFACTURE PRODUCT RECIPEE DATA
                                               SELECT
                                                   mfprd.produceProductId,
                                                   mfpd.mfProductName,
                                                   ROUND((mfprd.ppValue * ${productFinalQty}),4) AS usedValue,
                                                   mfprd.ppUnit,
                                                   (SELECT COALESCE(SUM(sd.remainingQty),0) FROM factory_mfProductStockIn_data AS sd WHERE sd.mfProductId = mfprd.produceProductId AND sd.remainingQty != 0) AS remainQty
                                               FROM
                                                   factory_mfProductRecipee_data AS mfprd
                                               INNER JOIN factory_manufactureProduct_data AS mfpd ON mfpd.mfProductId = mfprd.produceProductId
                                               WHERE mfprd.mfProductId = '${mfProductId}'`;
            pool.query(sql_query_fillRecipeeData, (err, recipee) => {
                if (err) {
                    console.error("An error occurd in SQL Queery", err);
                    return res.status(500).send('Database Error');
                }

                const datas = recipee[0];
                processDatas(datas)
                    .then(async (data) => {
                        // console.log('json 1', datas);
                        // console.log('json 2', data);
                        const newData = await datas ? datas.map((element, index) => ({ ...element, remainQty: data[index].xyz })
                        ) : []
                        const newDats = recipee[2];
                        processDatas1(newDats)
                            .then(async (mfdata) => {
                                console.log('json 1', newDats);
                                console.log('json 2', mfdata);
                                const mfnewData = await newDats ? newDats.map((element, index) => ({ ...element, remainQty: mfdata[index].xyz })
                                ) : []
                                const recipeeJson = {
                                    recipeMaterial: newData,
                                    otherExpense: recipee[1],
                                    produceProductdata: mfnewData
                                }
                                return res.status(200).send(recipeeJson);
                            }).catch(error => {
                                console.error('Error in processing datas:', error);
                                return //res.status(500).send('Internal Error');
                            });
                    }).catch(error => {
                        console.error('Error in processing datas:', error);
                        return //res.status(500).send('Internal Error');
                    });
            })
        })
    } catch (error) {
        console.error('An error occurd', error);
        res.status(500).send('Internal Server Error');
    }
}

// Fill Recipee By Id For Edit

const fillEditRecipeeDataById = (req, res) => {
    try {
        const mfProductId = req.query.mfProductId;
        const sql_query_fillRecipeeData = `-- RAW MATERIAL RECIPEE DATA
                                               SELECT
                                                   frd.rawMaterialId AS materialId,
                                                   frmd.rawMaterialName AS materialName,
                                                   frd.rmValue AS value,
                                                   frd.rmUnit AS unit
                                               FROM
                                                   factory_rawMaterialRecipee_data AS frd
                                               INNER JOIN factory_rawMaterial_data AS frmd ON frmd.rawMaterialId = frd.rawMaterialId
                                               WHERE frd.mfProductId = '${mfProductId}';
                                               -- OTHER SOURCE RECIPEE DATA
                                               SELECT
                                                   fosrd.otherSourceId AS otherSourceId,
                                                   fosd.otherSourceName AS expenseName,
                                                   fosrd.osValue AS value,
                                                   fosrd.osUnit AS unit
                                               FROM
                                                   factory_otherSourceRecipee_data AS fosrd
                                               INNER JOIN factory_otherSource_data AS fosd ON fosd.otherSourceId = fosrd.otherSourceId
                                               WHERE fosrd.mfProductId = '${mfProductId}';
                                               -- MANUFACTURE PRODUCT RECIPEE DATA
                                               SELECT
                                                   mfprd.produceProductId AS produceProductId,
                                                   mfpd.mfProductName AS mfProductName,
                                                   mfprd.ppValue AS value,
                                                   mfprd.ppUnit AS unit
                                               FROM
                                                   factory_mfProductRecipee_data AS mfprd
                                               INNER JOIN factory_manufactureProduct_data AS mfpd ON mfpd.mfProductId = mfprd.produceProductId
                                               WHERE mfprd.mfProductId = '${mfProductId}'`;
        pool.query(sql_query_fillRecipeeData, (err, recipee) => {
            if (err) {
                console.error("An error occurd in SQL Queery", err);
                return res.status(500).send('Database Error');
            }
            const recipeMateria = Object.values(JSON.parse(JSON.stringify(recipee[0])));
            const otherSourceData = Object.values(JSON.parse(JSON.stringify(recipee[1])));
            const mfProductData = Object.values(JSON.parse(JSON.stringify(recipee[2])));
            rmUnits(recipeMateria)
                .then((rmdata) => {
                    console.log('json 1', recipeMateria);
                    // console.log('json 2', rmdata);

                    const rms = recipeMateria ? recipeMateria.map((element, index) => ({
                        ...element,
                        materialUnits: rmdata[index],
                        materialObject: {
                            rawMaterialId: element.materialId,
                            rawMaterialName: element.materialName
                        }
                    })
                    ) : []

                    const oms = otherSourceData ? otherSourceData.map((element, index) => ({
                        ...element,
                        expenseObject: {
                            otherSourceId: element.otherSourceId,
                            otherSourceName: element.expenseName,
                            otherSourceUnit: element.unit
                        }
                    })
                    ) : []

                    mfUnits(mfProductData)
                        .then((mfdata) => {

                            const mfs = mfProductData ? mfProductData.map((element, index) => ({
                                ...element,
                                productUnits: mfdata[index],
                                productObject: {
                                    mfProductId: element.produceProductId,
                                    mfProductName: element.mfProductName
                                }
                            })
                            ) : []

                            const recipeeJson = {
                                recipeMaterial: rms,
                                otherExpense: oms,
                                produceProductda: mfs
                            }

                            return res.status(200).send(recipeeJson);
                        }).catch(error => {
                            console.error('Error in processing datas:', error);
                            return;
                        });
                }).catch(error => {
                    console.error('Error in processing datas:', error);
                    return;
                });
        })
    } catch (error) {
        console.error('An error occurd', error);
        res.status(500).send('Internal Server Error');
    }
}


module.exports = {
    addRecipeeData,
    removeRecipeeData,
    updateRecipeeData,
    fillRecipeeDataById,
    fillEditRecipeeDataById,
    processDatas,
    processDatas1
}