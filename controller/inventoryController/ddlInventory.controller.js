const { popGraphicsState } = require('pdf-lib');
const pool = require('../../database');
const jwt = require('jsonwebtoken');
const { processDatas } = require("../inventoryController/conversation.controller");

const ddlProduct = (req, res) => {
    try {
        let token;
        token = req.headers.authorization ? req.headers.authorization.split(" ")[1] : null;
        if (token) {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const branchId = decoded && decoded.id && decoded.id.branchId ? decoded.id.branchId : null;
            if (branchId) {
                const sql_querry_getddlProduct = `SELECT p.productId, UCASE(p.productName) AS productName, p.minProductUnit AS productUnit,
                                                COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) AS remainingStock
                                            FROM
                                                inventory_product_data AS p
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
                                            ORDER BY p.productName`;
                pool.query(sql_querry_getddlProduct, (err, result) => {
                    if (err) {
                        console.error("An error occurd in SQL Queery", err);
                        return res.status(500).send('Database Error');
                    }
                    const datas = Object.values(JSON.parse(JSON.stringify(result)));

                    processDatas(datas)
                        .then((data) => {
                            console.log('json 1', datas);
                            console.log('json 2', data);
                            const newData = datas ? datas.map((element, index) => data[index] && data[index].convertedQuantity ? { ...element, remainingStock: data[index].convertedQuantity, allConversation: data[index].vikJson } : { ...element, remainingStock: element.remainingStock + ' ' + element.productUnit, allConversation: data[index].vikJson },
                                // console.log(data[index] && data[index].convertedQuantity)
                            ) : []
                            console.log('new Json', newData);


                            return res.status(200).send(newData);
                        }).catch(error => {
                            console.error('Error in processing datas:', error);
                            return res.status(500).send('Internal Error');
                        });
                })
            } else {
                return res.status(401).send('BranchId Not Found');
            }
        } else {
            return res.status(401).send('Pleasr Login Firest.....!');
        }
    } catch (error) {
        console.error('An error occurd', error);
        res.status(500).send('Internal Server Error');
    }
}

// Product Wise Supplier DDL & Unit API

const productWiseSupplierDDL = (req, res) => {
    try {

        const productId = req.query.productId;
        sql_querry_getddlandUnit = `SELECT inventory_supplierProducts_data.supplierId, UPPER(inventory_supplier_data.supplierNickName) AS supplierNickName FROM inventory_supplierProducts_data
                                    INNER JOIN inventory_supplier_data ON inventory_supplier_data.supplierId = inventory_supplierProducts_data.supplierId
                                    WHERE productId = '${productId}'`;
        pool.query(sql_querry_getddlandUnit, (err, data) => {
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

// StockIn Category Dropdown API

const ddlStockInCategory = (req, res) => {
    try {
        const sql_querry_getddlCategory = `SELECT stockInCategoryId, UPPER(stockInCategoryName) AS stockInCategoryName FROM inventory_stockInCategory_data ORDER BY stockInCategoryName`;
        pool.query(sql_querry_getddlCategory, (err, data) => {
            if (err) {
                console.error("An error occurd in SQL Queery", err);
                return res.status(500).send('Database Error');
            }
            return res.status(200).send(data);
        })
    } catch (error) {
        console.error('An error occurd', error);
        res.status(500).send('Internal Server Error');
    }
}


// StockOut Category Dropdown API

const ddlStockOutCategory = (req, res) => {
    try {
        const sql_querry_getddlCategory = `SELECT stockOutCategoryId, UPPER(stockOutCategoryName) AS stockOutCategoryName FROM inventory_stockOutCategory_data ORDER BY stockOutCategoryName`;
        pool.query(sql_querry_getddlCategory, (err, data) => {
            if (err) {
                console.error("An error occurd in SQL Queery", err);
                return res.status(500).send('Database Error');
            }
            return res.status(200).send(data);
        })
    } catch (error) {
        console.error('An error occurd', error);
        res.status(500).send('Internal Server Error');
    }
}

// Get Units By ProductId

const ddlUnitById = (req, res) => {
    try {
        const productId = req.query.productId;
        if (!productId) {
            return res.status(404).send("ProductId Not Found");
        }
        sql_querry_getUnitById = `SELECT 0 AS priorityNum, minProductUnit AS unitName FROM inventory_product_data WHERE productId = '${productId}';
                                  SELECT priorityNumber AS priorityNum, bigUnitName AS unitName FROM product_unit_preference WHERE productId = '${productId}' ORDER BY priorityNum ASC`;
        pool.query(sql_querry_getUnitById, (err, data) => {
            if (err) {
                console.error("An error occurd in SQL Queery", err);
                return res.status(500).send('Database Error');
            }
            const combinedData = [].concat(...data);
            return res.status(200).send(combinedData);
        })
    } catch (error) {
        console.error('An error occurd', error);
        res.status(500).send('Internal Server Error');
    }
}

// Get DDl Branch

const ddlBranchList = (req, res) => {
    try {
        const supplierId = req.query.supplierId;
        if (!supplierId) {
            return res.status(404).send('Supplier Id Not Found');
        }
        sql_querry_getDetails = `SELECT 
                                    bd.branchId, bd.branchName, (COALESCE(SUM(isd.totalPrice),0) - (COALESCE(SUM(istd.paidAmount),0))) AS remainingPayment 
                                 FROM 
                                    branch_data AS bd
                                LEFT JOIN inventory_stockIn_data AS isd ON isd.branchId = bd.branchId AND isd.stockInPaymentMethod = 'debit' AND isd.supplierId = '${supplierId}'
                                LEFT JOIN inventory_supplierTransaction_data AS istd ON istd.branchId = bd.branchId AND istd.supplierId = '${supplierId}'
                                GROUP BY bd.branchId, bd.branchName
                                ORDER BY bd.branchName ASC;`;
        pool.query(sql_querry_getDetails, (err, data) => {
            if (err) {
                console.error("An error occurd in SQL Queery", err);
                return res.status(500).send('Database Error');
            }
            return res.status(200).send(data);
        })
    } catch (error) {
        console.error('An error occurd', error);
        res.status(500).send('Internal Server Error');
    }
}

// ddl All Product Data

const ddlAllProductData = (req, res) => {
    try {
        sql_querry_getDetails = `SELECT p.productId, UCASE(p.productName) AS productName FROM inventory_product_data AS p`;
        pool.query(sql_querry_getDetails, (err, data) => {
            if (err) {
                console.error("An error occurd in SQL Queery", err);
                return res.status(500).send('Database Error');
            }
            return res.status(200).send(data);
        })
    } catch (error) {
        console.error('An error occurd', error);
        res.status(500).send('Internal Server Error');
    }
}


module.exports = {
    ddlProduct,
    productWiseSupplierDDL,
    ddlStockInCategory,
    ddlStockOutCategory,
    ddlUnitById,
    ddlBranchList,
    ddlAllProductData
}