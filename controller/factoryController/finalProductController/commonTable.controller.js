const pool = require('../../../database');
const jwt = require('jsonwebtoken');
const { processDatas } = require("../rawMaterial/rmConversation.controller");
const { MfprocessDatas } = require("./mfConversation.controller");

const getCommonRawMaterialData = (req, res) => {
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
                    searchWord: req.query.searchWord,
                }
                let sql_count_data = `SELECT count(*) as numRows FROM factory_rawMaterial_data WHERE rawMaterialId IN(
                                                                                                            SELECT
                                                                                                                COALESCE(frmrd.rawMaterialId, NULL)
                                                                                                            FROM
                                                                                                                factory_rawMaterialRecipee_data AS frmrd
                                                                                                            WHERE
                                                                                                                frmrd.mfProductId IN(
                                                                                                                                    SELECT
                                                                                                                                        COALESCE(fmpd.mfProductId, NULL)
                                                                                                                                    FROM
                                                                                                                                        factory_manufactureProduct_data AS fmpd
                                                                                                                                    WHERE
                                                                                                                                        fmpd.mfProductCategoryId = '${departmentId}'
                                                                                                                                  )
                                                                                                      ) AND rawMaterialName LIKE '%` + data.searchWord + `%'`;
                pool.query(sql_count_data, (err, rows, fields) => {
                    if (err) {
                        console.error("An error occurd in SQL Queery", err);
                        return res.status(500).send('Database Error');
                    } else {
                        const numRows = rows[0].numRows;
                        const numPages = Math.ceil(numRows / numPerPage);
                        if (req.query.startDate && req.query.endDate) {
                            sql_query_getDetails = `SELECT
                                                        frmd.rawMaterialId AS rawMaterialId,
                                                        frmd.rawMaterialName AS rawMaterialName,
                                                        frmd.minRawMaterialUnit AS minRawMaterialUnit,
                                                        COALESCE(rmsod.usedMaterial, 0) AS remainingStock,
                                                        COALESCE(rmsod.usedPrice, 0) AS usedPrice
                                                    FROM
                                                        factory_rawMaterial_data AS frmd
                                                    LEFT JOIN(
                                                        SELECT
                                                            rmso.rawMaterialId,
                                                            SUM(rmso.rawMaterialQty) AS usedMaterial,
                                                            SUM(rmso.rmStockOutPrice) AS usedPrice
                                                        FROM
                                                            factory_rmStockOut_data AS rmso
                                                        WHERE
                                                            rmso.rmStockOutId IN(
                                                            SELECT
                                                                COALESCE(siso.rmStockOutId, NULL)
                                                            FROM
                                                                factory_mfStockInWiseRmStockOut_data AS siso
                                                            WHERE
                                                                siso.mfStockInId IN(
                                                                SELECT
                                                                    COALESCE(mfsi.mfStockInID, NULL)
                                                                FROM
                                                                    factory_mfProductStockIn_data AS mfsi
                                                                WHERE
                                                                    mfsi.mfProductId IN(
                                                                    SELECT
                                                                        COALESCE(mfpd2.mfProductId, NULL)
                                                                    FROM
                                                                        factory_manufactureProduct_data AS mfpd2
                                                                    WHERE
                                                                        mfpd2.mfProductCategoryId = '${departmentId}'
                                                                )
                                                            )
                                                        ) AND rmso.rmStockOutDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')
                                                    GROUP BY
                                                        rmso.rawMaterialId) AS rmsod
                                                    ON
                                                        frmd.rawMaterialId = rmsod.rawMaterialId
                                                    WHERE
                                                        frmd.rawMaterialId IN(
                                                        SELECT
                                                            COALESCE(frmrd.rawMaterialId, NULL)
                                                        FROM
                                                            factory_rawMaterialRecipee_data AS frmrd
                                                        WHERE
                                                            frmrd.mfProductId IN(
                                                            SELECT
                                                                COALESCE(fmpd.mfProductId, NULL)
                                                            FROM
                                                                factory_manufactureProduct_data AS fmpd
                                                            WHERE
                                                                fmpd.mfProductCategoryId = '${departmentId}'
                                                        )
                                                    )
                                                    AND frmd.rawMaterialName LIKE '%` + data.searchWord + `%'
                                                    LIMIT ${limit}`;
                        } else {
                            sql_query_getDetails = `SELECT
                                                        frmd.rawMaterialId AS rawMaterialId,
                                                        frmd.rawMaterialName AS rawMaterialName,
                                                        frmd.minRawMaterialUnit AS minRawMaterialUnit,
                                                        COALESCE(rmsod.usedMaterial, 0) AS remainingStock,
                                                        COALESCE(rmsod.usedPrice, 0) AS usedPrice
                                                    FROM
                                                        factory_rawMaterial_data AS frmd
                                                    LEFT JOIN(
                                                        SELECT
                                                            rmso.rawMaterialId,
                                                            SUM(rmso.rawMaterialQty) AS usedMaterial,
                                                            SUM(rmso.rmStockOutPrice) AS usedPrice
                                                        FROM
                                                            factory_rmStockOut_data AS rmso
                                                        WHERE
                                                            rmso.rmStockOutId IN(
                                                            SELECT
                                                                COALESCE(siso.rmStockOutId, NULL)
                                                            FROM
                                                                factory_mfStockInWiseRmStockOut_data AS siso
                                                            WHERE
                                                                siso.mfStockInId IN(
                                                                SELECT
                                                                    COALESCE(mfsi.mfStockInID, NULL)
                                                                FROM
                                                                    factory_mfProductStockIn_data AS mfsi
                                                                WHERE
                                                                    mfsi.mfProductId IN(
                                                                    SELECT
                                                                        COALESCE(mfpd2.mfProductId, NULL)
                                                                    FROM
                                                                        factory_manufactureProduct_data AS mfpd2
                                                                    WHERE
                                                                        mfpd2.mfProductCategoryId = '${departmentId}'
                                                                )
                                                            )
                                                        ) AND rmso.rmStockOutDate >= DATE_SUB(CURDATE(), INTERVAL 1 MONTH) AND rmso.rmStockOutDate <= CURDATE()
                                                    GROUP BY
                                                        rmso.rawMaterialId) AS rmsod
                                                    ON
                                                        frmd.rawMaterialId = rmsod.rawMaterialId
                                                    WHERE
                                                        frmd.rawMaterialId IN(
                                                        SELECT
                                                            COALESCE(frmrd.rawMaterialId, NULL)
                                                        FROM
                                                            factory_rawMaterialRecipee_data AS frmrd
                                                        WHERE
                                                            frmrd.mfProductId IN(
                                                            SELECT
                                                                COALESCE(fmpd.mfProductId, NULL)
                                                            FROM
                                                                factory_manufactureProduct_data AS fmpd
                                                            WHERE
                                                                fmpd.mfProductCategoryId = '${departmentId}'
                                                        )
                                                    )
                                                    AND frmd.rawMaterialName LIKE '%` + data.searchWord + `%'
                                                    LIMIT ${limit}`;
                        }
                        pool.query(sql_query_getDetails, (err, rows) => {
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
                                    const datas = Object.values(JSON.parse(JSON.stringify(rows)))
                                    processDatas(datas)
                                        .then((data) => {
                                            console.log('json 1', datas);
                                            console.log('json 2', data);
                                            const rows = datas ? datas.map((element, index) => data[index] && data[index].convertedQuantity ? { ...element, remainingStock: data[index].convertedQuantity, allConversation: data[index].vikJson } : { ...element, remainingStock: element.remainingStock + ' ' + element.productUnit, allConversation: data[index].vikJson },
                                                // console.log(data[index] && data[index].convertedQuantity)
                                            ) : []
                                            console.log('new Json', rows);

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

const getCommonOtherSourceData = (req, res) => {
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
                    searchWord: req.query.searchWord,
                }
                let sql_count_data = `SELECT count(*) as numRows FROM factory_otherSource_data WHERE otherSourceName LIKE '%` + data.searchWord + `%'`;
                pool.query(sql_count_data, (err, rows, fields) => {
                    if (err) {
                        console.error("An error occurd in SQL Queery", err);
                        return res.status(500).send('Database Error');
                    } else {
                        const numRows = rows[0].numRows;
                        const numPages = Math.ceil(numRows / numPerPage);
                        if (req.query.startDate && req.query.endDate) {
                            sql_query_getDetails = `SELECT
                                                        osd.otherSourceId AS otherSourceId,
                                                        osd.otherSourceName AS otherSourceName,
                                                        COALESCE(os.usedSource, 0) AS usedSource,
                                                        osd.otherSourceUnit AS otherSourceUnit,
                                                        COALESCE(os.usedPrice, 0) AS usedPrice,
                                                        osd.otherSourcePrice AS unitPrice
                                                    FROM
                                                        factory_otherSource_data AS osd
                                                    LEFT JOIN(
                                                        SELECT
                                                            osud.otherSourceId,
                                                            osud.usedSourceId,
                                                            SUM(osud.usedSourceQty) AS usedSource,
                                                            SUM(osud.usedSourcePrice) AS usedPrice
                                                        FROM
                                                            factory_otherSourceUsed_data AS osud
                                                        WHERE
                                                            osud.mfStockInId IN(
                                                            SELECT
                                                                COALESCE(mfsi.mfStockInID, NULL)
                                                            FROM
                                                                factory_mfProductStockIn_data AS mfsi
                                                            WHERE
                                                                mfsi.mfProductId IN(
                                                                SELECT
                                                                    COALESCE(mfpd2.mfProductId, NULL)
                                                                FROM
                                                                    factory_manufactureProduct_data AS mfpd2
                                                                WHERE
                                                                    mfpd2.mfProductCategoryId = '${departmentId}'
                                                            )
                                                        ) AND osud.usedSourceDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')
                                                    GROUP BY
                                                        osud.otherSourceId
                                                    ) AS os ON osd.otherSourceId = os.otherSourceId
                                                    WHERE osd.otherSourceName LIKE '%` + data.searchWord + `%'
                                                    LIMIT ${limit}`;
                        } else {
                            sql_query_getDetails = `SELECT
                                                        osd.otherSourceId AS otherSourceId,
                                                        osd.otherSourceName AS otherSourceName,
                                                        COALESCE(os.usedSource, 0) AS usedSource,
                                                        osd.otherSourceUnit AS otherSourceUnit,
                                                        COALESCE(os.usedPrice, 0) AS usedPrice,
                                                        osd.otherSourcePrice AS unitPrice
                                                    FROM
                                                        factory_otherSource_data AS osd
                                                    LEFT JOIN(
                                                        SELECT
                                                            osud.otherSourceId,
                                                            osud.usedSourceId,
                                                            SUM(osud.usedSourceQty) AS usedSource,
                                                            SUM(osud.usedSourcePrice) AS usedPrice
                                                        FROM
                                                            factory_otherSourceUsed_data AS osud
                                                        WHERE
                                                            osud.mfStockInId IN(
                                                            SELECT
                                                                COALESCE(mfsi.mfStockInID, NULL)
                                                            FROM
                                                                factory_mfProductStockIn_data AS mfsi
                                                            WHERE
                                                                mfsi.mfProductId IN(
                                                                SELECT
                                                                    COALESCE(mfpd2.mfProductId, NULL)
                                                                FROM
                                                                    factory_manufactureProduct_data AS mfpd2
                                                                WHERE
                                                                    mfpd2.mfProductCategoryId = '${departmentId}'
                                                            )
                                                        ) AND osud.usedSourceDate >= DATE_SUB(CURDATE(), INTERVAL 1 MONTH) AND osud.usedSourceDate <= CURDATE()
                                                    GROUP BY
                                                        osud.otherSourceId
                                                    ) AS os ON osd.otherSourceId = os.otherSourceId
                                                    WHERE osd.otherSourceName LIKE '%` + data.searchWord + `%'
                                                    LIMIT ${limit}`;
                        }
                        console.log('fffff', sql_query_getDetails)
                        pool.query(sql_query_getDetails, (err, rows) => {
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

const getCommonMfProductData = (req, res) => {
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
                    searchWord: req.query.mfProductId,
                }
                let sql_count_data = `SELECT count(*) as numRows FROM factory_manufactureProduct_data WHERE mfProductId IN(
                                                                                                            SELECT
                                                                                                                COALESCE(fmfrd.mfProductId, NULL)
                                                                                                            FROM
                                                                                                                factory_mfProductRecipee_data AS fmfrd
                                                                                                            WHERE
                                                                                                                fmfrd.mfProductId IN(
                                                                                                                                    SELECT
                                                                                                                                        COALESCE(fmpd.mfProductId, NULL)
                                                                                                                                    FROM
                                                                                                                                        factory_manufactureProduct_data AS fmpd
                                                                                                                                    WHERE
                                                                                                                                        fmpd.mfProductCategoryId = '${departmentId}'
                                                                                                                                  )
                                                                                                      ) AND mfProductName LIKE '%` + data.searchWord + `%'`;
                pool.query(sql_count_data, (err, rows, fields) => {
                    if (err) {
                        console.error("An error occurd in SQL Queery", err);
                        return res.status(500).send('Database Error');
                    } else {
                        const numRows = rows[0].numRows;
                        const numPages = Math.ceil(numRows / numPerPage);
                        if (req.query.startDate && req.query.endDate) {
                            sql_query_getDetails = `SELECT
                                                        fmfd.mfProductId AS mfProductId,
                                                        fmfd.mfProductName AS mfProductName,
                                                        fmfd.minMfProductUnit AS minMfProductUnit,
                                                        COALESCE(mfsod.usedMaterial, 0) AS remainingStock,
                                                        COALESCE(mfsod.usedPrice, 0) AS usedPrice
                                                    FROM
                                                        factory_manufactureProduct_data AS fmfd
                                                    LEFT JOIN(
                                                        SELECT
                                                            mfso.mfProductId,
                                                            SUM(mfso.mfProductQty) AS usedMaterial,
                                                            SUM(mfso.mfProductOutPrice) AS usedPrice
                                                        FROM
                                                            factory_mfProductStockOut_data AS mfso
                                                        WHERE
                                                            mfso.mfStockOutId IN(
                                                            SELECT
                                                                COALESCE(siso.mfStockOutId, NULL)
                                                            FROM
                                                                factory_mfStockInWiseMfStockOut_data AS siso
                                                            WHERE
                                                                siso.mfStockInId IN(
                                                                SELECT
                                                                    COALESCE(mfsi.mfStockInID, NULL)
                                                                FROM
                                                                    factory_mfProductStockIn_data AS mfsi
                                                                WHERE
                                                                    mfsi.mfProductId IN(
                                                                    SELECT
                                                                        COALESCE(mfpd2.mfProductId, NULL)
                                                                    FROM
                                                                        factory_manufactureProduct_data AS mfpd2
                                                                    WHERE
                                                                        mfpd2.mfProductCategoryId = '${departmentId}'
                                                                )
                                                            )
                                                        ) AND mfso.mfStockOutDate BETWEEN STR_TO_DATE('${data.startDate}','%b %d %Y') AND STR_TO_DATE('${data.endDate}','%b %d %Y')
                                                    GROUP BY
                                                        mfso.mfProductId
                                                    ) AS mfsod
                                                    ON
                                                        fmfd.mfProductId = mfsod.mfProductId
                                                    WHERE
                                                        fmfd.mfProductId IN(
                                                        SELECT
                                                            COALESCE(fmfpd.mfProductId, NULL)
                                                        FROM
                                                            factory_mfProductRecipee_data AS fmfpd
                                                        WHERE
                                                            fmfd.mfProductId IN(
                                                            SELECT
                                                                COALESCE(fmpd.mfProductId, NULL)
                                                            FROM
                                                                factory_manufactureProduct_data AS fmpd
                                                            WHERE
                                                                fmpd.mfProductCategoryId = '${departmentId}'
                                                        )
                                                    )
                                                    AND fmfd.mfProductName LIKE '%` + data.searchWord + `%'
                                                    LIMIT ${limit}`;
                        } else {
                            sql_query_getDetails = `SELECT
                                                        fmfd.mfProductId AS mfProductId,
                                                        fmfd.mfProductName AS mfProductName,
                                                        fmfd.minMfProductUnit AS minMfProductUnit,
                                                        COALESCE(mfsod.usedMaterial, 0) AS remainingStock,
                                                        COALESCE(mfsod.usedPrice, 0) AS usedPrice
                                                    FROM
                                                        factory_manufactureProduct_data AS fmfd
                                                    LEFT JOIN(
                                                        SELECT
                                                            mfso.mfProductId,
                                                            SUM(mfso.mfProductQty) AS usedMaterial,
                                                            SUM(mfso.mfProductOutPrice) AS usedPrice
                                                        FROM
                                                            factory_mfProductStockOut_data AS mfso
                                                        WHERE
                                                            mfso.mfStockOutId IN(
                                                            SELECT
                                                                COALESCE(siso.mfStockOutId, NULL)
                                                            FROM
                                                                factory_mfStockInWiseMfStockOut_data AS siso
                                                            WHERE
                                                                siso.mfStockInId IN(
                                                                SELECT
                                                                    COALESCE(mfsi.mfStockInID, NULL)
                                                                FROM
                                                                    factory_mfProductStockIn_data AS mfsi
                                                                WHERE
                                                                    mfsi.mfProductId IN(
                                                                    SELECT
                                                                        COALESCE(mfpd2.mfProductId, NULL)
                                                                    FROM
                                                                        factory_manufactureProduct_data AS mfpd2
                                                                    WHERE
                                                                        mfpd2.mfProductCategoryId = '${departmentId}'
                                                                )
                                                            )
                                                        ) AND mfso.mfStockOutDate >= DATE_SUB(CURDATE(), INTERVAL 1 MONTH) AND mfso.mfStockOutDate <= CURDATE()
                                                    GROUP BY
                                                        mfso.mfProductId
                                                    ) AS mfsod
                                                    ON
                                                        fmfd.mfProductId = mfsod.mfProductId
                                                    WHERE
                                                        fmfd.mfProductId IN(
                                                        SELECT
                                                            COALESCE(fmfpd.mfProductId, NULL)
                                                        FROM
                                                            factory_mfProductRecipee_data AS fmfpd
                                                        WHERE
                                                            fmfd.mfProductId IN(
                                                            SELECT
                                                                COALESCE(fmpd.mfProductId, NULL)
                                                            FROM
                                                                factory_manufactureProduct_data AS fmpd
                                                            WHERE
                                                                fmpd.mfProductCategoryId = '${departmentId}'
                                                        )
                                                    )
                                                    AND fmfd.mfProductName LIKE '%` + data.searchWord + `%'
                                                    LIMIT ${limit}`;
                        }
                        pool.query(sql_query_getDetails, (err, rows) => {
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
                                    const datas = Object.values(JSON.parse(JSON.stringify(rows)))
                                    MfprocessDatas(datas)
                                        .then((data) => {
                                            console.log('json 1', datas);
                                            console.log('json 2', data);
                                            const rows = datas ? datas.map((element, index) => data[index] && data[index].convertedQuantity ? { ...element, remainingStock: data[index].convertedQuantity, allConversation: data[index].vikJson } : { ...element, remainingStock: element.remainingStock + ' ' + element.productUnit, allConversation: data[index].vikJson },
                                                // console.log(data[index] && data[index].convertedQuantity)
                                            ) : []
                                            console.log('new Json', rows);

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

module.exports = {
    getCommonRawMaterialData,
    getCommonOtherSourceData,
    getCommonMfProductData
}