const pool = require('../../../database');
const jwt = require('jsonwebtoken');
const { processDatas } = require("./rmConversation.controller");

const ddlRawMaterial = (req, res) => {
    try {
        let token;
        token = req.headers.authorization ? req.headers.authorization.split(" ")[1] : null;
        if (token) {
            const sql_querry_getddlProduct = `SELECT p.rawMaterialId, UCASE(p.rawMaterialName) AS rawMaterialName, p.minRawMaterialUnit AS minRawMaterialUnit, p.isSupplyBranch, 
                                                COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) AS remainingStock
                                            FROM
                                                factory_rawMaterial_data AS p
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
                                            ORDER BY p.rawMaterialName`;
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
            return res.status(401).send('Pleasr Login Firest.....!');
        }
    } catch (error) {
        console.error('An error occurd', error);
        res.status(500).send('Internal Server Error');
    }
}

// Raw Material Wise Supplier DDL & Unit API

const rawMaterialWiseSupplierDDL = (req, res) => {
    try {

        const rawMaterialId = req.query.rawMaterialId;
        sql_querry_getddlandUnit = `SELECT factory_supplierProducts_data.rmSupplierId, UPPER(factory_supplier_data.supplierNickName) AS supplierNickName FROM factory_supplierProducts_data
                                    INNER JOIN factory_supplier_data ON factory_supplier_data.rmSupplierId = factory_supplierProducts_data.rmSupplierId
                                    WHERE rawMaterialId = '${rawMaterialId}'`;
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

const ddlRmStockInCategory = (req, res) => {
    try {
        const sql_querry_getddlCategory = `SELECT stockInCategoryId, UPPER(stockInCategoryName) AS stockInCategoryName FROM factory_rmStockInCategory_data ORDER BY stockInCategoryName`;
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

const ddlRmStockOutCategory = (req, res) => {
    try {
        const sql_querry_getddlCategory = `SELECT stockOutCategoryId, UPPER(stockOutCategoryName) AS stockOutCategoryName FROM factory_rmStockOutCategory_data ORDER BY stockOutCategoryName`;
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

// Get Units By rawMaterialId

const ddlRmUnitById = (req, res) => {
    try {
        const rawMaterialId = req.query.rawMaterialId;
        if (!rawMaterialId) {
            return res.status(404).send("rawMaterialId Not Found");
        }
        sql_querry_getUnitById = `SELECT 0 AS priorityNum, minRawMaterialUnit AS unitName FROM factory_rawMaterial_data WHERE rawMaterialId = '${rawMaterialId}';
                                  SELECT priorityNumber AS priorityNum, bigUnitName AS unitName FROM factory_rmUnit_preference WHERE rawMaterialId = '${rawMaterialId}' ORDER BY priorityNum ASC`;
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

// ddl All Raw Material Data

const ddlAllRawMaterialData = (req, res) => {
    try {
        sql_querry_getDetails = `SELECT p.rawMaterialId, UCASE(p.rawMaterialName) AS rawMaterialName FROM factory_rawMaterial_data AS p`;
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
    ddlRawMaterial,
    rawMaterialWiseSupplierDDL,
    ddlRmStockInCategory,
    ddlRmStockOutCategory,
    ddlRmUnitById,
    ddlAllRawMaterialData
}