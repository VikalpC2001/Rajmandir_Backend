const pool = require('../../../database');
const jwt = require('jsonwebtoken');
const excelJS = require("exceljs");
const { jsPDF } = require('jspdf');
require('jspdf-autotable');
const { processDatas } = require("../rawMaterial/rmConversation.controller");
const { MfprocessDatas } = require("./mfConversation.controller");

// Get Common Raw Material Data

const getCommonRawMaterialData = (req, res) => {
    try {
        let token;
        token = req.headers.authorization ? req.headers.authorization.split(" ")[1] : null;
        if (token) {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const departmentId = decoded.id.categoryId ? decoded.id.categoryId : null;
            console.log(departmentId, 'jojoj')
            if (departmentId) {
                const page = req.query.page;
                const numPerPage = req.query.numPerPage;
                const skip = (page - 1) * numPerPage;
                const limit = skip + ',' + numPerPage;
                const data = {
                    startDate: (req.query.startDate ? req.query.startDate : '').slice(4, 15),
                    endDate: (req.query.endDate ? req.query.endDate : '').slice(4, 15),
                    searchWord: req.query.searchWord ? req.query.searchWord : '',
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
                console.log(sql_count_data);
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
                                            const rows = datas ? datas.map((element, index) => data[index] && data[index].convertedQuantity ? { ...element, remainingStock: data[index].convertedQuantity, allConversation: data[index].vikJson } : { ...element, remainingStock: element.remainingStock + ' ' + element.productUnit, allConversation: data[index].vikJson },
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

// Get Other Source Data

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
                    searchWord: req.query.searchWord ? req.query.searchWord : '',
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
                        pool.query(sql_query_getDetails, (err, rows) => {
                            if (err) {
                                console.error("An error occurd in SQL Queery", err);
                                return res.status(500).send('Database Error');
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

// Get Common Manufacture Product Data

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
                                            const rows = datas ? datas.map((element, index) => data[index] && data[index].convertedQuantity ? { ...element, remainingStock: data[index].convertedQuantity, allConversation: data[index].vikJson } : { ...element, remainingStock: element.remainingStock + ' ' + element.productUnit, allConversation: data[index].vikJson },
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

// Export Excel

// Export Excel For Raw Material Data

const exportExcelForCommonRawMaterialData = (req, res) => {
    try {
        let token;
        token = req.headers.authorization ? req.headers.authorization.split(" ")[1] : null;
        if (token) {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const departmentId = decoded.id.categoryId ? decoded.id.categoryId : null;
            if (departmentId) {
                const filterData = {
                    startDate: (req.query.startDate ? req.query.startDate : '').slice(4, 15),
                    endDate: (req.query.endDate ? req.query.endDate : '').slice(4, 15),
                }
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
                                                ) AND rmso.rmStockOutDate BETWEEN STR_TO_DATE('${filterData.startDate}','%b %d %Y') AND STR_TO_DATE('${filterData.endDate}','%b %d %Y')
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
                                            ORDER BY frmd.rawMaterialName ASC`;
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
                                            ORDER BY frmd.rawMaterialName ASC`;
                }
                pool.query(sql_query_getDetails, (err, rows) => {
                    if (err) {
                        console.error("An error occurd in SQL Queery", err);
                        return res.status(500).send('Database Error');;
                    } else {
                        if (rows.length == 0) {
                            const rows = [{
                                'msg': 'No Data Found'
                            }]
                            return res.status(200).send({ rows, numRows });
                        } else {
                            const datas = Object.values(JSON.parse(JSON.stringify(rows)))
                            processDatas(datas)
                                .then(async (data) => {
                                    const rows = datas ? datas.map((element, index) => data[index] && data[index].convertedQuantity ? { ...element, remainingStock: data[index].convertedQuantity, allConversation: data[index].vikJson } : { ...element, remainingStock: element.remainingStock + ' ' + element.productUnit, allConversation: data[index].vikJson },
                                    ) : []
                                    const workbook = new excelJS.Workbook();  // Create a new workbook
                                    const worksheet = workbook.addWorksheet("Common Raw Material List"); // New Worksheet

                                    if (req.query.startDate && req.query.endDate) {
                                        worksheet.mergeCells('A1', 'D1');
                                        worksheet.getCell('A1').value = `Raw Material List From ${filterData.startDate} To ${filterData.endDate}`;
                                    } else {
                                        worksheet.mergeCells('A1', 'D1');
                                        worksheet.getCell('A1').value = `Raw Material List`;
                                    }

                                    /*Column headers*/
                                    worksheet.getRow(2).values = ['S no.', 'Material Name', 'Used Quantity', 'Price'];

                                    // Column for data in excel. key must match data key
                                    worksheet.columns = [
                                        { key: "s_no", width: 10, },
                                        { key: "rawMaterialName", width: 30 },
                                        { key: "remainingStock", width: 40 },
                                        { key: "usedPrice", width: 20 }
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
                                    worksheet.getRow(arr.length + 3).values = ['Total:', '', '', { formula: `SUM(D3:D${arr.length + 2})` }];

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
                                        res.contentType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
                                        res.type = 'blob';
                                        res.send(data)
                                    } catch (err) {
                                        throw new Error(err);
                                    }
                                }).catch(error => {
                                    console.error('Error in processing datas:', error);
                                    return res.status(500).send('Internal Error');
                                });
                        }
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

// Export Excel For Other Source Data

const exportExcelForCommonOtherSourceData = (req, res) => {
    try {
        let token;
        token = req.headers.authorization ? req.headers.authorization.split(" ")[1] : null;
        if (token) {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const departmentId = decoded.id.categoryId ? decoded.id.categoryId : null;
            if (departmentId) {
                const filterData = {
                    startDate: (req.query.startDate ? req.query.startDate : '').slice(4, 15),
                    endDate: (req.query.endDate ? req.query.endDate : '').slice(4, 15)
                }
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
                                                ) AND osud.usedSourceDate BETWEEN STR_TO_DATE('${filterData.startDate}','%b %d %Y') AND STR_TO_DATE('${filterData.endDate}','%b %d %Y')
                                            GROUP BY
                                                osud.otherSourceId
                                            ) AS os ON osd.otherSourceId = os.otherSourceId
                                            ORDER BY osd.otherSourceName ASC`;
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
                                            ORDER BY osd.otherSourceName ASC`;
                }
                pool.query(sql_query_getDetails, async (err, rows) => {
                    if (err) {
                        console.error("An error occurd in SQL Queery", err);
                        return res.status(500).send('Database Error');;
                    } else {
                        if (rows.length == 0) {
                            const rows = [{
                                'msg': 'No Data Found'
                            }]
                            return res.status(200).send({ rows, numRows });
                        } else {
                            const workbook = new excelJS.Workbook();  // Create a new workbook
                            const worksheet = workbook.addWorksheet("Other Source"); // New Worksheet

                            if (req.query.startDate && req.query.endDate) {
                                worksheet.mergeCells('A1', 'E1');
                                worksheet.getCell('A1').value = `Other Source From ${filterData.startDate} To ${filterData.endDate}`;
                            } else {
                                worksheet.mergeCells('A1', 'E1');
                                worksheet.getCell('A1').value = `Other Source List`;
                            }

                            /*Column headers*/
                            worksheet.getRow(2).values = ['S no.', 'Source Name', 'Used Source', 'Unit', 'Price'];

                            // Column for data in excel. key must match data key
                            worksheet.columns = [
                                { key: "s_no", width: 10, },
                                { key: "otherSourceName", width: 30 },
                                { key: "usedSource", width: 20 },
                                { key: "otherSourceUnit", width: 20 },
                                { key: "usedPrice", width: 20 }
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
                            worksheet.getRow(arr.length + 3).values = ['Total:', '', '', '', { formula: `SUM(E3:E${arr.length + 2})` }];

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
                                res.contentType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
                                res.type = 'blob';
                                res.send(data)
                            } catch (err) {
                                throw new Error(err);
                            }
                        }
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

// Export Excel For Common Manufacture Product Data

const exportExcelForCommonMfProductData = (req, res) => {
    try {
        let token;
        token = req.headers.authorization ? req.headers.authorization.split(" ")[1] : null;
        if (token) {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const departmentId = decoded.id.categoryId ? decoded.id.categoryId : null;
            if (departmentId) {
                const filterData = {
                    startDate: (req.query.startDate ? req.query.startDate : '').slice(4, 15),
                    endDate: (req.query.endDate ? req.query.endDate : '').slice(4, 15)
                }
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
                                                ) AND mfso.mfStockOutDate BETWEEN STR_TO_DATE('${filterData.startDate}','%b %d %Y') AND STR_TO_DATE('${filterData.endDate}','%b %d %Y')
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
                                            ORDER BY fmfd.mfProductName ASC`;
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
                                            ORDER BY fmfd.mfProductName ASC`;
                }
                pool.query(sql_query_getDetails, (err, rows) => {
                    if (err) {
                        console.error("An error occurd in SQL Queery", err);
                        return res.status(500).send('Database Error');;
                    } else {
                        if (rows.length == 0) {
                            const rows = [{
                                'msg': 'No Data Found'
                            }]
                            return res.status(200).send({ rows, numRows });
                        } else {
                            const datas = Object.values(JSON.parse(JSON.stringify(rows)))
                            MfprocessDatas(datas)
                                .then(async (data) => {
                                    const rows = datas ? datas.map((element, index) => data[index] && data[index].convertedQuantity ? { ...element, remainingStock: data[index].convertedQuantity, allConversation: data[index].vikJson } : { ...element, remainingStock: element.remainingStock + ' ' + element.productUnit, allConversation: data[index].vikJson },
                                        // console.log(data[index] && data[index].convertedQuantity)
                                    ) : []
                                    const workbook = new excelJS.Workbook();  // Create a new workbook
                                    const worksheet = workbook.addWorksheet("Common Manufacture Product List"); // New Worksheet

                                    if (req.query.startDate && req.query.endDate) {
                                        worksheet.mergeCells('A1', 'D1');
                                        worksheet.getCell('A1').value = `Manufacture Product List From ${filterData.startDate} To ${filterData.endDate}`;
                                    } else {
                                        worksheet.mergeCells('A1', 'D1');
                                        worksheet.getCell('A1').value = `Manufacture Product List`;
                                    }

                                    /*Column headers*/
                                    worksheet.getRow(2).values = ['S no.', 'Product Name', 'Used Quantity', 'Price'];

                                    // Column for data in excel. key must match data key
                                    worksheet.columns = [
                                        { key: "s_no", width: 10, },
                                        { key: "mfProductName", width: 30 },
                                        { key: "remainingStock", width: 40 },
                                        { key: "usedPrice", width: 20 }
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
                                    worksheet.getRow(arr.length + 3).values = ['Total:', '', '', { formula: `SUM(D3:D${arr.length + 2})` }];

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
                                        res.contentType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
                                        res.type = 'blob';
                                        res.send(data)
                                    } catch (err) {
                                        throw new Error(err);
                                    }
                                    // return res.status(200).send({ rows, numRows });
                                }).catch(error => {
                                    console.error('Error in processing datas:', error);
                                    return res.status(500).send('Internal Error');
                                });
                        }
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

// Export PDF

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

// Export PDF For Common Raw Material Data

const exportPDFForCommonRawMaterialData = (req, res) => {
    try {
        let token;
        token = req.headers.authorization ? req.headers.authorization.split(" ")[1] : null;
        if (token) {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const departmentId = decoded.id.categoryId ? decoded.id.categoryId : null;
            if (departmentId) {
                const filterData = {
                    startDate: (req.query.startDate ? req.query.startDate : '').slice(4, 15),
                    endDate: (req.query.endDate ? req.query.endDate : '').slice(4, 15),
                }
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
                                                ) AND rmso.rmStockOutDate BETWEEN STR_TO_DATE('${filterData.startDate}','%b %d %Y') AND STR_TO_DATE('${filterData.endDate}','%b %d %Y')
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
                                            ORDER BY frmd.rawMaterialName ASC`;
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
                                            ORDER BY frmd.rawMaterialName ASC`;
                }
                pool.query(sql_query_getDetails, (err, rows) => {
                    if (err) {
                        console.error("An error occurd in SQL Queery", err);
                        return res.status(500).send('Database Error');;
                    } else {
                        if (rows.length == 0) {
                            return res.status(400).send('No Data Found');
                        } else {
                            const datas = Object.values(JSON.parse(JSON.stringify(rows)))
                            processDatas(datas)
                                .then(async (data) => {
                                    const rows = datas ? datas.map((element, index) => data[index] && data[index].convertedQuantity ? { ...element, remainingStock: data[index].convertedQuantity, allConversation: data[index].vikJson } : { ...element, remainingStock: element.remainingStock + ' ' + element.productUnit, allConversation: data[index].vikJson },
                                    ) : []
                                    if (rows && rows.length == 0) {
                                        return res.status(400).send('No Data Found');
                                    } else {
                                        const abc = rows.map(e => {
                                            return {
                                                "Material Name": e.rawMaterialName,
                                                "Used Qty": e.remainingStock,
                                                "Total Price": e.usedPrice,
                                            };
                                        });
                                        const sumOfTotalPrice = abc.reduce((total, item) => total + (item['Total Price'] || 0), 0);;
                                        const sumFooterArray = ['Total', '', '', parseFloat(sumOfTotalPrice).toLocaleString('en-IN')];
                                        if (req.query.startMonth && req.query.endMonth) {
                                            tableHeading = `Raw Material Data From ${filterData.startDate} To ${filterData.endDate}`;
                                        } else {
                                            tableHeading = `Raw Material Data`;
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
                                    }
                                }).catch(error => {
                                    console.error('Error in processing datas:', error);
                                    return res.status(500).send('Internal Error');
                                });
                        }
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

// Export PDF For Other Source Data

const exportPDFForCommonOtherSourceData = (req, res) => {
    try {
        let token;
        token = req.headers.authorization ? req.headers.authorization.split(" ")[1] : null;
        if (token) {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const departmentId = decoded.id.categoryId ? decoded.id.categoryId : null;
            if (departmentId) {
                const filterData = {
                    startDate: (req.query.startDate ? req.query.startDate : '').slice(4, 15),
                    endDate: (req.query.endDate ? req.query.endDate : '').slice(4, 15)
                }
                if (req.query.startDate && req.query.endDate) {
                    sql_query_getDetails = `SELECT
                                                osd.otherSourceName AS "Source Name",
                                                COALESCE(os.usedSource, 0) AS "Used Source",
                                                osd.otherSourceUnit AS "Unit",
                                                COALESCE(os.usedPrice, 0) AS "Price",
                                                osd.otherSourcePrice AS "Per Unit Price"
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
                                                ) AND osud.usedSourceDate BETWEEN STR_TO_DATE('${filterData.startDate}','%b %d %Y') AND STR_TO_DATE('${filterData.endDate}','%b %d %Y')
                                            GROUP BY
                                                osud.otherSourceId
                                            ) AS os ON osd.otherSourceId = os.otherSourceId
                                            ORDER BY osd.otherSourceName ASC`;
                } else {
                    sql_query_getDetails = `SELECT
                                                osd.otherSourceName AS "Source Name",
                                                COALESCE(os.usedSource, 0) AS "Used Source",
                                                osd.otherSourceUnit AS "Unit",
                                                COALESCE(os.usedPrice, 0) AS "Price",
                                                osd.otherSourcePrice AS "Per Unit Price"
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
                                            ORDER BY osd.otherSourceName ASC`;
                }
                pool.query(sql_query_getDetails, async (err, rows) => {
                    if (err) {
                        console.error("An error occurd in SQL Queery", err);
                        return res.status(500).send('Database Error');;
                    } else {
                        if (rows.length == 0) {
                            return res.status(200).send('No Data Found');
                        } else {
                            const abc = Object.values(JSON.parse(JSON.stringify(rows)));
                            const sumOfTotalPrice = abc.reduce((total, item) => total + (item['Price'] || 0), 0);;
                            const sumFooterArray = ['Total', '', '', '', parseFloat(sumOfTotalPrice).toLocaleString('en-IN')];
                            if (req.query.startMonth && req.query.endMonth) {
                                tableHeading = `Other Source Data From ${filterData.startDate} To ${filterData.endDate}`;
                            } else {
                                tableHeading = `Other Source Data`;
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
                        }
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

// Export PDF For Common Manufacture Product Data

const exportPDFForCommonMfProductData = (req, res) => {
    try {
        let token;
        token = req.headers.authorization ? req.headers.authorization.split(" ")[1] : null;
        if (token) {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const departmentId = decoded.id.categoryId ? decoded.id.categoryId : null;
            if (departmentId) {
                const filterData = {
                    startDate: (req.query.startDate ? req.query.startDate : '').slice(4, 15),
                    endDate: (req.query.endDate ? req.query.endDate : '').slice(4, 15),
                }
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
                                                ) AND mfso.mfStockOutDate BETWEEN STR_TO_DATE('${filterData.startDate}','%b %d %Y') AND STR_TO_DATE('${filterData.endDate}','%b %d %Y')
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
                                            ORDER BY fmfd.mfProductName ASC`;
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
                                            ORDER BY fmfd.mfProductName ASC`;
                }
                pool.query(sql_query_getDetails, (err, rows) => {
                    if (err) {
                        console.error("An error occurd in SQL Queery", err);
                        return res.status(500).send('Database Error');;
                    } else {
                        if (rows.length == 0) {
                            return res.status(400).send('No Data Found');
                        } else {
                            const datas = Object.values(JSON.parse(JSON.stringify(rows)))
                            MfprocessDatas(datas)
                                .then(async (data) => {
                                    const rows = datas ? datas.map((element, index) => data[index] && data[index].convertedQuantity ? { ...element, remainingStock: data[index].convertedQuantity, allConversation: data[index].vikJson } : { ...element, remainingStock: element.remainingStock + ' ' + element.productUnit, allConversation: data[index].vikJson },
                                    ) : []
                                    if (rows && rows.length == 0) {
                                        return res.status(400).send('No Data Found');
                                    } else {
                                        const abc = rows.map(e => {
                                            return {
                                                "Product Name": e.mfProductName,
                                                "Used Qty": e.remainingStock,
                                                "Total Price": e.usedPrice
                                            };
                                        });
                                        const sumOfTotalPrice = abc.reduce((total, item) => total + (item['Total Price'] || 0), 0);;
                                        const sumFooterArray = ['Total', '', '', parseFloat(sumOfTotalPrice).toLocaleString('en-IN')];
                                        if (req.query.startMonth && req.query.endMonth) {
                                            tableHeading = `Manufacture Product Data From ${filterData.startDate} To ${filterData.endDate}`;
                                        } else {
                                            tableHeading = `Manufacture Product Data`;
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
                                    }
                                }).catch(error => {
                                    console.error('Error in processing datas:', error);
                                    return res.status(500).send('Internal Error');
                                });
                        }
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
    getCommonMfProductData,
    // Export Excel
    exportExcelForCommonRawMaterialData,
    exportExcelForCommonOtherSourceData,
    exportExcelForCommonMfProductData,
    // Export PDf
    exportPDFForCommonRawMaterialData,
    exportPDFForCommonOtherSourceData,
    exportPDFForCommonMfProductData
}