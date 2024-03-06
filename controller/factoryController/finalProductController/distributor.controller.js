const pool = require('../../../database');
const jwt = require("jsonwebtoken");
const { processDatas } = require("./mfConversation.controller");

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
                            console.log(rows);
                            console.log(numRows);
                            console.log("Total Page :-", numPages);
                            if (numRows === 0) {
                                const rows = [{
                                    'msg': 'No Data Found'
                                }]
                                return res.status(200).send({ rows, numRows });
                            } else {
                                const datas = Object.values(JSON.parse(JSON.stringify(rows)));
                                processDatas(datas)
                                    .then((data) => {
                                        console.log('json 1', datas);
                                        console.log('json 2', data);
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

module.exports = {
    addDistributorDetails,
    removeDistributorDetails,
    fillDistributorDetails,
    updateDistributorDetails,
    getFactoryDistributordata,
    getDistributorCounterDetailsById,
    getFactoryDistributorDetailsById,
    getAllProductDetailsByDistributorId
}