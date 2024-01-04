const { setFontAndSize } = require('pdf-lib');
const pool = require('../../database');
const jwt = require("jsonwebtoken");


const addStockOutDetails = (data) => {
    return new Promise((resolve, reject) => {
        try {
            const uid1 = new Date();
            const stockOutId = String("stockOut_" + uid1.getTime());
            console.log("...", stockOutId);
            // Destructure the passed object
            const { productId, productQty, productUnit, stockOutCategory, stockOutComment, branchId, userId, stockOutDate } = data;
            console.log(productId, data);
            // Add the logic from your original function here
            if (!productId || !productQty || !productUnit || !stockOutCategory) {
                console.error("Please Fill All The Fields");
                reject('Please Fill All The Fields');
            }
            else {
                const productFinalQty = productQty;
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
                        console.error("An error occurred in SQL Query", err);
                        reject('Database Error');
                    }
                    const remainStock = data[0].remainingStock
                    console.log("./././", remainStock);
                    if (remainStock < productFinalQty) {
                        throw new Error(`Remaining Stock is ${remainStock} ${productUnit}. You Can Not Able To Out Stock`);
                    } else {
                        sql_querry_getStockIndetail = `SELECT stockInId, productId, productQty, productPrice AS stockInPrice, remainingQty AS stockInQuantity FROM inventory_stockIn_data WHERE inventory_stockIn_data.productId = '${productId}' AND inventory_stockIn_data.branchId = '${branchId}' AND inventory_stockIn_data.remainingQty != 0 ORDER BY stockInDate ASC`;
                        pool.query(sql_querry_getStockIndetail, (err, data) => {
                            if (err) {
                                console.error("An error occurred in SQL Query", err);
                                reject('Database Error');
                            }
                            const orignalStockInData = Object.values(JSON.parse(JSON.stringify(data)));
                            const stockInData = Object.values(JSON.parse(JSON.stringify(data)));
                            // console.log(">>>", Object.values(JSON.parse(JSON.stringify(data))));
                            const stockOutData = [
                                { productId: productId, stockOutQuantity: productFinalQty }
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
                                    console.error("An error occurred in SQL Query", err);
                                    reject('Database Error');
                                }
                                const sql_querry_addStockOut = `INSERT INTO inventory_stockOut_data (stockOutId, branchId, userId, productId, productQty, stockOutPrice, stockOutDisplayQty, stockOutDisplayUnit, stockOutCategory, stockOutComment, stockOutDate)
                                                                VALUES ('${stockOutId}', '${branchId}', '${userId}', '${productId}', ${productFinalQty}, ${stocokOutPrice}, ${productQty}, '${productUnit}', '${stockOutCategory}', NULLIF('${stockOutComment}','null'), STR_TO_DATE('${stockOutDate}','%b %d %Y'))`;
                                pool.query(sql_querry_addStockOut, (err, data) => {
                                    if (err) {
                                        console.error("An error occurred in SQL Query", err);
                                        reject('Database Error');
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
            }
        } catch (error) {
            console.error('An error occurred', error);
            reject('Internal Server Error');
        }
    })
}


const addAutoStoctOutDetails = (req, res) => {
    try {
        let token;
        token = req.headers.authorization ? req.headers.authorization.split(" ")[1] : null;
        if (token) {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const branchId = decoded && decoded.id && decoded.id.branchId ? decoded.id.branchId : null;
            if (branchId) {
                const autoStockOutCategoryId = process.env.AUTO_STOCKOUT_ID;
                const sql_query_getExpiredProductData = `SELECT
                                                             isd.productId AS productId,
                                                             isd.remainingQty AS productQty,
                                                             ipd.minProductUnit AS productUnit,
                                                             '${autoStockOutCategoryId}' AS stockOutCategory,
                                                             'AUTO STOCK OUT' AS stockOutComment,
                                                             isd.branchId AS branchId,
                                                             isd.userId AS userId,
                                                             DATE_FORMAT(isd.productExpiryDate,'%b %d %Y') AS stockOutDate
                                                         FROM
                                                             inventory_stockIn_data AS isd
                                                         INNER JOIN inventory_product_data AS ipd ON ipd.productId = isd.productId
                                                         WHERE isd.productExpiryDate <= CURDATE() AND isd.remainingQty != 0 AND ipd.isExpired = true AND isd.branchId = '${branchId}'`;
                pool.query(sql_query_getExpiredProductData, (err, result) => {
                    if (err) {
                        console.error("An error occurd in SQL Queery", err);
                        return res.status(500).send('Database Error');
                    }
                    const stockOutData = Object.values(JSON.parse(JSON.stringify(result)));
                    if (stockOutData.length != 0) {
                        // Call the function and handle the returned promise
                        Promise.all(
                            stockOutData.map(e => addStockOutDetails(e))
                        ).then(response => {
                            console.log(response); // Process the success response
                            return res.status(200).send('AUto Out Succeess');
                        }).catch(error => {
                            console.error(error); // Handle any errors
                            return res.status(500).send('Error');
                        });
                    } else {
                        return res.status(200).send('No Stock Expire');
                    }
                })
            } else {
                return res.status(401).send('BranchId Not Found');
            }
        } else {
            return res.status(401).send('Pleasr Login Firest.....!');
        }
    } catch (error) {
        console.error('An error occurred', error);
        return res.status(500), send('Internal Server Error');
    }
}

module.exports = {
    addAutoStoctOutDetails
}

