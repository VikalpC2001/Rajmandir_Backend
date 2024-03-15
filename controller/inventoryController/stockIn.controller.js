const pool = require('../../database');
const jwt = require("jsonwebtoken");
const excelJS = require("exceljs");
const { jsPDF } = require('jspdf');
require('jspdf-autotable');

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

// StockIn List API

const getStockInList = async (req, res) => {
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
                    productId: req.query.productId,
                    supplierId: req.query.supplierId,
                    payType: req.query.payType
                }
                if (req.query.supplierId && req.query.payType && req.query.startDate && req.query.endDate) {
                    sql_querry_getCountdetails = `SELECT count(*) as numRows FROM inventory_stockIn_data WHERE inventory_stockIn_data.branchId = '${branchId}' AND inventory_stockIn_data.supplierId = '${data.supplierId}' AND inventory_stockIn_data.stockInPaymentMethod = '${data.payType}' AND inventory_stockIn_data.stockInDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')`;
                } else if (req.query.supplierId && req.query.startDate && req.query.endDate) {
                    sql_querry_getCountdetails = `SELECT count(*) as numRows FROM inventory_stockIn_data WHERE inventory_stockIn_data.branchId = '${branchId}' AND inventory_stockIn_data.supplierId = '${data.supplierId}' AND inventory_stockIn_data.stockInDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')`;
                } else if (req.query.productId && req.query.startDate && req.query.endDate) {
                    sql_querry_getCountdetails = `SELECT count(*) as numRows FROM inventory_stockIn_data WHERE inventory_stockIn_data.branchId = '${branchId}' AND inventory_stockIn_data.productId = '${data.productId}' AND inventory_stockIn_data.stockInDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')`;
                } else if (req.query.startDate && req.query.endDate) {
                    sql_querry_getCountdetails = `SELECT count(*) as numRows FROM inventory_stockIn_data WHERE inventory_stockIn_data.branchId = '${branchId}' AND inventory_stockIn_data.stockInDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')`;
                } else if (req.query.supplierId && req.query.payType) {
                    sql_querry_getCountdetails = `SELECT count(*) as numRows FROM inventory_stockIn_data WHERE inventory_stockIn_data.branchId = '${branchId}' AND inventory_stockIn_data.supplierId = '${data.supplierId}' AND inventory_stockIn_data.stockInPaymentMethod = '${data.payType}'`;
                } else if (req.query.productId) {
                    sql_querry_getCountdetails = `SELECT count(*) as numRows FROM inventory_stockIn_data WHERE inventory_stockIn_data.branchId = '${branchId}' AND inventory_stockIn_data.productId = '${data.productId}'`;
                } else if (req.query.supplierId) {
                    sql_querry_getCountdetails = `SELECT count(*) as numRows FROM inventory_stockIn_data WHERE inventory_stockIn_data.branchId = '${branchId}' AND inventory_stockIn_data.supplierId = '${data.supplierId}'`;
                } else {
                    sql_querry_getCountdetails = `SELECT count(*) as numRows FROM inventory_stockIn_data WHERE inventory_stockIn_data.branchId = '${branchId}'`;
                }
                pool.query(sql_querry_getCountdetails, (err, rows, fields) => {
                    if (err) {
                        console.error("An error occurd in SQL Queery", err);
                        return res.status(500).send('Database Error');
                    } else {
                        const numRows = rows[0].numRows;
                        const numPages = Math.ceil(numRows / numPerPage);
                        const commanQuarry = `SELECT
                                          stockInId,
                                          user_details.userName AS enteredBy,
                                          CONCAT(
                                              user_details.userFirstName,
                                              ' ',
                                              user_details.userLastName
                                          ) AS userName,
                                          UPPER(inventory_product_data.productName) AS productName,
                                          CONCAT(stockInDisplayQty,' ',stockInDisplayUnit) AS Quantity,
                                          ROUND(productPrice,2) AS productPrice,
                                          totalPrice,
                                          billNumber,
                                          inventory_supplier_data.supplierNickName AS supplier,
                                          stockInPaymentMethod,
                                          stockInComment,
                                          productQty,
                                          remainingQty,
                                          CONCAT(DATE_FORMAT(stockInDate, '%d-%m-%Y'),' ',DATE_FORMAT(stockInCreationDate, '%h:%i %p')) AS stockInDate
                                      FROM
                                          inventory_stockIn_data
                                      INNER JOIN user_details ON user_details.userId = inventory_stockIn_data.userId
                                      INNER JOIN inventory_product_data ON inventory_product_data.productId = inventory_stockIn_data.productId
                                      INNER JOIN inventory_supplier_data ON inventory_supplier_data.supplierId = inventory_stockIn_data.supplierId`;
                        if (req.query.supplierId && req.query.payType && req.query.startDate && req.query.endDate) {
                            sql_queries_getdetails = `${commanQuarry}
                                                WHERE inventory_stockIn_data.branchId = '${branchId}' AND inventory_stockIn_data.supplierId = '${data.supplierId}' AND inventory_stockIn_data.stockInPaymentMethod = '${data.payType}' AND inventory_stockIn_data.stockInDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')
                                                ORDER BY inventory_stockIn_data.stockInDate DESC, inventory_stockIn_data.stockInCreationDate DESC LIMIT ${limit}`;
                        } else if (req.query.supplierId && req.query.startDate && req.query.endDate) {
                            sql_queries_getdetails = `${commanQuarry}
                                                WHERE inventory_stockIn_data.branchId = '${branchId}' AND inventory_stockIn_data.supplierId = '${data.supplierId}' AND inventory_stockIn_data.stockInDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')
                                                ORDER BY inventory_stockIn_data.stockInDate DESC, inventory_stockIn_data.stockInCreationDate DESC LIMIT ${limit}`;
                        } else if (req.query.productId && req.query.startDate && req.query.endDate) {
                            sql_queries_getdetails = `${commanQuarry}
                                                WHERE inventory_stockIn_data.branchId = '${branchId}' AND inventory_stockIn_data.productId = '${data.productId}' AND inventory_stockIn_data.stockInDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')
                                                ORDER BY inventory_stockIn_data.stockInDate DESC, inventory_stockIn_data.stockInCreationDate DESC LIMIT ${limit}`;
                        } else if (req.query.startDate && req.query.endDate) {
                            sql_queries_getdetails = `${commanQuarry}
                                                WHERE inventory_stockIn_data.branchId = '${branchId}' AND inventory_stockIn_data.stockInDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y') 
                                                ORDER BY inventory_stockIn_data.stockInDate DESC, inventory_stockIn_data.stockInCreationDate DESC LIMIT ${limit}`;
                        } else if (req.query.supplierId && req.query.payType) {
                            sql_queries_getdetails = `${commanQuarry}
                                                WHERE inventory_stockIn_data.branchId = '${branchId}' AND inventory_stockIn_data.supplierId = '${data.supplierId}' AND inventory_stockIn_data.stockInPaymentMethod = '${data.payType}'
                                                ORDER BY inventory_stockIn_data.stockInDate DESC, inventory_stockIn_data.stockInCreationDate DESC LIMIT ${limit}`;
                        } else if (req.query.productId) {
                            sql_queries_getdetails = `${commanQuarry}
                                                WHERE inventory_stockIn_data.branchId = '${branchId}' AND inventory_stockIn_data.productId = '${data.productId}'
                                                ORDER BY inventory_stockIn_data.stockInDate DESC, inventory_stockIn_data.stockInCreationDate DESC LIMIT ${limit}`;
                        } else if (req.query.supplierId) {
                            sql_queries_getdetails = `${commanQuarry}
                                                WHERE inventory_stockIn_data.branchId = '${branchId}' AND inventory_stockIn_data.supplierId = '${data.supplierId}'
                                                ORDER BY inventory_stockIn_data.stockInDate DESC, inventory_stockIn_data.stockInCreationDate DESC LIMIT ${limit}`;
                        } else {
                            sql_queries_getdetails = `${commanQuarry}
                                                WHERE inventory_stockIn_data.branchId = '${branchId}'
                                                ORDER BY inventory_stockIn_data.stockInDate DESC, inventory_stockIn_data.stockInCreationDate DESC LIMIT ${limit}`;
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

// StockIn Add API

const addStockInDetails = async (req, res) => {
    try {
        let token;
        token = req.headers ? req.headers.authorization.split(" ")[1] : null;
        if (token) {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const userId = decoded.id.id;
            const branchId = decoded.id.branchId;
            const uid1 = new Date();
            const stockInId = String("stockIn_" + uid1.getTime());
            const factoryId = process.env.RAJ_MANDIR_FACTORY_ID;
            const data = {
                productId: req.body.productId,
                productQty: req.body.productQty,
                productUnit: req.body.productUnit.trim(),
                totalPrice: Number(req.body.totalPrice).toFixed(2),
                billNumber: req.body.billNumber ? req.body.billNumber.trim() : null,
                supplierId: req.body.supplierId,
                stockInPaymentMethod: req.body.stockInPaymentMethod,
                stockInComment: req.body.stockInComment ? req.body.stockInComment.trim() : null,
                stockInDate: new Date(req.body.stockInDate ? req.body.stockInDate : null).toString().slice(4, 15)
            }
            if (!data.productId || !data.productQty || !data.productUnit || !data.totalPrice || !data.supplierId || !data.stockInPaymentMethod || !data.stockInDate) {
                return res.status(400).send("Please Fill all the feilds");
            } else if (data.supplierId == factoryId) {
                return res.status(404).send("You Can Not Add Stock-In Factory Product");
            } else {
                const sql_queries_getNeedData = `SELECT bigUnitName AS largerUnit, unitNumber AS value, smallUnitName AS smallerUnit FROM product_unit_preference WHERE productId = '${data.productId}' ORDER BY product_unit_preference.priorityNumber ASC;
                                                 SELECT ipd.minProductUnit AS  minProductUnit, ipd.isExpired AS isExpired, ipd.expiredDays AS expiredDays FROM inventory_product_data AS ipd WHERE ipd.productId = '${data.productId}'`;
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
                    const productFinalQty = (needData.unitsData && needData.unitsData.length !== 0) ? convertUnits(needData.unitsData, data.productQty, data.productUnit, needData.toUnit) : data.productQty;
                    const productPrice = data.totalPrice / productFinalQty
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
                                                                                VALUES ('${stockInId}', 
                                                                                        '${branchId}',
                                                                                        '${userId}', 
                                                                                        '${data.productId}', 
                                                                                         ${productFinalQty}, 
                                                                                         ${productPrice}, 
                                                                                         ${data.totalPrice}, 
                                                                                         ${data.billNumber ? `'${data.billNumber}'` : null}, 
                                                                                         ${data.productQty},
                                                                                        '${data.productUnit}', 
                                                                                        '${data.supplierId}', 
                                                                                        '${data.stockInPaymentMethod}',
                                                                                         ${data.stockInComment ? `'${data.stockInComment}'` : null}, 
                                                                                         ${needData && needData.isExpired && needData.expiredDays > 0 ? `DATE_ADD(STR_TO_DATE('${data.stockInDate}','%b %d %Y'), INTERVAL ${needData.expiredDays} DAY)` : null},
                                                                                         ${productFinalQty}, 
                                                                                         STR_TO_DATE('${data.stockInDate}','%b %d %Y'))`;
                    pool.query(sql_querry_addStockIn, (err, data) => {
                        if (err) {
                            console.error("An error occurd in SQL Queery", err);
                            return res.status(500).send('Database Error');
                        }
                        return res.status(200).send("Data Added Successfully");
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

// Remove StockIn API

const removeStockInTransaction = async (req, res) => {
    try {
        const stockInId = req.query.stockInId
        const factoryId = process.env.RAJ_MANDIR_FACTORY_ID;
        req.query.stockInId = pool.query(`SELECT stockInId, supplierId FROM inventory_stockIn_data WHERE stockInId = '${stockInId}'`, (err, row) => {
            if (err) {
                console.error("An error occurd in SQL Queery", err);
                return res.status(500).send('Database Error');
            }
            if (row && row.length) {
                const supplierId = row && row[0].supplierId ? row[0].supplierId : null;
                if (factoryId == supplierId) {
                    return res.status(400).send('You Can Not Delete Factory Stock-In');
                } else {
                    const sql_querry_removedetails = `DELETE FROM inventory_stockIn_data WHERE stockInId = '${stockInId}'`;
                    pool.query(sql_querry_removedetails, (err, data) => {
                        if (err) {
                            console.error("An error occurd in SQL Queery", err);
                            return res.status(500).send('Database Error');
                        }
                        return res.status(200).send("Transaction Deleted Successfully");
                    })
                }
            } else {
                return res.status(400).send('Transaction Not Found');
            }
        })
    } catch (error) {
        console.error('An error occurd', error);
        res.status(500).send('Internal Server Error');
    }
}

// Fill StockIn Transaction API

const fillStockInTransaction = (req, res) => {
    try {
        const stockInId = req.query.stockInId
        sql_querry_fillUser = `SELECT inventory_stockIn_data.productId, inventory_product_data.productName, stockInDisplayQty AS productQty, stockInDisplayUnit AS productUnit, productPrice, totalPrice, billNumber, supplierId, stockInPaymentMethod, stockInComment, stockInDate FROM inventory_stockIn_data
                                INNER JOIN inventory_product_data ON inventory_product_data.productId = inventory_stockIn_data.productId 
                                WHERE stockInId = '${stockInId}'`;
        pool.query(sql_querry_fillUser, (err, data) => {
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

// Update User API

const updateStockInTransaction = async (req, res) => {
    try {
        let token;
        token = req.headers ? req.headers.authorization.split(" ")[1] : null;
        if (token) {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const userId = decoded.id.id;
            const branchId = decoded.id.branchId;
            const stockInId = req.body.stockInId;
            const factoryId = process.env.RAJ_MANDIR_FACTORY_ID;
            const data = {
                productId: req.body.productId,
                productQty: req.body.productQty,
                productUnit: req.body.productUnit.trim(),
                totalPrice: req.body.totalPrice,
                billNumber: req.body.billNumber ? req.body.billNumber.trim() : null,
                supplierId: req.body.supplierId,
                stockInPaymentMethod: req.body.stockInPaymentMethod,
                stockInComment: req.body.stockInComment ? req.body.stockInComment.trim() : null,
                stockInDate: new Date(req.body.stockInDate ? req.body.stockInDate : null).toString().slice(4, 15)
            }
            if (!data.productId || !data.productQty || !data.productUnit || !data.totalPrice || !data.supplierId || !data.stockInPaymentMethod || !data.stockInDate) {
                return res.status(400).send("Please Fill all the feilds");
            }
            req.body.productId = pool.query(`SELECT productId FROM inventory_supplierProducts_data WHERE supplierId = '${factoryId}' AND productId = '${data.productId}'`, (err, row) => {
                if (err) {
                    console.error("An error occurd in SQL Queery", err);
                    return res.status(500).send('Database Error');
                }
                if (row && row.length) {
                    return res.status(400).send('You Can Not Edit Factory Supplied Data');
                } else {
                    const sql_queries_getNeedData = `SELECT bigUnitName AS largerUnit, unitNumber AS value, smallUnitName AS smallerUnit FROM product_unit_preference WHERE productId = '${data.productId}' ORDER BY product_unit_preference.priorityNumber ASC;
                                                     SELECT ipd.minProductUnit AS  minProductUnit, ipd.isExpired AS isExpired, ipd.expiredDays AS expiredDays FROM inventory_product_data AS ipd WHERE ipd.productId = '${data.productId}'`;
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

                        const productFinalQty = (needData.unitsData && needData.unitsData.length !== 0) ? convertUnits(needData.unitsData, data.productQty, data.productUnit, needData.toUnit) : data.productQty;
                        const productPrice = data.totalPrice / productFinalQty
                        const sql_querry_updatedetails = `UPDATE inventory_stockIn_data SET 
                                                                                branchId = '${branchId}',
                                                                                userId = '${userId}',
                                                                                productId = '${data.productId}',
                                                                                productQty = ${productFinalQty},
                                                                                productPrice = ${productPrice},
                                                                                totalPrice = ${data.totalPrice},
                                                                                billNumber = ${data.billNumber ? `'${data.billNumber}'` : null},
                                                                                stockInDisplayQty = ${data.productQty},
                                                                                stockInDisplayUnit = '${data.productUnit}',
                                                                                supplierId = '${data.supplierId}',
                                                                                stockInPaymentMethod = '${data.stockInPaymentMethod}',
                                                                                stockInComment = ${data.stockInComment ? `'${data.stockInComment}'` : null},
                                                                                productExpiryDate = ${needData && needData.isExpired && needData.expiredDays > 0 ? `DATE_ADD(STR_TO_DATE('${data.stockInDate}','%b %d %Y'), INTERVAL ${needData.expiredDays} DAY)` : null},
                                                                                remainingQty = ${productFinalQty},
                                                                                stockInDate = STR_TO_DATE('${data.stockInDate}','%b %d %Y') 
                                                                          WHERE stockInId = '${stockInId}'`;
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
        } else {
            res.status(401);
            res.send("Please Login Firest.....!");
        }
    } catch (error) {
        console.error('An error occurd', error);
        res.status(500).json('Internal Server Error');
    }
}

// Export Excel for StockIn

const exportExcelSheetForStockin = (req, res) => {
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
                productId: req.query.productId,
                supplierId: req.query.supplierId,
                payType: req.query.payType
            }
            const commanQuarry = `SELECT
                                          stockInId,
                                          user_details.userName AS enteredBy,
                                          CONCAT(
                                              user_details.userFirstName,
                                              ' ',
                                              user_details.userLastName
                                          ) AS userName,
                                          UPPER(inventory_product_data.productName) AS productName,
                                          stockInDisplayQty AS productQty, 
                                          stockInDisplayUnit AS productUnit,
                                          productPrice,
                                          totalPrice,
                                          billNumber,
                                          inventory_supplier_data.supplierNickName AS supplier,
                                          stockInPaymentMethod,
                                          stockInComment,
                                          productQty,
                                          remainingQty,
                                          CONCAT(DATE_FORMAT(stockInDate, '%d-%m-%Y'),' ',DATE_FORMAT(stockInCreationDate, '%h:%i %p')) AS stockInDate
                                      FROM
                                          inventory_stockIn_data
                                      INNER JOIN user_details ON user_details.userId = inventory_stockIn_data.userId
                                      INNER JOIN inventory_product_data ON inventory_product_data.productId = inventory_stockIn_data.productId
                                      INNER JOIN inventory_supplier_data ON inventory_supplier_data.supplierId = inventory_stockIn_data.supplierId`;
            if (req.query.supplierId && req.query.payType && req.query.startDate && req.query.endDate) {
                sql_queries_getdetails = `${commanQuarry}
                                                WHERE inventory_stockIn_data.branchId = '${branchId}' AND inventory_stockIn_data.supplierId = '${data.supplierId}' AND inventory_stockIn_data.stockInPaymentMethod = '${data.payType}' AND inventory_stockIn_data.stockInDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')
                                                ORDER BY inventory_stockIn_data.stockInDate DESC, inventory_stockIn_data.stockInCreationDate DESC`;
            } else if (req.query.supplierId && req.query.startDate && req.query.endDate) {
                sql_queries_getdetails = `${commanQuarry}
                                                WHERE inventory_stockIn_data.branchId = '${branchId}' AND inventory_stockIn_data.supplierId = '${data.supplierId}' AND inventory_stockIn_data.stockInDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')
                                                ORDER BY inventory_stockIn_data.stockInDate DESC, inventory_stockIn_data.stockInCreationDate DESC`;
            } else if (req.query.productId && req.query.startDate && req.query.endDate) {
                sql_queries_getdetails = `${commanQuarry}
                                                WHERE inventory_stockIn_data.branchId = '${branchId}' AND inventory_stockIn_data.productId = '${data.productId}' AND inventory_stockIn_data.stockInDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')
                                                ORDER BY inventory_stockIn_data.stockInDate DESC, inventory_stockIn_data.stockInCreationDate DESC`;
            } else if (req.query.startDate && req.query.endDate) {
                sql_queries_getdetails = `${commanQuarry}
                                                WHERE inventory_stockIn_data.branchId = '${branchId}' AND inventory_stockIn_data.stockInDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y') 
                                                ORDER BY inventory_stockIn_data.stockInDate DESC, inventory_stockIn_data.stockInCreationDate DESC`;
            } else if (req.query.supplierId && req.query.payType) {
                sql_queries_getdetails = `${commanQuarry}
                                                WHERE inventory_stockIn_data.branchId = '${branchId}' AND inventory_stockIn_data.supplierId = '${data.supplierId}' AND inventory_stockIn_data.stockInPaymentMethod = '${data.payType}'
                                                ORDER BY inventory_stockIn_data.stockInDate DESC, inventory_stockIn_data.stockInCreationDate DESC`;
            } else if (req.query.productId) {
                sql_queries_getdetails = `${commanQuarry}
                                                WHERE inventory_stockIn_data.branchId = '${branchId}' AND inventory_stockIn_data.productId = '${data.productId}'
                                                ORDER BY inventory_stockIn_data.stockInDate DESC, inventory_stockIn_data.stockInCreationDate DESC`;
            } else if (req.query.supplierId) {
                sql_queries_getdetails = `${commanQuarry}
                                                WHERE inventory_stockIn_data.branchId = '${branchId}' AND inventory_stockIn_data.supplierId = '${data.supplierId}'
                                                ORDER BY inventory_stockIn_data.stockInDate DESC, inventory_stockIn_data.stockInCreationDate DESC`;
            } else {
                sql_queries_getdetails = `${commanQuarry}
                                                WHERE inventory_stockIn_data.branchId = '${branchId}'
                                                ORDER BY inventory_stockIn_data.stockInDate DESC, inventory_stockIn_data.stockInCreationDate DESC`;
            }
            console.log('find me', sql_queries_getdetails)
            pool.query(sql_queries_getdetails, async (err, rows) => {
                if (err) return res.status(404).send(err);
                console.log(":::", rows)
                const workbook = new excelJS.Workbook();  // Create a new workbook
                const worksheet = workbook.addWorksheet("StockIn List"); // New Worksheet

                if (req.query.startDate && req.query.endDate) {
                    worksheet.mergeCells('A1', 'L1');
                    worksheet.getCell('A1').value = `Stock In From ${data.startDate} To ${data.endDate}`;
                } else {
                    worksheet.mergeCells('A1', 'L1');
                    worksheet.getCell('A1').value = `Stock In From ${firstDay} To ${lastDay}`;
                }

                /*Column headers*/
                worksheet.getRow(2).values = ['S no.', 'Entered By', 'Product', 'Quantity', 'Unit', 'Price', 'Total', 'Bill Number', 'Supplier', 'Pay Type', 'Comment', 'Date'];

                // Column for data in excel. key must match data key
                worksheet.columns = [
                    { key: "s_no", width: 10, },
                    { key: "enteredBy", width: 20 },
                    { key: "productName", width: 30 },
                    { key: "productQty", width: 10 },
                    { key: "productUnit", width: 10 },
                    { key: "productPrice", width: 10 },
                    { key: "totalPrice", width: 10 },
                    { key: "billNumber", width: 30 },
                    { key: "supplier", width: 20 },
                    { key: "stockInPaymentMethod", width: 10 },
                    { key: "stockInComment", width: 30 },
                    { key: "stockInDate", width: 10 }
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
                if (req.query.productId || req.query.productId && req.query.startDate && req.query.endDate) {
                    worksheet.getRow(arr.length + 3).values = ['Total:', '', '', { formula: `SUM(D3:D${arr.length + 2})` }, '', '', { formula: `SUM(G3:G${arr.length + 2})` }];
                } else {
                    worksheet.getRow(arr.length + 3).values = ['Total:', '', '', '', '', '', { formula: `SUM(G3:G${arr.length + 2})` }];
                }
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

const exportPdfForStockIn = (req, res) => {
    try {
        let token;
        token = req.headers.authorization ? req.headers.authorization.split(" ")[1] : null;
        if (token) {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const branchId = decoded && decoded.id && decoded.id.branchId ? decoded.id.branchId : null;
            if (branchId) {
                const data = {
                    startDate: (req.query.startDate ? req.query.startDate : '').slice(4, 15),
                    endDate: (req.query.endDate ? req.query.endDate : '').slice(4, 15),
                    productId: req.query.productId,
                    supplierId: req.query.supplierId,
                    payType: req.query.payType
                }
                const commanQuarry = `SELECT
                                          CONCAT(
                                              user_details.userFirstName,
                                              ' ',
                                              user_details.userLastName
                                          ) AS "Enter By",
                                          UPPER(inventory_product_data.productName) AS "Product",
                                          CONCAT(stockInDisplayQty,' ',stockInDisplayUnit) AS "Qty",
                                          ROUND(productPrice,2) AS "Price",
                                          totalPrice AS "Total",
                                          billNumber AS "Bill No.",
                                          inventory_supplier_data.supplierNickName AS "Supplier",
                                          stockInPaymentMethod AS "Pay Type",
                                          stockInComment AS "Comment",
                                          CONCAT(DATE_FORMAT(stockInDate, '%d-%m-%Y'),' ',DATE_FORMAT(stockInCreationDate, '%h:%i %p')) AS "Date"
                                      FROM
                                          inventory_stockIn_data
                                      INNER JOIN user_details ON user_details.userId = inventory_stockIn_data.userId
                                      INNER JOIN inventory_product_data ON inventory_product_data.productId = inventory_stockIn_data.productId
                                      INNER JOIN inventory_supplier_data ON inventory_supplier_data.supplierId = inventory_stockIn_data.supplierId`;
                if (req.query.supplierId && req.query.payType && req.query.startDate && req.query.endDate) {
                    sql_queries_getdetails = `${commanQuarry}
                                                WHERE inventory_stockIn_data.branchId = '${branchId}' AND inventory_stockIn_data.supplierId = '${data.supplierId}' AND inventory_stockIn_data.stockInPaymentMethod = '${data.payType}' AND inventory_stockIn_data.stockInDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')
                                                ORDER BY inventory_stockIn_data.stockInDate DESC, inventory_stockIn_data.stockInCreationDate DESC`;
                } else if (req.query.supplierId && req.query.startDate && req.query.endDate) {
                    sql_queries_getdetails = `${commanQuarry}
                                                WHERE inventory_stockIn_data.branchId = '${branchId}' AND inventory_stockIn_data.supplierId = '${data.supplierId}' AND inventory_stockIn_data.stockInDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')
                                                ORDER BY inventory_stockIn_data.stockInDate DESC, inventory_stockIn_data.stockInCreationDate DESC`;
                } else if (req.query.productId && req.query.startDate && req.query.endDate) {
                    sql_queries_getdetails = `${commanQuarry}
                                                WHERE inventory_stockIn_data.branchId = '${branchId}' AND inventory_stockIn_data.productId = '${data.productId}' AND inventory_stockIn_data.stockInDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')
                                                ORDER BY inventory_stockIn_data.stockInDate DESC, inventory_stockIn_data.stockInCreationDate DESC`;
                } else if (req.query.startDate && req.query.endDate) {
                    sql_queries_getdetails = `${commanQuarry}
                                                WHERE inventory_stockIn_data.branchId = '${branchId}' AND inventory_stockIn_data.stockInDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y') 
                                                ORDER BY inventory_stockIn_data.stockInDate DESC, inventory_stockIn_data.stockInCreationDate DESC`;
                } else if (req.query.supplierId && req.query.payType) {
                    sql_queries_getdetails = `${commanQuarry}
                                                WHERE inventory_stockIn_data.branchId = '${branchId}' AND inventory_stockIn_data.supplierId = '${data.supplierId}' AND inventory_stockIn_data.stockInPaymentMethod = '${data.payType}'
                                                ORDER BY inventory_stockIn_data.stockInDate DESC, inventory_stockIn_data.stockInCreationDate DESC`;
                } else if (req.query.productId) {
                    sql_queries_getdetails = `${commanQuarry}
                                                WHERE inventory_stockIn_data.branchId = '${branchId}' AND inventory_stockIn_data.productId = '${data.productId}'
                                                ORDER BY inventory_stockIn_data.stockInDate DESC, inventory_stockIn_data.stockInCreationDate DESC`;
                } else if (req.query.supplierId) {
                    sql_queries_getdetails = `${commanQuarry}
                                                WHERE inventory_stockIn_data.branchId = '${branchId}' AND inventory_stockIn_data.supplierId = '${data.supplierId}'
                                                ORDER BY inventory_stockIn_data.stockInDate DESC, inventory_stockIn_data.stockInCreationDate DESC`;
                } else {
                    sql_queries_getdetails = `${commanQuarry}
                                                WHERE inventory_stockIn_data.branchId = '${branchId}'
                                                ORDER BY inventory_stockIn_data.stockInDate DESC, inventory_stockIn_data.stockInCreationDate DESC`;
                }
                pool.query(sql_queries_getdetails, (err, rows) => {
                    if (err) {
                        console.error("An error occurd in SQL Queery", err);
                        return res.status(500).send('Database Error');
                    } else if (rows && rows.length <= 0) {
                        return res.status(400).send('No Data Found');
                    }
                    const abc = Object.values(JSON.parse(JSON.stringify(rows)));
                    const sumPayAmount = abc.reduce((total, item) => total + (item['Total'] || 0), 0);;
                    const sumFooterArray = ['Total', '', '', '', '', parseFloat(sumPayAmount).toLocaleString('en-IN')];
                    if (req.query.startMonth && req.query.endMonth) {
                        const startMonthName = formatMonthYear(startMonth);
                        console.log(startMonthName);
                        const endMonthName = formatMonthYear(endMonth);
                        console.log(endMonthName);
                        tableHeading = `StockIn Data From ${startMonthName} To ${endMonthName}`;
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
    addStockInDetails,
    getStockInList,
    removeStockInTransaction,
    updateStockInTransaction,
    fillStockInTransaction,
    exportExcelSheetForStockin,
    exportPdfForStockIn
}