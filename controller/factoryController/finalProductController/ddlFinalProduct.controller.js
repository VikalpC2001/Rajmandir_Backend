const pool = require('../../../database');
const jwt = require('jsonwebtoken');
const { processDatas } = require("./mfConversation.controller");

// DDL Other Source Data

const ddlOtherSourceData = (req, res) => {
    try {
        sql_querry_getDetails = `SELECT
                                     otherSourceId,
                                     otherSourceName,
                                     otherSourceUnit,
                                     otherSourcePrice
                                 FROM
                                     factory_otherSource_data`;
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

// DDL Manufacture Product

const ddlManufactureProductData = (req, res) => {
    try {
        sql_querry_getDetails = `SELECT
                                     mfProductId,
                                     UPPER(mfProductName) AS mfProductName
                                 FROM
                                     factory_manufactureProduct_data`;
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

// Get Units By mfProductId

const ddlmfProductUnitById = (req, res) => {
    try {
        const mfProductId = req.query.mfProductId;
        if (!mfProductId) {
            return res.status(404).send("mfProductId Not Found");
        }
        sql_querry_getUnitById = `SELECT 0 AS priorityNum, minMfProductUnit AS unitName FROM factory_manufactureProduct_data WHERE mfProductId = '${mfProductId}';
                                  SELECT priorityNumber AS priorityNum, bigUnitName AS unitName FROM mfProduct_unit_preference WHERE mfProductId = '${mfProductId}' ORDER BY priorityNum ASC`;
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

// DDL Department Wise Manufacture Product

const ddlMfProduct = (req, res) => {
    try {
        let token;
        token = req.headers.authorization ? req.headers.authorization.split(" ")[1] : null;
        if (token) {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const departmentId = decoded.id.categoryId ? decoded.id.categoryId : null;
            if (departmentId) {
                const sql_querry_getddlProduct = `SELECT p.mfProductId, UCASE(p.mfProductName) AS mfProductName, p.minMfProductUnit AS minMfProductUnit,
                                                      COALESCE(si.total_quantity, 0) - COALESCE(so.total_quantity, 0) AS remainingStock
                                                  FROM
                                                      factory_manufactureProduct_data AS p
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
                                                  WHERE p.mfProductCategoryId = '${departmentId}'
                                                  ORDER BY p.mfProductName`;
                pool.query(sql_querry_getddlProduct, (err, result) => {
                    if (err) {
                        console.error("An error occurd in SQL Queery", err);
                        return res.status(500).send('Database Error');
                    }
                    const datas = Object.values(JSON.parse(JSON.stringify(result)));
                    processDatas(datas)
                        .then((data) => {
                            const newData = datas ? datas.map((element, index) => data[index] && data[index].convertedQuantity ? { ...element, remainingStock: data[index].convertedQuantity, allConversation: data[index].vikJson } : { ...element, remainingStock: element.remainingStock + ' ' + element.productUnit, allConversation: data[index].vikJson },
                                // console.log(data[index] && data[index].convertedQuantity)
                            ) : []
                            return res.status(200).send(newData);
                        }).catch(error => {
                            console.error('Error in processing datas:', error);
                            return res.status(500).send('Internal Error');
                        });
                })
            } else {
                return res.status(404).send('DepartmentId Not Found');
            }
        } else {
            return res.status(401).send('Pleasr Login Firest.....!');
        }
    } catch (error) {
        console.error('An error occurd', error);
        res.status(500).send('Internal Server Error');
    }
}

// DDL Distributor Data

const ddlDistributorData = (req, res) => {
    try {
        const mfProductId = req.query.mfProductId;
        sql_querry_getDetails = `SELECT
                                     distributorId,
                                     distributorNickName
                                 FROM
                                     factory_distributor_data
                                 WHERE distributorId IN (SELECT
                                                             COALESCE(distributorId,null)
                                                         FROM
                                                             factory_distributorProducts_data
                                                         WHERE mfProductId = '${mfProductId}')`;
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
    ddlOtherSourceData,
    ddlManufactureProductData,
    ddlmfProductUnitById,
    ddlMfProduct,
    ddlDistributorData
}