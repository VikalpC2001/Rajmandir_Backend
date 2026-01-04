const pool = require('../../../database');
const jwt = require("jsonwebtoken");
const { processDatas } = require("./mfConversation.controller");
const excelJS = require("exceljs");
const { jsPDF } = require('jspdf');
require('jspdf-autotable');

//Get Distributor Data API

const getFactoryDistributordata = (req, res) => {
    try {
        let token;
        token = req.headers.authorization ? req.headers.authorization.split(" ")[1] : null;
        if (token) {
            const page = req.query.page;
            const numPerPage = req.query.numPerPage;
            const skip = (page - 1) * numPerPage;
            const limit = skip + ',' + numPerPage;
            const searchWord = req.query.searchWord;
            if (req.query.searchWord) {
                sql_querry_getdetails = `SELECT count(*) as numRows FROM factory_distributor_data WHERE distributorFirmName LIKE '%` + searchWord + `%' OR distributorNickName LIKE'%` + searchWord + `%'`;
            } else {
                sql_querry_getdetails = `SELECT count(*) as numRows FROM factory_distributor_data`;
            }
            pool.query(sql_querry_getdetails, (err, rows, fields) => {
                if (err) {
                    console.error("An error occurd in SQL Queery", err);
                    return res.status(500).send('Database Error');
                } else {
                    const numRows = rows[0].numRows;
                    const numPages = Math.ceil(numRows / numPerPage);
                    const sql_common_qurey = `SELECT
                                                  dd.distributorId,
                                                  dd.distributorFirstName AS distributorName,
                                                  dd.distributorFirmName,
                                                  dd.distributorNickName,
                                                  dd.distributorPhoneNumber,
                                                  COALESCE(
                                                      (SELECT ROUND(SUM(sellAmount)) FROM factory_distributorWiseOut_data WHERE distributorId = dd.distributorId AND payType = 'debit'),
                                                      0
                                                  ) -
                                                  COALESCE(
                                                      (SELECT ROUND(SUM(paidAmount)) FROM factory_distributorTransaction_data WHERE distributorId = dd.distributorId),
                                                      0
                                                  ) AS remainingAmount
                                              FROM
                                                  factory_distributor_data AS dd`;
                    if (req.query.searchWord) {
                        sql_querry_getDistributorData = `${sql_common_qurey}       
                                                         WHERE dd.distributorFirmName LIKE '%` + searchWord + `%' OR dd.distributorNickName LIKE '%` + searchWord + `%'
                                                         ORDER BY dd.distributorFirmName
                                                         LIMIT  ${limit}`;
                    } else {
                        sql_querry_getDistributorData = `${sql_common_qurey}
                                                         ORDER BY dd.distributorFirmName 
                                                         LIMIT ${limit} `;
                    }
                    pool.query(sql_querry_getDistributorData, (err, rows, fields) => {
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
                    })
                }
            })
        } else {
            return res.status(401).send('Pleasr Login Firest.....!');
        }
    } catch (error) {
        console.error('An error occurd', error);
        res.status(500).send('Internal Server Error');
    }
}

// Get Count List Supplier Wise

const getDistributorCounterDetailsById = (req, res) => {
    try {
        let token;
        token = req.headers.authorization ? req.headers.authorization.split(" ")[1] : null;
        if (token) {
            var date = new Date(), y = date.getFullYear(), m = (date.getMonth());
            var firstDay = new Date(y, m, 1).toString().slice(4, 15);
            var lastDay = new Date(y, m + 1, 0).toString().slice(4, 15);

            const data = {
                startDate: (req.query.startDate ? req.query.startDate : '').slice(4, 15),
                endDate: (req.query.endDate ? req.query.endDate : '').slice(4, 15),
                distributorId: req.query.distributorId
            }
            if (!data.distributorId) {
                return res.status(404).send('distributorId Not Found...!');
            }
            const sql_querry_remainAmount = `SELECT COALESCE(sisd.total_price, 0) - COALESCE(sosd.total_paid, 0) AS remainingAmountOfDistributor FROM factory_distributor_data AS fdd
                                            LEFT JOIN
                                                     (
                                                         SELECT
                                                             factory_distributorWiseOut_data.distributorId,
                                                             ROUND(SUM(factory_distributorWiseOut_data.sellAmount)) AS total_price
                                                         FROM
                                                             factory_distributorWiseOut_data
                                                         WHERE factory_distributorWiseOut_data.payType = 'debit'
                                                         GROUP BY
                                                             factory_distributorWiseOut_data.distributorId
                                                     ) AS sisd ON fdd.distributorId = sisd.distributorId
                                            LEFT JOIN
                                                     (
                                                         SELECT
                                                             factory_distributorTransaction_data.distributorId,
                                                             ROUND(SUM(factory_distributorTransaction_data.paidAmount)) AS total_paid
                                                         FROM
                                                             factory_distributorTransaction_data
                                                         GROUP BY
                                                             factory_distributorTransaction_data.distributorId
                                                     ) AS sosd ON fdd.distributorId = sosd.distributorId
                                          WHERE fdd.distributorId = '${data.distributorId}'`;
            if (req.query.startDate && req.query.endDate) {
                sql_querry_getSupplierCount = `SELECT COALESCE(ROUND(SUM(sellAmount)),0) AS totalBusiness FROM factory_distributorWiseOut_data WHERE distributorId = '${data.distributorId}' AND sellDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y');
                                               SELECT COALESCE(ROUND(SUM(sellAmount)),0) AS totalBusinessOfDebit FROM factory_distributorWiseOut_data WHERE distributorId = '${data.distributorId}' AND payType = 'debit' AND sellDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y');
                                               SELECT COALESCE(ROUND(SUM(sellAmount)),0) AS totalBusinessOfCash FROM factory_distributorWiseOut_data WHERE distributorId = '${data.distributorId}' AND payType = 'cash' AND sellDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y');
                                               SELECT COALESCE(ROUND(SUM(paidAmount)),0) AS totalPaidtoSupplier FROM factory_distributorTransaction_data WHERE distributorId = '${data.distributorId}' AND transactionDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y');
                                               SELECT COUNT(mfProductId) AS numbreOfProduct FROM factory_distributorProducts_data WHERE distributorId = '${data.distributorId}';
                                               ${sql_querry_remainAmount};
                                               SELECT COALESCE(ROUND(SUM(mfso.mfProductOutPrice)),0) AS costPrice FROM factory_mfProductStockOut_data AS mfso WHERE mfso.mfStockOutId IN(SELECT COALESCE(fdwo.mfStockOutId) FROM factory_distributorWiseOut_data AS fdwo WHERE fdwo.distributorId = '${data.distributorId}' AND fdwo.sellDate BETWEEN STR_TO_DATE('${data.startDate}', '%b %d %Y') AND STR_TO_DATE('${data.endDate}', '%b %d %Y'))`;
            } else {
                sql_querry_getSupplierCount = `SELECT COALESCE(ROUND(SUM(sellAmount)),0) AS totalBusiness FROM factory_distributorWiseOut_data WHERE distributorId = '${data.distributorId}' AND sellDate BETWEEN STR_TO_DATE('${firstDay}','%b %d %Y') AND STR_TO_DATE('${lastDay}','%b %d %Y');
                                               SELECT COALESCE(ROUND(SUM(sellAmount)),0) AS totalBusinessOfDebit FROM factory_distributorWiseOut_data WHERE distributorId = '${data.distributorId}' AND payType = 'debit' AND sellDate BETWEEN STR_TO_DATE('${firstDay}','%b %d %Y') AND STR_TO_DATE('${lastDay}','%b %d %Y');
                                               SELECT COALESCE(ROUND(SUM(sellAmount)),0) AS totalBusinessOfCash FROM factory_distributorWiseOut_data WHERE distributorId = '${data.distributorId}' AND payType = 'cash' AND sellDate BETWEEN STR_TO_DATE('${firstDay}','%b %d %Y') AND STR_TO_DATE('${lastDay}','%b %d %Y');
                                               SELECT COALESCE(ROUND(SUM(paidAmount)),0) AS totalPaidtoSupplier FROM factory_distributorTransaction_data WHERE distributorId = '${data.distributorId}' AND transactionDate BETWEEN STR_TO_DATE('${firstDay}','%b %d %Y') AND STR_TO_DATE('${lastDay}','%b %d %Y');
                                               SELECT COUNT(mfProductId) AS numbreOfProduct FROM factory_distributorProducts_data WHERE distributorId = '${data.distributorId}';
                                               ${sql_querry_remainAmount};
                                               SELECT COALESCE(ROUND(SUM(mfso.mfProductOutPrice)),0) AS costPrice FROM factory_mfProductStockOut_data AS mfso WHERE mfso.mfStockOutId IN(SELECT COALESCE(fdwo.mfStockOutId) FROM factory_distributorWiseOut_data AS fdwo WHERE fdwo.distributorId = '${data.distributorId}' AND sellDate BETWEEN STR_TO_DATE('${firstDay}','%b %d %Y') AND STR_TO_DATE('${lastDay}','%b %d %Y'))`;
            }
            console.log(sql_querry_getSupplierCount);
            pool.query(sql_querry_getSupplierCount, (err, data) => {
                if (err) {
                    console.error("An error occurd in SQL Queery", err);
                    return res.status(500).send('Database Error');
                }
                else {
                    const count = {
                        totalBusiness: data[0][0].totalBusiness,
                        totalBusinessOfDebit: data[1][0].totalBusinessOfDebit,
                        totalBusinessOfCash: data[2][0].totalBusinessOfCash,
                        totalPaid: data[3][0].totalPaidtoSupplier,
                        totalProduct: data[4][0].numbreOfProduct,
                        remainingAmount: data[5][0].remainingAmountOfDistributor,
                        totalCost: data[6][0].costPrice
                    }
                    return res.status(200).send(count);
                }
            })
        } else {
            return res.status(401).send('Pleasr Login Firest.....!');
        }
    } catch (error) {
        console.error('An error occurd', error);
        res.status(500).json('Internal Server Error');
    }
}

// Get Distributor Details By ID

const getFactoryDistributorDetailsById = async (req, res) => {
    try {
        const distributorId = req.query.distributorId
        sql_query_getDetailsById = `SELECT
                                        distributorId,
                                        distributorFirstName,
                                        distributorLastName,
                                        distributorFirmName,
                                        distributorFirmAddress,
                                        distributorNickName,
                                        distributorPhoneNumber,
                                        distributorEmailId
                                    FROM
                                        factory_distributor_data
                                    WHERE distributorId = '${distributorId}'`;
        pool.query(sql_query_getDetailsById, (err, data) => {
            if (err) {
                console.error("An error occurd in SQL Queery", err);
                return res.status(500).send('Database Error');
            }
            return res.status(200).send(data[0]);
        })

    } catch (error) {
        console.error('An error occurd', error);
        res.status(500).send('Internal Server Error');
    }
}

// Add Distributor API

// const addDistributorDetails = async (req, res) => {
//     try {
//         pool.beginTransaction();

//         const uid1 = new Date();
//         const distributorId = String("distributor_" + uid1.getTime());
//         console.log("...", distributorId.toString());

//         const data = {
//             distributorFirstName: req.body.distributorFirstName ? req.body.distributorFirstName.trim() : null,
//             distributorLastName: req.body.distributorLastName ? req.body.distributorLastName.trim() : null,
//             distributorFirmName: req.body.distributorFirmName.trim(),
//             distributorFirmAddress: req.body.distributorFirmAddress ? req.body.distributorFirmAddress.trim() : null,
//             distributorNickName: req.body.distributorNickName.trim(),
//             distributorPhoneNumber: req.body.distributorPhoneNumber.trim(),
//             distributorEmailId: req.body.distributorEmailId ? req.body.distributorEmailId.trim() : null,
//             mfProductId: req.body.mfProductId ? req.body.mfProductId : null
//         }

//         const distributorProducts = () => {
//             if (data.mfProductId == null || data.mfProductId == '') {
//                 return res.status(400).send("Please Select Product");
//             } else {
//                 var string = ''
//                 data.mfProductId.forEach((data, index) => {
//                     if (index == 0)
//                         string = "(" + "'" + distributorId + "'" + "," + string + "'" + data + "'" + ")";
//                     else
//                         string = string + ",(" + "'" + distributorId + "'" + "," + "'" + data + "'" + ")";
//                 });
//                 return string;
//             }
//         }

//         if (!data.distributorNickName || !data.distributorFirmName || !data.distributorPhoneNumber || !data.mfProductId) {
//             return res.status(400).send("Please Fill all the fields");
//         } else {
//             const existingDistributor = await connection.query(`SELECT distributorNickName FROM factory_distributor_data WHERE distributorNickName = ?`, [data.distributorNickName]);

//             if (existingDistributor && existingDistributor.length) {
//                 await pool.rollback();
//                 return res.status(400).send('Distributor is Already In Use');
//             }

//             const sql_querry_addDistributor = `INSERT INTO factory_distributor_data (distributorId, distributorFirstName, distributorLastName, distributorFirmName, distributorFirmAddress, distributorNickName, distributorPhoneNumber, distributorEmailId)
//                                                  VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;

//             const addDistributorResult = await pool.query(sql_querry_addDistributor, [
//                 distributorId,
//                 data.distributorFirstName,
//                 data.distributorLastName,
//                 data.distributorFirmName,
//                 data.distributorFirmAddress,
//                 data.distributorNickName,
//                 data.distributorPhoneNumber,
//                 data.distributorEmailId
//             ]);

//             const sql_queries_addsupllierProducts = `INSERT INTO factory_distributorProducts_data (distributorId, mfProductId) VALUES ${distributorProducts()}`;

//             const addProductsResult = await pool.query(sql_queries_addsupllierProducts);

//             await pool.commit();
//             return res.status(200).send("Distributor Added Successfully");
//         }
//     } catch (error) {
//         await connection.rollback();
//         console.error('An error occurred', error);
//         res.status(500).send('Internal Server Error');
//     } finally {
//         connection.release();
//     }
// }


const addDistributorDetails = async (req, res) => {
    try {

        const uid1 = new Date();
        const distributorId = String("distributor_" + uid1.getTime());
        console.log("...", distributorId.toString());

        const data = {
            distributorFirstName: req.body.distributorFirstName ? req.body.distributorFirstName.trim() : null,
            distributorLastName: req.body.distributorLastName ? req.body.distributorLastName.trim() : null,
            distributorFirmName: req.body.distributorFirmName.trim(),
            distributorFirmAddress: req.body.distributorFirmAddress ? req.body.distributorFirmAddress.trim() : null,
            distributorNickName: req.body.distributorNickName.trim(),
            distributorPhoneNumber: req.body.distributorPhoneNumber.trim(),
            distributorEmailId: req.body.distributorEmailId ? req.body.distributorEmailId.trim() : null,
            mfProductId: req.body.mfProductId ? req.body.mfProductId : null
        }

        const distributorProducts = () => {
            if (data.mfProductId == null || data.mfProductId == '') {
                return res.status(400).send("Please Select Product");
            } else {
                var string = ''
                data.mfProductId.forEach((data, index) => {
                    if (index == 0)
                        string = "(" + "'" + distributorId + "'" + "," + string + "'" + data + "'" + ")";
                    else
                        string = string + ",(" + "'" + distributorId + "'" + "," + "'" + data + "'" + ")";
                });
                return string;
            }
        }
        if (!data.distributorNickName || !data.distributorFirmName || !data.distributorPhoneNumber || !data.mfProductId) {
            return res.status(400).send("Please Fill all the feilds");
        } else {
            req.body.distributorNickName = pool.query(`SELECT distributorNickName FROM factory_distributor_data WHERE distributorNickName = '${data.distributorNickName}'`, function (err, row) {
                if (err) {
                    console.error("An error occurd in SQL Queery", err);
                    return res.status(500).send('Database Error');
                } else if (row && row.length) {
                    return res.status(400).send('Distributor is Already In Use');
                } else {
                    sql_querry_addDistributor = `INSERT INTO factory_distributor_data (distributorId, distributorFirstName, distributorLastName, distributorFirmName, distributorFirmAddress, distributorNickName, distributorPhoneNumber, distributorEmailId)
                                                 VALUES ('${distributorId}',NULLIF('${data.distributorFirstName}','null'),NULLIF('${data.distributorLastName}','null'),'${data.distributorFirmName}',NULLIF('${data.distributorFirmAddress}','null'),'${data.distributorNickName}','${data.distributorPhoneNumber}',NULLIF('${data.distributorEmailId}','null'))`;
                    pool.query(sql_querry_addDistributor, (err, data) => {
                        if (err) {
                            console.error("An error occurd in SQL Queery", err);
                            return res.status(500).send('Database Error');
                        }
                        sql_queries_addsupllierProducts = `INSERT INTO factory_distributorProducts_data (distributorId, mfProductId) VALUES ${distributorProducts()}`;
                        pool.query(sql_queries_addsupllierProducts, (err, data) => {
                            if (err) {
                                console.error("An error occurd in SQL Queery", err);
                                return res.status(500).send('Database Error');
                            }
                            return res.status(200).send("Distributor Added Successfully");
                        })
                    })
                }
            })
        }
    } catch (error) {
        console.error('An error occurd', error);
        res.status(500).send('Internal Server Error');
    }
}

// Remove Distributor API

const removeDistributorDetails = async (req, res) => {
    try {
        let token;
        token = req.headers ? req.headers.authorization.split(" ")[1] : null;
        if (token) {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const rights = decoded.id.rights;
            if (rights == 1) {
                const distributorId = req.query.distributorId
                req.query.userId = pool.query(`SELECT distributorId FROM factory_distributor_data WHERE distributorId = '${distributorId}'`, (err, row) => {
                    if (err) {
                        console.error("An error occurd in SQL Queery", err);
                        return res.status(500).send('Database Error');
                    }
                    if (row && row.length) {
                        const sql_querry_removedetails = `DELETE FROM factory_distributor_data WHERE distributorId = '${distributorId}'`;
                        pool.query(sql_querry_removedetails, (err, data) => {
                            if (err) {
                                console.error("An error occurd in SQL Queery", err);
                                return res.status(500).send('Database Error');
                            }
                            return res.status(200).send("distributorId Deleted Successfully");
                        })
                    } else {
                        return res.send('distributorId Not Found');
                    }
                })
            } else {
                return res.status(400).send('You are Not Authorised');
            }
        } else {
            return res.status(404).send('Please Login First...!');
        }
    } catch (error) {
        console.error('An error occurd', error);
        res.status(500).send('Internal Server Error');
    }
}

// Fill Distributor For Update 

const fillDistributorDetails = (req, res) => {
    try {
        const distributorId = req.query.distributorId
        sql_querry_fillUser = `SELECT distributorId, distributorFirstName, distributorLastName, distributorFirmName, distributorFirmAddress, distributorNickName, distributorPhoneNumber, distributorEmailId FROM factory_distributor_data WHERE distributorId =  '${distributorId}';
                               SELECT factory_distributorProducts_data.mfProductId, UPPER(factory_manufactureProduct_data.mfProductName) mfProductName FROM factory_distributorProducts_data 
                                INNER JOIN factory_manufactureProduct_data ON factory_manufactureProduct_data.mfProductId = factory_distributorProducts_data.mfProductId
                                WHERE distributorId =  '${distributorId}';
                                SELECT GROUP_CONCAT(mfProductId SEPARATOR ',') as productList FROM factory_distributorProducts_data WHERE distributorId = '${distributorId}' GROUP BY distributorId;`;
        pool.query(sql_querry_fillUser, (err, data) => {
            if (err) {
                console.error("An error occurd in SQL Queery", err);
                return res.status(500).send('Database Error');
            }
            const distributorData = data[0][0]
            var a = data[2][0].productList;
            b = a.split(",");
            console.log(b);
            const allData = {
                ...distributorData,
                distributorProductData: data[1],
                mfProductId: b
            }
            return res.status(200).send(allData);
        })
    } catch (error) {
        console.error('An error occurd', error);
        res.status(500).json('Internal Server Error');
    }
}

// Update Distributor API

const updateDistributorDetails = async (req, res) => {
    try {
        const distributorId = req.body.distributorId;
        const data = {
            distributorFirstName: req.body.distributorFirstName ? req.body.distributorFirstName.trim() : null,
            distributorLastName: req.body.distributorLastName ? req.body.distributorLastName.trim() : null,
            distributorFirmName: req.body.distributorFirmName.trim(),
            distributorFirmAddress: req.body.distributorFirmAddress ? req.body.distributorFirmAddress.trim() : null,
            distributorNickName: req.body.distributorNickName.trim(),
            distributorPhoneNumber: req.body.distributorPhoneNumber.trim(),
            distributorEmailId: req.body.distributorEmailId ? req.body.distributorEmailId.trim() : null,
            mfProductId: req.body.mfProductId
        }
        if (!data.distributorNickName || !data.distributorFirmName || !data.distributorPhoneNumber || !data.mfProductId) {
            return res.status(400).send("Please Fill all the feilds");
        }
        const distributorProducts = () => {
            var string = ''
            data.mfProductId.forEach((data, index) => {
                if (index == 0)
                    string = "(" + "'" + distributorId + "'" + "," + string + "'" + data + "'" + ")";
                else
                    string = string + ",(" + "'" + distributorId + "'" + "," + "'" + data + "'" + ")";
            });
            return string;
        }
        const sql_querry_updatedetails = `UPDATE factory_distributor_data SET distributorFirstName = NULLIF('${data.distributorFirstName}','null'), 
                                                                             distributorLastName = NULLIF('${data.distributorLastName}','null'),
                                                                             distributorFirmName = NULLIF('${data.distributorFirmName}','null'),
                                                                             distributorFirmAddress = '${data.distributorFirmAddress}',
                                                                             distributorNickName = '${data.distributorNickName}',
                                                                             distributorPhoneNumber = '${data.distributorPhoneNumber}',
                                                                             distributorEmailId = NULLIF('${data.distributorEmailId}','null')
                                                                       WHERE distributorId = '${distributorId}'`;
        pool.query(sql_querry_updatedetails, (err, data) => {
            if (err) {
                console.error("An error occurd in SQL Queery", err);
                return res.status(500).send('Database Error');
            }
            sql_querry_deleteDistributorProducts = `DELETE FROM factory_distributorProducts_data WHERE distributorId = '${distributorId}'`;
            pool.query(sql_querry_deleteDistributorProducts, (err, data) => {
                if (err) {
                    console.error("An error occurd in SQL Queery", err);
                    return res.status(500).send('Database Error');
                }
                sql_queries_addsupllierProducts = `INSERT INTO factory_distributorProducts_data (distributorId, mfProductId) VALUES ${distributorProducts()}`;
                pool.query(sql_queries_addsupllierProducts, (err, data) => {
                    if (err) {
                        console.error("An error occurd in SQL Queery", err);
                        return res.status(500).send('Database Error');
                    }
                    return res.status(200).send("Distributor Updated Successfully");
                })
            })
        })
    } catch (error) {
        console.error('An error occurd', error);
        res.status(500).send('Internal Server Error');
    }
}

// Get All Product Details By Supplier Id

const getAllProductDetailsByDistributorId = async (req, res) => {
    try {
        let token;
        token = req.headers.authorization ? req.headers.authorization.split(" ")[1] : null;
        if (token) {
            var date = new Date(), y = date.getFullYear(), m = (date.getMonth());
            var firstDay = new Date(y, m, 1).toString().slice(4, 15);
            var lastDay = new Date(y, m + 1, 0).toString().slice(4, 15);
            const page = req.query.page;
            const numPerPage = req.query.numPerPage;
            const skip = (page - 1) * numPerPage;
            const limit = skip + ',' + numPerPage;

            const data = {
                startDate: (req.query.startDate ? req.query.startDate : '').slice(4, 15),
                endDate: (req.query.endDate ? req.query.endDate : '').slice(4, 15),
                distributorId: req.query.distributorId
            }
            sql_querry_getAllProductBysupplierPagination = `SELECT COUNT(mfProductId) AS numRows FROM factory_distributorProducts_data WHERE distributorId = '${data.distributorId}'`;
            pool.query(sql_querry_getAllProductBysupplierPagination, (err, rows, fields) => {
                if (err) {
                    console.error("An error occurd in SQL Queery", err);
                    return res.status(500).send('Database Error');
                } else {
                    const numRows = rows[0].numRows;
                    const numPages = Math.ceil(numRows / numPerPage);
                    const commaonQuery = `SELECT
                                              dpd.mfProductId AS mfProductId,
                                              fmp.mfProductName AS mfProductName,
                                              fmp.minMfProductUnit AS minMfProductUnit,
                                              COALESCE(so.qty, 0) AS remainingStock,
                                              COALESCE(so.cost, 0) AS cost,
                                              COALESCE(sod.totalSell, 0) AS totalSellPrice
                                          FROM
                                              factory_distributorProducts_data AS dpd
                                          INNER JOIN factory_manufactureProduct_data AS fmp ON fmp.mfProductId = dpd.mfProductId`;
                    if (req.query.startDate && req.query.endDate) {
                        sql_querry_getAllProductBysupplier = `${commaonQuery}
                                                              LEFT JOIN(
                                                                  SELECT
                                                                      mfso.mfProductId,
                                                                      SUM(mfso.mfProductQty) AS qty,
                                                                      SUM(mfso.mfProductOutPrice) AS cost
                                                                  FROM
                                                                      factory_mfProductStockOut_data AS mfso
                                                                  WHERE
                                                                      mfso.mfStockOutId IN(
                                                                      SELECT
                                                                          COALESCE(dwo.mfStockOutId)
                                                                      FROM
                                                                          factory_distributorWiseOut_data AS dwo
                                                                      WHERE
                                                                          dwo.distributorId = '${data.distributorId}' AND dwo.sellDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')
                                                                      GROUP BY
                                                                          mfso.mfProductId
                                                                  )
                                                              ) AS so
                                                              ON
                                                                  fmp.mfProductId = so.mfProductId
                                                              LEFT JOIN(
                                                                  SELECT
                                                                      dwod.mfProductId,
                                                                      SUM(dwod.sellAmount) AS totalSell
                                                                  FROM
                                                                      factory_distributorWiseOut_data AS dwod
                                                                  WHERE dwod.distributorId = '${data.distributorId}' AND dwod.sellDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')
                                                                  GROUP BY dwod.mfProductId
                                                              ) AS sod ON dpd.mfProductId = sod.mfProductId
                                                              WHERE distributorId = '${data.distributorId}'
                                                              ORDER BY fmp.mfProductName
                                                              LIMIT ${limit}`;
                    } else {
                        sql_querry_getAllProductBysupplier = `${commaonQuery}
                                                              LEFT JOIN(
                                                                  SELECT
                                                                      mfso.mfProductId,
                                                                      SUM(mfso.mfProductQty) AS qty,
                                                                      SUM(mfso.mfProductOutPrice) AS cost
                                                                  FROM
                                                                      factory_mfProductStockOut_data AS mfso
                                                                  WHERE
                                                                      mfso.mfStockOutId IN(
                                                                      SELECT
                                                                          COALESCE(dwo.mfStockOutId)
                                                                      FROM
                                                                          factory_distributorWiseOut_data AS dwo
                                                                      WHERE
                                                                          dwo.distributorId = '${data.distributorId}' AND dwo.sellDate BETWEEN STR_TO_DATE('${firstDay}','%b %d %Y') AND STR_TO_DATE('${lastDay}','%b %d %Y')
                                                                      GROUP BY
                                                                          mfso.mfProductId
                                                                  )
                                                              ) AS so
                                                              ON
                                                                  dpd.mfProductId = so.mfProductId
                                                              LEFT JOIN(
                                                                  SELECT
                                                                      dwod.mfProductId,
                                                                      SUM(dwod.sellAmount) AS totalSell
                                                                  FROM
                                                                      factory_distributorWiseOut_data AS dwod
                                                                  WHERE dwod.distributorId = '${data.distributorId}' AND dwod.sellDate BETWEEN STR_TO_DATE('${firstDay}','%b %d %Y') AND STR_TO_DATE('${lastDay}','%b %d %Y')
                                                                  GROUP BY dwod.mfProductId
                                                              ) AS sod ON dpd.mfProductId = sod.mfProductId
                                                              WHERE distributorId = '${data.distributorId}'
                                                              ORDER BY fmp.mfProductName
                                                              LIMIT ${limit}`;
                    }
                    pool.query(sql_querry_getAllProductBysupplier, (err, rows, fields) => {
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
                                const datas = Object.values(JSON.parse(JSON.stringify(rows)));
                                processDatas(datas)
                                    .then((data) => {
                                        const rows = datas ? datas.map((element, index) => data[index] && data[index].convertedQuantity ? { ...element, remainingStock: data[index].convertedQuantity } : { ...element, remainingStock: element.remainingStock + ' ' + element.minMfProductUnit },
                                            // console.log(data[index] && data[index].convertedQuantity)
                                        ) : []
                                        return res.status(200).send({ rows, numRows });
                                    }).catch(error => {
                                        console.error('Error in processing datas:', error);
                                        return res.status(500).send('Internal Error');
                                    });
                            }
                        }
                    })
                }
            })
        } else {
            return res.status(401).send('Pleasr Login Firest.....!');
        }
    } catch (error) {
        console.error('An error occurd', error);
        res.status(500).json('Internal Server Error');
    }
}

const exportExcelSheetForAllProductDetailsByDistributorId = (req, res) => {
    let token;
    token = req.headers.authorization ? req.headers.authorization.split(" ")[1] : null;
    if (token) {
        var date = new Date(), y = date.getFullYear(), m = (date.getMonth());
        var firstDay = new Date(y, m, 1).toString().slice(4, 15);
        var lastDay = new Date(y, m + 1, 0).toString().slice(4, 15);

        const data = {
            startDate: (req.query.startDate ? req.query.startDate : '').slice(4, 15),
            endDate: (req.query.endDate ? req.query.endDate : '').slice(4, 15),
            distributorId: req.query.distributorId
        }
        const commaonQuery = `SELECT
                                  dpd.mfProductId AS mfProductId,
                                  fmp.mfProductName AS mfProductName,
                                  fmp.minMfProductUnit AS minMfProductUnit,
                                  COALESCE(so.qty, 0) AS remainingStock,
                                  COALESCE(so.cost, 0) AS cost,
                                  COALESCE(sod.totalSell, 0) AS totalSellPrice,
                                  COALESCE(sod.totalSell, 0) - COALESCE(so.cost, 0) AS profit
                              FROM
                                  factory_distributorProducts_data AS dpd
                              INNER JOIN factory_manufactureProduct_data AS fmp ON fmp.mfProductId = dpd.mfProductId`;
        if (req.query.startDate && req.query.endDate) {
            sql_querry_getAllProductBysupplier = `${commaonQuery}
                                                              LEFT JOIN(
                                                                  SELECT
                                                                      mfso.mfProductId,
                                                                      SUM(mfso.mfProductQty) AS qty,
                                                                      SUM(mfso.mfProductOutPrice) AS cost
                                                                  FROM
                                                                      factory_mfProductStockOut_data AS mfso
                                                                  WHERE
                                                                      mfso.mfStockOutId IN(
                                                                      SELECT
                                                                          COALESCE(dwo.mfStockOutId)
                                                                      FROM
                                                                          factory_distributorWiseOut_data AS dwo
                                                                      WHERE
                                                                          dwo.distributorId = '${data.distributorId}' AND dwo.sellDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')
                                                                      GROUP BY
                                                                          mfso.mfProductId
                                                                  )
                                                              ) AS so
                                                              ON
                                                                  fmp.mfProductId = so.mfProductId
                                                              LEFT JOIN(
                                                                  SELECT
                                                                      dwod.mfProductId,
                                                                      SUM(dwod.sellAmount) AS totalSell
                                                                  FROM
                                                                      factory_distributorWiseOut_data AS dwod
                                                                  WHERE dwod.distributorId = '${data.distributorId}' AND dwod.sellDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')
                                                                  GROUP BY dwod.mfProductId
                                                              ) AS sod ON dpd.mfProductId = sod.mfProductId
                                                              WHERE distributorId = '${data.distributorId}'
                                                              ORDER BY fmp.mfProductName`;
        } else {
            sql_querry_getAllProductBysupplier = `${commaonQuery}
                                                              LEFT JOIN(
                                                                  SELECT
                                                                      mfso.mfProductId,
                                                                      SUM(mfso.mfProductQty) AS qty,
                                                                      SUM(mfso.mfProductOutPrice) AS cost
                                                                  FROM
                                                                      factory_mfProductStockOut_data AS mfso
                                                                  WHERE
                                                                      mfso.mfStockOutId IN(
                                                                      SELECT
                                                                          COALESCE(dwo.mfStockOutId)
                                                                      FROM
                                                                          factory_distributorWiseOut_data AS dwo
                                                                      WHERE
                                                                          dwo.distributorId = '${data.distributorId}' AND dwo.sellDate BETWEEN STR_TO_DATE('${firstDay}','%b %d %Y') AND STR_TO_DATE('${lastDay}','%b %d %Y')
                                                                      GROUP BY
                                                                          mfso.mfProductId
                                                                  )
                                                              ) AS so
                                                              ON
                                                                  dpd.mfProductId = so.mfProductId
                                                              LEFT JOIN(
                                                                  SELECT
                                                                      dwod.mfProductId,
                                                                      SUM(dwod.sellAmount) AS totalSell
                                                                  FROM
                                                                      factory_distributorWiseOut_data AS dwod
                                                                  WHERE dwod.distributorId = '${data.distributorId}' AND dwod.sellDate BETWEEN STR_TO_DATE('${firstDay}','%b %d %Y') AND STR_TO_DATE('${lastDay}','%b %d %Y')
                                                                  GROUP BY dwod.mfProductId
                                                              ) AS sod ON dpd.mfProductId = sod.mfProductId
                                                              WHERE distributorId = '${data.distributorId}'
                                                              ORDER BY fmp.mfProductName`;
        }
        pool.query(sql_querry_getAllProductBysupplier, async (err, rows) => {
            if (err) return res.status(404).send(err);
            const datas = Object.values(JSON.parse(JSON.stringify(rows)));
            await processDatas(datas)
                .then(async (data) => {
                    const rows = datas ? datas.map((element, index) => data[index] && data[index].convertedQuantity ? { ...element, remainingStock: data[index].convertedQuantity } : { ...element, remainingStock: element.remainingStock + ' ' + element.minRawMaterialUnit },
                    ) : []
                    const workbook = new excelJS.Workbook();  // Create a new workbook
                    const worksheet = workbook.addWorksheet("All Product"); // New Worksheet

                    if (req.query.startDate && req.query.endDate) {
                        worksheet.mergeCells('A1', 'F1');
                        worksheet.getCell('A1').value = `Distributor Wise Product List : ${(req.query.startDate).slice(4, 15)} To ${(req.query.endDate).slice(4, 15)}`;
                    } else {
                        worksheet.mergeCells('A1', 'F1');
                        worksheet.getCell('A1').value = `Distributor Wise Product List : ${firstDay} To ${lastDay}`;
                    }

                    /*Column headers*/
                    worksheet.getRow(2).values = ['S no.', 'Product Name', 'Totoal Distribute', 'Production Cost', 'Sell Price', 'Profit'];

                    // Column for data in excel. key must match data key
                    worksheet.columns = [
                        { key: "s_no", width: 10, },
                        { key: "mfProductName", width: 30 },
                        { key: "remainingStock", width: 40 },
                        { key: "cost", width: 20 },
                        { key: "totalSellPrice", width: 20 },
                        { key: "profit", width: 20 }
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
                    worksheet.getRow(arr.length + 3).values = ['Total:', '', '', { formula: `SUM(D3:D${arr.length + 2})` }, { formula: `SUM(E3:E${arr.length + 2})` }, { formula: `SUM(F3:F${arr.length + 2})` }];

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
                }).catch(error => {
                    console.error('Error in processing datas:', error);
                    return res.status(500).send('Internal Error');
                });
        })
    } else {
        return res.status(401).send('Pleasr Login Firest.....!');
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

// Export PDF Cash Transaction List

const exportPdfForAllProductDetailsByDistributorId = (req, res) => {
    try {
        let token;
        token = req.headers.authorization ? req.headers.authorization.split(" ")[1] : null;
        if (token) {
            var date = new Date(), y = date.getFullYear(), m = (date.getMonth());
            var firstDay = new Date(y, m, 1).toString().slice(4, 15);
            var lastDay = new Date(y, m + 1, 0).toString().slice(4, 15);

            const data = {
                startDate: (req.query.startDate ? req.query.startDate : '').slice(4, 15),
                endDate: (req.query.endDate ? req.query.endDate : '').slice(4, 15),
                distributorId: req.query.distributorId
            }
            const commaonQuery = `SELECT
                                  dpd.mfProductId AS mfProductId,
                                  fmp.mfProductName AS mfProductName,
                                  fmp.minMfProductUnit AS minMfProductUnit,
                                  COALESCE(so.qty, 0) AS remainingStock,
                                  COALESCE(so.cost, 0) AS cost,
                                  COALESCE(sod.totalSell, 0) AS totalSellPrice,
                                  COALESCE(sod.totalSell, 0) - COALESCE(so.cost, 0) AS profit
                              FROM
                                  factory_distributorProducts_data AS dpd
                              INNER JOIN factory_manufactureProduct_data AS fmp ON fmp.mfProductId = dpd.mfProductId`;
            if (req.query.startDate && req.query.endDate) {
                sql_querry_getAllProductBysupplier = `${commaonQuery}
                                                              LEFT JOIN(
                                                                  SELECT
                                                                      mfso.mfProductId,
                                                                      SUM(mfso.mfProductQty) AS qty,
                                                                      SUM(mfso.mfProductOutPrice) AS cost
                                                                  FROM
                                                                      factory_mfProductStockOut_data AS mfso
                                                                  WHERE
                                                                      mfso.mfStockOutId IN(
                                                                      SELECT
                                                                          COALESCE(dwo.mfStockOutId)
                                                                      FROM
                                                                          factory_distributorWiseOut_data AS dwo
                                                                      WHERE
                                                                          dwo.distributorId = '${data.distributorId}' AND dwo.sellDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')
                                                                      GROUP BY
                                                                          mfso.mfProductId
                                                                  )
                                                              ) AS so
                                                              ON
                                                                  fmp.mfProductId = so.mfProductId
                                                              LEFT JOIN(
                                                                  SELECT
                                                                      dwod.mfProductId,
                                                                      SUM(dwod.sellAmount) AS totalSell
                                                                  FROM
                                                                      factory_distributorWiseOut_data AS dwod
                                                                  WHERE dwod.distributorId = '${data.distributorId}' AND dwod.sellDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')
                                                                  GROUP BY dwod.mfProductId
                                                              ) AS sod ON dpd.mfProductId = sod.mfProductId
                                                              WHERE distributorId = '${data.distributorId}'
                                                              ORDER BY fmp.mfProductName`;
            } else {
                sql_querry_getAllProductBysupplier = `${commaonQuery}
                                                              LEFT JOIN(
                                                                  SELECT
                                                                      mfso.mfProductId,
                                                                      SUM(mfso.mfProductQty) AS qty,
                                                                      SUM(mfso.mfProductOutPrice) AS cost
                                                                  FROM
                                                                      factory_mfProductStockOut_data AS mfso
                                                                  WHERE
                                                                      mfso.mfStockOutId IN(
                                                                      SELECT
                                                                          COALESCE(dwo.mfStockOutId)
                                                                      FROM
                                                                          factory_distributorWiseOut_data AS dwo
                                                                      WHERE
                                                                          dwo.distributorId = '${data.distributorId}' AND dwo.sellDate BETWEEN STR_TO_DATE('${firstDay}','%b %d %Y') AND STR_TO_DATE('${lastDay}','%b %d %Y')
                                                                      GROUP BY
                                                                          mfso.mfProductId
                                                                  )
                                                              ) AS so
                                                              ON
                                                                  dpd.mfProductId = so.mfProductId
                                                              LEFT JOIN(
                                                                  SELECT
                                                                      dwod.mfProductId,
                                                                      SUM(dwod.sellAmount) AS totalSell
                                                                  FROM
                                                                      factory_distributorWiseOut_data AS dwod
                                                                  WHERE dwod.distributorId = '${data.distributorId}' AND dwod.sellDate BETWEEN STR_TO_DATE('${firstDay}','%b %d %Y') AND STR_TO_DATE('${lastDay}','%b %d %Y')
                                                                  GROUP BY dwod.mfProductId
                                                              ) AS sod ON dpd.mfProductId = sod.mfProductId
                                                              WHERE distributorId = '${data.distributorId}'
                                                              ORDER BY fmp.mfProductName`;
            }
            pool.query(sql_querry_getAllProductBysupplier, async (err, rows) => {
                if (err) {
                    console.error("An error occurd in SQL Queery", err);
                    return res.status(500).send('Database Error');
                } else if (rows && rows.length <= 0) {
                    return res.status(400).send('No Data Found');
                } else {
                    const datas = Object.values(JSON.parse(JSON.stringify(rows)));
                    await processDatas(datas)
                        .then(async (data) => {
                            const rows = datas ? datas.map((element, index) => data[index] && data[index].convertedQuantity ? { ...element, remainingStock: data[index].convertedQuantity } : { ...element, remainingStock: element.remainingStock + ' ' + element.minProductUnit },
                            ) : []
                            const abc = rows.map(e => {
                                return {
                                    "Produc": e.mfProductName,
                                    "Totoal Distribute": e.remainingStock,
                                    "Cost": e.cost,
                                    "Sell Price": e.totalSellPrice,
                                    "Profit": e.profit
                                };
                            });
                            const cost = abc.reduce((total, item) => total + (item['Cost'] || 0), 0);
                            const sellPrice = abc.reduce((total, item) => total + (item['Sell Price'] || 0), 0);
                            const Profit = abc.reduce((total, item) => total + (item['Profit'] || 0), 0);
                            const sumFooterArray = ['Total', '', '', parseFloat(cost).toLocaleString('en-IN'), parseFloat(sellPrice).toLocaleString('en-IN'), parseFloat(Profit).toLocaleString('en-IN')];
                            if (req.query.startDate && req.query.endDate) {
                                tableHeading = `Distributor Wise Product List From ${(req.query.startDate).slice(4, 15)} To ${(req.query.endDate).slice(4, 15)}`;
                            } else {
                                tableHeading = `Distributor Wise Product List From ${firstDay} To ${lastDay}`;
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
                        }).catch(error => {
                            console.error('Error in processing datas:', error);
                            return res.status(500).send('Internal Error');
                        });
                }
            });
        } else {
            return res.status(401).send('Pleasr Login Firest.....!');
        }
    } catch (error) {
        console.error('An error occurd', error);
        res.status(500).send('Internal Server Error');
    }
}

module.exports = {
    addDistributorDetails,
    removeDistributorDetails,
    fillDistributorDetails,
    updateDistributorDetails,
    getFactoryDistributordata,
    getDistributorCounterDetailsById,
    getFactoryDistributorDetailsById,
    getAllProductDetailsByDistributorId,
    exportExcelSheetForAllProductDetailsByDistributorId,
    exportPdfForAllProductDetailsByDistributorId
}