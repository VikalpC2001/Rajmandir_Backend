const pool = require('../../database');
const jwt = require("jsonwebtoken");
const pool2 = require('../../databasePool');

// Get Date Function 4 Hour

function getCurrentDate() {
    const now = new Date();
    const hours = now.getHours();

    if (hours <= 4) { // If it's 4 AM or later, increment the date
        now.setDate(now.getDate() - 1);
    }
    return now.toDateString().slice(4, 15);
}

// Get Bill Category Function By First Word

function getCategory(input) {
    switch (input.toUpperCase()) {  // Ensure input is case-insensitive
        case 'P':
            return 'Pick Up';
        case 'D':
            return 'Delivery';
        default:
            return null;  // Default case if input doesn't match any cases
    }
}

// Get Billing Statics Data

const getBillingStaticsData = (req, res) => {
    try {
        let token;
        token = req.headers ? req.headers.authorization.split(" ")[1] : null;
        if (token) {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const branchId = decoded.id.branchId;
            const startDate = (req.query.startDate ? req.query.startDate : '').slice(4, 15);
            const endDate = (req.query.endDate ? req.query.endDate : '').slice(4, 15);
            const currentDate = getCurrentDate();
            let sql_queries_getStatics = `-- Pick Up
                                          SELECT
                                              COALESCE(SUM(CASE WHEN billPayType = 'cash' THEN settledAmount ELSE 0 END), 0) AS cashAmt,
                                              COALESCE(SUM(CASE WHEN billPayType = 'due' THEN settledAmount ELSE 0 END), 0) AS dueAmt,
                                              COALESCE(SUM(CASE WHEN billPayType = 'online' THEN settledAmount ELSE 0 END), 0) AS onlineAmt,
                                              COALESCE(SUM(CASE WHEN billPayType = 'complimentary' THEN settledAmount ELSE 0 END), 0) AS complimentaryAmt,
                                              COALESCE(SUM(CASE WHEN billPayType = 'cancel' THEN settledAmount ELSE 0 END), 0) AS cancleAmt,
                                              COALESCE(SUM(totalDiscount),0) AS discountAmt
                                          FROM 
                                              billing_data
                                          WHERE billType = 'Pick Up' AND branchId = '${branchId}' AND billDate BETWEEN STR_TO_DATE('${startDate ? startDate : currentDate}', '%b %d %Y') AND STR_TO_DATE('${endDate ? endDate : currentDate}', '%b %d %Y');
                                          -- Delivery
                                          SELECT
                                             COALESCE(SUM(CASE WHEN billPayType = 'cash' THEN settledAmount ELSE 0 END), 0) AS cashAmt,
                                             COALESCE(SUM(CASE WHEN billPayType = 'due' THEN settledAmount ELSE 0 END), 0) AS dueAmt,
                                             COALESCE(SUM(CASE WHEN billPayType = 'online' THEN settledAmount ELSE 0 END), 0) AS onlineAmt,
                                             COALESCE(SUM(CASE WHEN billPayType = 'complimentary' THEN settledAmount ELSE 0 END), 0) AS complimentaryAmt,
                                             COALESCE(SUM(CASE WHEN billPayType = 'cancel' THEN settledAmount ELSE 0 END), 0) AS cancleAmt,
                                             COALESCE(SUM(totalDiscount),0) AS discountAmt
                                          FROM 
                                             billing_data
                                          WHERE billType = 'Delivery' AND branchId = '${branchId}' AND billDate BETWEEN STR_TO_DATE('${startDate ? startDate : currentDate}', '%b %d %Y') AND STR_TO_DATE('${endDate ? endDate : currentDate}', '%b %d %Y');`;
            pool.query(sql_queries_getStatics, (err, data) => {
                if (err) {
                    console.error("An error occurred in SQL Queery", err);
                    return res.status(500).send('Database Error');
                } else {
                    const json = {
                        pickUp: data[0][0],
                        delivery: data[1][0]
                    }
                    return res.status(200).send(json);
                }
            })
        } else {
            return res.status(400).send('Please Login First....!');
        }
    } catch (error) {
        console.error('An error occurred', error);
        res.status(500).json('Internal Server Error');
    }
}

// Get Live View Data

const getLiveViewByCategoryId = (req, res) => {
    try {
        let token;
        token = req.headers ? req.headers.authorization.split(" ")[1] : null;
        if (token) {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const branchId = decoded.id.branchId;
            const currentDate = getCurrentDate();
            const page = req.query.page;
            const numPerPage = req.query.numPerPage;
            const skip = (page - 1) * numPerPage;
            const limit = skip + ',' + numPerPage;
            const searchWord = req.query.searchWord ? req.query.searchWord : '';
            const billCategory = req.query.billCategory ? req.query.billCategory : null;
            if (billCategory) {
                sql_query_chkBillExist = `SELECT bd.billId, bd.billType FROM billing_data AS bd
                                          LEFT JOIN billing_token_data AS btd ON btd.billId = bd.billId
                                          WHERE
                                              CONCAT(
                                                  CASE bd.billType
                                                      WHEN 'Pick Up' THEN 'P'
                                                      WHEN 'Delivery' THEN 'D'
                                                      ELSE ''
                                                  END,
                                                  btd.tokenNo
                                              ) LIKE '%` + searchWord + `%'
                                              AND bd.billType = '${billCategory}' AND bd.branchId = '${branchId}' AND bd.billDate = STR_TO_DATE('${currentDate}', '%b %d %Y')
                                          ORDER BY bd.billCreationDate DESC
                                          LIMIT ${limit}`;
            } else {
                sql_query_chkBillExist = `SELECT bd.billId, bd.billType FROM billing_data AS bd
                                          LEFT JOIN billing_token_data AS btd ON btd.billId = bd.billId
                                          WHERE
                                              CONCAT(
                                                  CASE bd.billType
                                                      WHEN 'Pick Up' THEN 'P'
                                                      WHEN 'Delivery' THEN 'D'
                                                      ELSE ''
                                                  END,
                                                  btd.tokenNo
                                              ) LIKE '%` + searchWord + `%'
                                              AND bd.branchId = '${branchId}' AND bd.billDate = STR_TO_DATE('${currentDate}', '%b %d %Y')
                                          ORDER BY bd.billCreationDate DESC
                                          LIMIT ${limit}`;
            }
            pool.query(sql_query_chkBillExist, (err, bills) => {
                if (err) {
                    console.error("An error occurred in SQL Query", err);
                    return res.status(500).send('Database Error');
                } else {
                    if (bills && bills.length) {
                        const billDataPromises = bills.map(bill => {
                            const billId = bill.billId;
                            const billType = bill.billType;
                            let sql_query_getBillingData = `SELECT 
                                                            bd.billId AS billId, 
                                                            bd.billNumber AS billNumber,
                                                            COALESCE(bod.billNumber, CONCAT('C', bcd.billNumber), 'Not Available') AS officialBillNo,
                                                            CASE
                                                                WHEN bd.billType = 'Hotel' THEN CONCAT('H',btd.tokenNo)
                                                                WHEN bd.billType = 'Pick Up' THEN CONCAT('P',btd.tokenNo)
                                                                WHEN bd.billType = 'Delivery' THEN CONCAT('D',btd.tokenNo)
                                                                WHEN bd.billType = 'Dine In' THEN CONCAT('R',btd.tokenNo)
                                                                ELSE NULL
                                                            END AS tokenNo,
                                                            bwu.onlineId AS onlineId,
                                                            boud.holderName AS holderName,
                                                            boud.upiId AS upiId,
                                                            bd.firmId AS firmId, 
                                                            bd.cashier AS cashier, 
                                                            bd.menuStatus AS menuStatus, 
                                                            bd.billType AS billType, 
                                                            bd.billPayType AS billPayType, 
                                                            bd.discountType AS discountType, 
                                                            bd.discountValue AS discountValue, 
                                                            bd.totalDiscount AS totalDiscount, 
                                                            bd.totalAmount AS totalAmount, 
                                                            bd.settledAmount AS settledAmount, 
                                                            bd.billComment AS billComment, 
                                                            DATE_FORMAT(bd.billDate,'%d/%m/%Y') AS billDate,
                                                            bd.billStatus AS billStatus,
                                                            DATE_FORMAT(bd.billCreationDate,'%h:%i %p') AS billTime,
                                                            SEC_TO_TIME(
                                                                TIMESTAMPDIFF(
                                                                    SECOND,
                                                                    bd.billCreationDate,
                                                                    NOW()
                                                                )
                                                            ) AS timeDifference
                                                        FROM 
                                                            billing_data AS bd
                                                        LEFT JOIN billing_Official_data AS bod ON bod.billId = bd.billId
                                                        LEFT JOIN billing_Complimentary_data AS bcd ON bcd.billId = bd.billId
                                                        LEFT JOIN billing_token_data AS btd ON btd.billId = bd.billId
                                                        LEFT JOIN billing_firm_data AS bfd ON bfd.firmId = bd.firmId
                                                        LEFT JOIN billing_billWiseUpi_data AS bwu ON bwu.billId = bd.billId
                                                        LEFT JOIN billing_onlineUPI_data AS boud ON boud.onlineId = bwu.onlineId
                                                        WHERE bd.billId = '${billId}'`;
                            let sql_query_getBillwiseItem = `SELECT
                                                             bwid.iwbId AS iwbId,
                                                             bwid.itemId AS itemId,
                                                             imd.itemName AS itemName,
                                                             imd.itemGujaratiName AS itemGujaratiName,
                                                             imd.itemCode AS inputCode,
                                                             bwid.qty AS qty,
                                                             bwid.unit AS unit,
                                                             bwid.itemPrice AS itemPrice,
                                                             bwid.price AS price,
                                                             bwid.comment AS comment
                                                         FROM
                                                             billing_billWiseItem_data AS bwid
                                                         INNER JOIN item_menuList_data AS imd ON imd.itemId = bwid.itemId
                                                         WHERE bwid.billId = '${billId}'`;
                            let sql_query_getItemWiseAddons = `SELECT
                                                               iwad.iwaId AS iwaId,
                                                               iwad.iwbId AS iwbId,
                                                               iwad.addOnsId AS addOnsId,
                                                               iad.addonsName AS addonsName,
                                                               iad.addonsGujaratiName AS addonsGujaratiName,
                                                               iad.price AS addonPrice
                                                           FROM
                                                               billing_itemWiseAddon_data AS iwad
                                                           LEFT JOIN item_addons_data AS iad ON iad.addonsId = iwad.addOnsId
                                                           WHERE iwad.iwbId IN(SELECT COALESCE(bwid.iwbId, NULL) FROM billing_billWiseItem_data AS bwid WHERE bwid.billId = '${billId}')`;
                            let sql_query_getCustomerInfo = `SELECT
                                                                 bwcd.bwcId AS bwcId,
                                                                 bwcd.customerId AS customerId,
                                                                 bwcd.mobileNo AS mobileNo,
                                                                 bwcd.addressId AS addressId,
                                                                 bwcd.address AS address,
                                                                 bwcd.locality AS locality,
                                                                 bwcd.customerName AS customerName
                                                             FROM
                                                                 billing_billWiseCustomer_data AS bwcd
                                                             WHERE bwcd.billId = '${billId}'`;
                            let sql_query_getFirmData = `SELECT 
                                                        firmId, 
                                                        firmName, 
                                                        gstNumber, 
                                                        firmAddress, 
                                                        pincode, 
                                                        firmMobileNo, 
                                                        otherMobileNo 
                                                     FROM 
                                                        billing_firm_data 
                                                     WHERE 
                                                        firmId = (SELECT firmId FROM billing_data WHERE billId = '${billId}')`;

                            const sql_query_getBillData = `${sql_query_getBillingData};
                                                       ${sql_query_getBillwiseItem};
                                                       ${sql_query_getFirmData};
                                                       ${sql_query_getItemWiseAddons};
                                                       ${['Pick Up', 'Delivery'].includes(billType) ? sql_query_getCustomerInfo : ''}`;
                            return new Promise((resolve, reject) => {
                                pool.query(sql_query_getBillData, (err, billData) => {
                                    if (err) {
                                        console.error("An error occurred in SQL Query", err);
                                        return reject('Database Error');
                                    } else {
                                        const itemsData = billData && billData[1] ? billData[1] : [];
                                        const addonsData = billData && billData[3] ? billData[3] : [];

                                        const newItemJson = itemsData.map(item => {
                                            const itemAddons = addonsData.filter(addon => addon.iwbId === item.iwbId);
                                            return {
                                                ...item,
                                                addons: Object.fromEntries(itemAddons.map(addon => [addon.addOnsId, addon])),
                                                addonPrice: itemAddons.reduce((sum, { price }) => sum + price, 0)
                                            };
                                        });

                                        const json = {
                                            ...billData[0][0],
                                            itemData: newItemJson,
                                            firmData: billData && billData[2] ? billData[2][0] : [],
                                            ...(['Pick Up', 'Delivery'].includes(billType) ? { customerDetails: billData && billData[4][0] ? billData[4][0] : '' } : ''),
                                            ...(['online'].includes(billData[0][0].billPayType) ? {
                                                "upiJson": {
                                                    "onlineId": billData[0][0].onlineId,
                                                    "holderName": billData[0][0].holderName,
                                                    "upiId": billData[0][0].upiId
                                                }
                                            } : '')
                                        }
                                        return resolve(json);
                                    }
                                });
                            });
                        });

                        Promise.all(billDataPromises)
                            .then(results => {
                                return res.status(200).send(results);
                            })
                            .catch(error => {
                                console.error('An error occurred', error);
                                return res.status(500).send('Internal Server Error');
                            });
                    } else {
                        return res.status(404).send('Bills Not Found');
                    }
                }
            });
        } else {
            return res.status(400).send('Please Login First....!');
        }
    } catch (error) {
        console.error('An error occurred', error);
        res.status(500).json('Internal Server Error');
    }
}

// Get Recent Bill Data

const getRecentBillData = (req, res) => {
    try {
        let token;
        token = req.headers ? req.headers.authorization.split(" ")[1] : null;
        if (token) {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const branchId = decoded.id.branchId;
            const billType = req.query.billType;
            const currentDate = getCurrentDate();
            if (!billType) {
                return res.status(404).send('Bill Type Not Found');
            } else {
                let sql_query_getRecentBill = `SELECT 
                                                bd.billId AS billId, 
                                                bd.billNumber AS billNumber,
                                                bd.settledAmount AS totalAmount,
                                                bd.billStatus AS billStatus,
                                                CASE
                                                    WHEN bd.billType = 'Pick Up' THEN CONCAT('P',btd.tokenNo)
                                                    WHEN bd.billType = 'Delivery' THEN CONCAT('D',btd.tokenNo)
                                                ELSE NULL
                                                END AS tokenNo,
                                                CASE
                                                    WHEN bd.billType = 'Pick Up' THEN COALESCE(bwc.customerName, bwc.address, bwc.mobileNo, NULL)
                                                    WHEN bd.billType = 'Delivery' THEN COALESCE(bwc.address, bwc.customerName, bwc.mobileNo, NULL)
                                                ELSE NULL
                                                END AS address,
                                                CASE
                                                    WHEN bd.billType = 'Pick Up' THEN
                                                        TRIM(CONCAT(
                                                            COALESCE(bwc.mobileNo, ''),
                                                            IF(bwc.mobileNo IS NOT NULL AND bwc.customerName IS NOT NULL, ' - ', ''),
                                                            COALESCE(bwc.customerName, ''),
                                                            IF((bwc.mobileNo IS NOT NULL OR bwc.customerName IS NOT NULL) AND bwc.address IS NOT NULL, ' - ', ''),
                                                            COALESCE(bwc.address, ''),
                                                            IF((bwc.mobileNo IS NOT NULL OR bwc.customerName IS NOT NULL OR bwc.address IS NOT NULL) AND bwc.locality IS NOT NULL, ' - ', ''),
                                                            COALESCE(bwc.locality, '')
                                                        ))
                                                    WHEN bd.billType = 'Delivery' THEN
                                                        TRIM(CONCAT(
                                                            COALESCE(bwc.mobileNo, ''),
                                                            IF(bwc.mobileNo IS NOT NULL AND bwc.customerName IS NOT NULL, ' - ', ''),
                                                            COALESCE(bwc.customerName, ''),
                                                            IF((bwc.mobileNo IS NOT NULL OR bwc.customerName IS NOT NULL) AND bwc.address IS NOT NULL, ' - ', ''),
                                                            COALESCE(bwc.address, ''),
                                                            IF((bwc.mobileNo IS NOT NULL OR bwc.customerName IS NOT NULL OR bwc.address IS NOT NULL) AND bwc.locality IS NOT NULL, ' - ', ''),
                                                            COALESCE(bwc.locality, '')
                                                        ))
                                                    ELSE NULL
                                                END AS info
                                           FROM billing_data AS bd
                                           LEFT JOIN billing_token_data AS btd ON btd.billId = bd.billId
                                           LEFT JOIN billing_billWiseCustomer_data AS bwc ON bwc.billId = bd.billId
                                           WHERE bd.billType = '${billType}' AND bd.branchId = '${branchId}' AND bd.billDate = STR_TO_DATE('${currentDate}','%b %d %Y')
                                           ORDER BY btd.tokenNo DESC`;
                pool.query(sql_query_getRecentBill, (err, data) => {
                    if (err) {
                        console.error("An error occurred in SQL Queery", err);
                        return res.status(500).send('Database Error');
                    } else {
                        if (data && data.length) {
                            return res.status(200).send(data);
                        } else {
                            return res.status(404).send('No Data Found');
                        }
                    }
                })
            }
        } else {
            return res.status(400).send('Please Login First....!');
        }
    } catch (error) {
        console.error('An error occurred', error);
        res.status(500).json('Internal Server Error');
    }
}

// Searh Bill Using Token No

const getBillDataByToken = (req, res) => {
    try {
        let token;
        token = req.headers ? req.headers.authorization.split(" ")[1] : null;
        if (token) {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const branchId = decoded.id.branchId;
            const billId = req.query.billId;
            const tokenNo = req.query.tokenNo;
            if (!tokenNo) {
                return res.status(404).send('Token Not Found');
            } else {
                const matches = tokenNo.match(/([A-Za-z]+)(\d+)/);
                if (matches) {
                    const result = [matches[1], parseInt(matches[2])];
                    const billType = getCategory(result[0]);
                    const currentDate = getCurrentDate();
                    if (billType) {
                        let sql_query_getRecentBill = `SELECT 
                                                        bd.billId AS billId, 
                                                        bd.billNumber AS billNumber,
                                                        bd.totalAmount AS totalAmount,
                                                        CASE
                                                            WHEN bd.billType = 'Pick Up' THEN CONCAT('P',btd.tokenNo)
                                                            WHEN bd.billType = 'Delivery' THEN CONCAT('D',btd.tokenNo)
                                                        ELSE NULL
                                                        END AS tokenNo 
                                                   FROM billing_data AS bd
                                                   LEFT JOIN billing_token_data AS btd ON btd.billId = bd.billId
                                                   WHERE bd.billType = '${billType}' AND bd.branchId = '${branchId}' AND bd.billDate = STR_TO_DATE('${currentDate}','%b %d %Y')
                                                   ORDER BY btd.tokenNo DESC`;
                        pool.query(sql_query_getRecentBill, (err, data) => {
                            if (err) {
                                console.error("An error occurred in SQL Queery", err);
                                return res.status(500).send('Database Error');
                            } else {
                                if (data && data.length) {
                                    const isBillId = data.filter((e) => {
                                        if (e.tokenNo.toUpperCase() == tokenNo.toUpperCase()) {
                                            return e.billId;
                                        } else {
                                            null
                                        }
                                    });
                                    const billId = isBillId && isBillId[0] ? isBillId[0].billId : null;
                                    if (billId) {
                                        let sql_query_getBillingData = `SELECT 
                                                                            bd.billId AS billId, 
                                                                            bd.billNumber AS billNumber,
                                                                            bd.branchId AS branchId,
                                                                            COALESCE(bod.billNumber, CONCAT('C', bcd.billNumber), 'Not Available') AS officialBillNo,
                                                                            CASE
                                                                                WHEN bd.billType = 'Pick Up' THEN CONCAT('P',btd.tokenNo)
                                                                                WHEN bd.billType = 'Delivery' THEN CONCAT('D',btd.tokenNo)
                                                                                ELSE NULL
                                                                            END AS tokenNo,
                                                                            bwu.onlineId AS onlineId,
                                                                            boud.holderName AS holderName,
                                                                            boud.upiId AS upiId,
                                                                            bd.firmId AS firmId, 
                                                                            bd.cashier AS cashier, 
                                                                            bd.menuStatus AS menuStatus, 
                                                                            bd.billType AS billType, 
                                                                            bd.billPayType AS billPayType, 
                                                                            bd.discountType AS discountType, 
                                                                            bd.discountValue AS discountValue, 
                                                                            bd.totalDiscount AS totalDiscount, 
                                                                            bd.totalAmount AS totalAmount, 
                                                                            bd.settledAmount AS settledAmount, 
                                                                            bd.billComment AS billComment, 
                                                                            DATE_FORMAT(bd.billDate,'%d/%m/%Y') AS billDate,
                                                                            bd.billStatus AS billStatus,
                                                                            DATE_FORMAT(bd.billCreationDate,'%h:%i %p') AS billTime
                                                                        FROM 
                                                                            billing_data AS bd
                                                                        LEFT JOIN billing_Official_data AS bod ON bod.billId = bd.billId
                                                                        LEFT JOIN billing_Complimentary_data AS bcd ON bcd.billId = bd.billId
                                                                        LEFT JOIN billing_token_data AS btd ON btd.billId = bd.billId
                                                                        LEFT JOIN billing_firm_data AS bfd ON bfd.firmId = bd.firmId
                                                                        LEFT JOIN billing_billWiseUpi_data AS bwu ON bwu.billId = bd.billId
                                                                        LEFT JOIN billing_onlineUPI_data AS boud ON boud.onlineId = bwu.onlineId
                                                                        WHERE bd.billId = '${billId}'`;
                                        let sql_query_getBillwiseItem = `SELECT
                                                                             bwid.iwbId AS iwbId,
                                                                             bwid.itemId AS itemId,
                                                                             imd.itemName AS itemName,
                                                                             imd.itemGujaratiName AS itemGujaratiName,
                                                                             imd.itemCode AS inputCode,
                                                                             bwid.qty AS qty,
                                                                             bwid.unit AS unit,
                                                                             bwid.itemPrice AS itemPrice,
                                                                             bwid.price AS price,
                                                                             bwid.comment AS comment
                                                                         FROM
                                                                             billing_billWiseItem_data AS bwid
                                                                         INNER JOIN item_menuList_data AS imd ON imd.itemId = bwid.itemId
                                                                         WHERE bwid.billId = '${billId}'`;
                                        let sql_query_getItemWiseAddons = `SELECT
                                                                               iwad.iwaId AS iwaId,
                                                                               iwad.iwbId AS iwbId,
                                                                               iwad.addOnsId AS addOnsId,
                                                                               iad.addonsName AS addonsName,
                                                                               iad.addonsGujaratiName AS addonsGujaratiName,
                                                                               iad.price AS addonPrice
                                                                           FROM
                                                                               billing_itemWiseAddon_data AS iwad
                                                                           LEFT JOIN item_addons_data AS iad ON iad.addonsId = iwad.addOnsId
                                                                           WHERE iwad.iwbId IN(SELECT COALESCE(bwid.iwbId, NULL) FROM billing_billWiseItem_data AS bwid WHERE bwid.billId = '${billId}')`;
                                        let sql_query_getCustomerInfo = `SELECT
                                                                             bwcd.bwcId AS bwcId,
                                                                             bwcd.customerId AS customerId,
                                                                             bwcd.mobileNo AS mobileNo,
                                                                             bwcd.addressId AS addressId,
                                                                             bwcd.address AS address,
                                                                             bwcd.locality AS locality,
                                                                             bwcd.customerName AS customerName
                                                                         FROM
                                                                             billing_billWiseCustomer_data AS bwcd
                                                                         WHERE bwcd.billId = '${billId}'`;
                                        let sql_query_getFirmData = `SELECT 
                                                                        firmId, 
                                                                        firmName, 
                                                                        gstNumber, 
                                                                        firmAddress, 
                                                                        pincode, 
                                                                        firmMobileNo, 
                                                                        otherMobileNo 
                                                                     FROM 
                                                                        billing_firm_data 
                                                                     WHERE 
                                                                        firmId = (SELECT firmId FROM billing_data WHERE billId = '${billId}')`;

                                        const sql_query_getBillData = `${sql_query_getBillingData};
                                                       ${sql_query_getBillwiseItem};
                                                       ${sql_query_getFirmData};
                                                       ${sql_query_getItemWiseAddons};
                                                       ${['Pick Up', 'Delivery'].includes(billType) ? sql_query_getCustomerInfo : ''}`;
                                        pool.query(sql_query_getBillData, (err, billData) => {
                                            if (err) {
                                                console.error("An error occurred in SQL Queery", err);
                                                return res.status(500).send('Database Error'); t
                                            } else {
                                                const itemsData = billData && billData[1] ? billData[1] : [];
                                                const addonsData = billData && billData[3] ? billData[3] : [];

                                                const newItemJson = itemsData.map(item => {
                                                    const itemAddons = addonsData.filter(addon => addon.iwbId === item.iwbId);
                                                    return {
                                                        ...item,
                                                        addons: Object.fromEntries(itemAddons.map(addon => [addon.addOnsId, addon])),
                                                        addonPrice: itemAddons.reduce((sum, { price }) => sum + price, 0)
                                                    };
                                                });

                                                const json = {
                                                    ...billData[0][0],
                                                    itemData: newItemJson,
                                                    firmData: billData && billData[2] ? billData[2][0] : [],
                                                    ...(['Pick Up', 'Delivery'].includes(billType) ? { customerDetails: billData && billData[4][0] ? billData[4][0] : '' } : ''),
                                                    ...(['online'].includes(billData[0][0].billPayType) ? {
                                                        "upiJson": {
                                                            "onlineId": billData[0][0].onlineId,
                                                            "holderName": billData[0][0].holderName,
                                                            "upiId": billData[0][0].upiId
                                                        }
                                                    } : '')
                                                }
                                                return res.status(200).send(json);
                                            }
                                        })
                                    } else {
                                        return res.status(404).send('Token Number Not Found');
                                    }
                                } else {
                                    return res.status(404).send('No Data Found');
                                }
                            }
                        })
                    } else {
                        return res.status(404).send('Token Bill Type Not Found');
                    }
                } else {
                    return res.status(400).send('Token Format is Incorrect');
                }
            }
        } else {
            return res.status(400).send('Please Login First....!');
        }
    } catch (error) {
        console.error('An error occurred', error);
        res.status(500).json('Internal Server Error');
    }
}

// Fill Bill Data By Id

const getBillDataById = (req, res) => {
    try {
        let token;
        token = req.headers ? req.headers.authorization.split(" ")[1] : null;
        if (token) {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const branchId = decoded.id.branchId;
            const billId = req.query.billId;
            if (!billId) {
                return res.status(404).send('billId Not Found');
            } else {
                let sql_query_chkBillExist = `SELECT billId, billType, billPayType FROM billing_data WHERE billId = '${billId}' AND branchId = '${branchId}'`;
                pool.query(sql_query_chkBillExist, (err, bill) => {
                    if (err) {
                        console.error("An error occurred in SQL Queery", err);
                        return res.status(500).send('Database Error');
                    } else {
                        if (bill && bill.length) {
                            const billType = bill[0].billType;
                            const billPayType = bill[0].billPayType;
                            let sql_query_getBillingData = `SELECT 
                                                            bd.billId AS billId, 
                                                            bd.billNumber AS billNumber,
                                                            bd.branchId AS branchId,
                                                            COALESCE(bod.billNumber, CONCAT('C', bcd.billNumber), 'Not Available') AS officialBillNo,
                                                            CASE
                                                                WHEN bd.billType = 'Pick Up' THEN CONCAT('P',btd.tokenNo)
                                                                WHEN bd.billType = 'Delivery' THEN CONCAT('D',btd.tokenNo)
                                                                ELSE NULL
                                                            END AS tokenNo,
                                                            bwu.onlineId AS onlineId,
                                                            boud.holderName AS holderName,
                                                            boud.upiId AS upiId,
                                                            bd.firmId AS firmId, 
                                                            bd.cashier AS cashier, 
                                                            bd.menuStatus AS menuStatus, 
                                                            bd.billType AS billType, 
                                                            bd.billPayType AS billPayType, 
                                                            bd.discountType AS discountType, 
                                                            bd.discountValue AS discountValue, 
                                                            bd.totalDiscount AS totalDiscount, 
                                                            bd.totalAmount AS totalAmount, 
                                                            bd.settledAmount AS settledAmount, 
                                                            bd.billComment AS billComment, 
                                                            DATE_FORMAT(bd.billDate,'%d/%m/%Y') AS billDate,
                                                            bd.billStatus AS billStatus,
                                                            DATE_FORMAT(bd.billCreationDate,'%h:%i %p') AS billTime
                                                        FROM 
                                                            billing_data AS bd
                                                        LEFT JOIN billing_Official_data AS bod ON bod.billId = bd.billId
                                                        LEFT JOIN billing_Complimentary_data AS bcd ON bcd.billId = bd.billId
                                                        LEFT JOIN billing_token_data AS btd ON btd.billId = bd.billId
                                                        LEFT JOIN billing_firm_data AS bfd ON bfd.firmId = bd.firmId
                                                        LEFT JOIN billing_billWiseUpi_data AS bwu ON bwu.billId = bd.billId
                                                        LEFT JOIN billing_onlineUPI_data AS boud ON boud.onlineId = bwu.onlineId
                                                        WHERE bd.billId = '${billId}'`;
                            let sql_query_getBillwiseItem = `SELECT
                                                             bwid.iwbId AS iwbId,
                                                             bwid.itemId AS itemId,
                                                             imd.itemName AS itemName,
                                                             imd.itemGujaratiName AS itemGujaratiName,
                                                             imd.itemCode AS inputCode,
                                                             bwid.qty AS qty,
                                                             bwid.unit AS unit,
                                                             bwid.itemPrice AS itemPrice,
                                                             bwid.price AS price,
                                                             bwid.comment AS comment
                                                         FROM
                                                             billing_billWiseItem_data AS bwid
                                                         INNER JOIN item_menuList_data AS imd ON imd.itemId = bwid.itemId
                                                         WHERE bwid.billId = '${billId}'`;
                            let sql_query_getItemWiseAddons = `SELECT
                                                                   iwad.iwaId AS iwaId,
                                                                   iwad.iwbId AS iwbId,
                                                                   iwad.addOnsId AS addOnsId,
                                                                   iad.addonsName AS addonsName,
                                                                   iad.addonsGujaratiName AS addonsGujaratiName,
                                                                   iad.price AS addonPrice
                                                               FROM
                                                                   billing_itemWiseAddon_data AS iwad
                                                               LEFT JOIN item_addons_data AS iad ON iad.addonsId = iwad.addOnsId
                                                               WHERE iwad.iwbId IN(SELECT COALESCE(bwid.iwbId, NULL) FROM billing_billWiseItem_data AS bwid WHERE bwid.billId = '${billId}')`;
                            let sql_query_getCustomerInfo = `SELECT
                                                             bwcd.bwcId AS bwcId,
                                                             bwcd.customerId AS customerId,
                                                             bwcd.mobileNo AS mobileNo,
                                                             bwcd.addressId AS addressId,
                                                             bwcd.address AS address,
                                                             bwcd.locality AS locality,
                                                             bwcd.customerName AS customerName
                                                         FROM
                                                             billing_billWiseCustomer_data AS bwcd
                                                         WHERE bwcd.billId = '${billId}'`;
                            let sql_query_getFirmData = `SELECT 
                                                            firmId, 
                                                            firmName, 
                                                            gstNumber, 
                                                            firmAddress, 
                                                            pincode, 
                                                            firmMobileNo, 
                                                            otherMobileNo 
                                                         FROM 
                                                            billing_firm_data 
                                                         WHERE 
                                                            firmId = (SELECT firmId FROM billing_data WHERE billId = '${billId}')`;

                            const sql_query_getBillData = `${sql_query_getBillingData};
                                                           ${sql_query_getBillwiseItem};
                                                           ${sql_query_getFirmData};
                                                           ${sql_query_getItemWiseAddons};
                                                           ${['Pick Up', 'Delivery'].includes(billType) ? sql_query_getCustomerInfo : ''}`;
                            pool.query(sql_query_getBillData, (err, billData) => {
                                if (err) {
                                    console.error("An error occurred in SQL Queery", err);
                                    return res.status(500).send('Database Error'); t
                                } else {

                                    const itemsData = billData && billData[1] ? billData[1] : [];
                                    const addonsData = billData && billData[3] ? billData[3] : [];

                                    const newItemJson = itemsData.map(item => {
                                        const itemAddons = addonsData.filter(addon => addon.iwbId === item.iwbId);
                                        return {
                                            ...item,
                                            addons: Object.fromEntries(itemAddons.map(addon => [addon.addOnsId, addon])),
                                            addonPrice: itemAddons.reduce((sum, { price }) => sum + price, 0)
                                        };
                                    });

                                    const json = {
                                        ...billData[0][0],
                                        itemData: newItemJson,
                                        firmData: billData && billData[2] ? billData[2][0] : [],
                                        ...(['Pick Up', 'Delivery'].includes(billType) ? { customerDetails: billData && billData[4][0] ? billData[4][0] : '' } : ''),
                                        ...(['online'].includes(billPayType) ? {
                                            "upiJson": {
                                                "onlineId": billData[0][0].onlineId,
                                                "holderName": billData[0][0].holderName,
                                                "upiId": billData[0][0].upiId
                                            }
                                        } : '')
                                    }
                                    return res.status(200).send(json);
                                }
                            })
                        } else {
                            return res.status(404).send('Bill Id Not Found');
                        }
                    }
                })
            }
        } else {
            return res.status(400).send('Please Login First....!');
        }
    } catch (error) {
        console.error('An error occurred', error);
        res.status(500).json('Internal Server Error');
    }
}

// Add PickUp Bill Data

const addPickUpBillData = (req, res) => {
    pool2.getConnection((err, connection) => {
        if (err) {
            console.error("Error getting database connection:", err);
            return res.status(500).send('Database Error');
        }
        try {
            connection.beginTransaction((err) => {
                if (err) {
                    console.error("Error beginning transaction:", err);
                    connection.release();
                    return res.status(500).send('Database Error');
                } else {
                    let token;
                    token = req.headers ? req.headers.authorization.split(" ")[1] : null;
                    if (token) {
                        const decoded = jwt.verify(token, process.env.JWT_SECRET);
                        const cashier = decoded.id.firstName;
                        const branchId = decoded.id.branchId;

                        const currentDate = getCurrentDate();
                        const billData = req.body;
                        console.log('customerDetails', billData.customerDetails,
                            'BID', branchId,
                            'FID', billData.firmId,
                            'subTotal', billData.subTotal,
                            'settledAmount', billData.settledAmount,
                            'billPayType', billData.billPayType,
                            'billStatus', billData.billStatus,
                            'itemsData', billData.itemsData)
                        if (!billData.customerDetails || !branchId || !billData.firmId || !billData.subTotal || !billData.settledAmount || !billData.billPayType || !billData.billStatus || !billData.itemsData) {
                            connection.rollback(() => {
                                connection.release();
                                return res.status(404).send('Please Fill All The Fields..!');
                            })
                        } else {
                            const isComplimentary = billData.billPayType == 'complimentary' ? true : false;
                            let sql_query_getOfficialLastBillNo = `SELECT COALESCE(MAX(billNumber),0) AS officialLastBillNo FROM billing_Official_data WHERE firmId = '${billData.firmId}' AND billCreationDate = (SELECT MAX(billCreationDate) FROM billing_Official_data WHERE firmId = '${billData.firmId}') FOR UPDATE`;
                            let sql_query_getComplimentaryLastBillNo = `SELECT COALESCE(MAX(billNumber),0) AS complimentaryBillNo FROM billing_Complimentary_data WHERE firmId = '${billData.firmId}' AND billCreationDate = (SELECT MAX(billCreationDate) FROM billing_Complimentary_data WHERE firmId = '${billData.firmId}') FOR UPDATE`;
                            let sql_query_getLastBillNo = `SELECT COALESCE(MAX(billNumber),0) AS lastBillNo FROM billing_data WHERE firmId = '${billData.firmId}' AND billCreationDate = (SELECT MAX(billCreationDate) FROM billing_data WHERE firmId = '${billData.firmId}') FOR UPDATE;
                                                           SELECT COALESCE(MAX(tokenNo),0) AS lastTokenNo FROM billing_token_data WHERE billType = '${billData.billType}' AND branchId = '${branchId}' AND billDate = STR_TO_DATE('${currentDate}','%b %d %Y') FOR UPDATE;
                                                           ${billData.isOfficial && !isComplimentary ? sql_query_getOfficialLastBillNo : isComplimentary ? sql_query_getComplimentaryLastBillNo : ''}`;
                            connection.query(sql_query_getLastBillNo, (err, result) => {
                                if (err) {
                                    console.error("Error selecting last bill and token number:", err);
                                    connection.rollback(() => {
                                        connection.release();
                                        return res.status(500).send('Database Error');
                                    });
                                } else {
                                    const lastBillNo = result && result[0] && result[0][0].lastBillNo ? result[0][0].lastBillNo : 0;
                                    const lastTokenNo = result && result[0] && result[1][0].lastTokenNo ? result[1][0].lastTokenNo : 0;
                                    const officialLastBillNo = result && result[2] && result[2][0].officialLastBillNo ? result[2][0].officialLastBillNo : result && result[2] && result[2][0].complimentaryBillNo ? result[2][0].complimentaryBillNo : 0;

                                    const nextBillNo = lastBillNo + 1;
                                    const nextOfficialBillNo = officialLastBillNo + 1;
                                    const nextTokenNo = lastTokenNo + 1;
                                    const uid1 = new Date();
                                    const billId = String("bill_" + uid1.getTime() + '_' + nextBillNo);
                                    const tokenId = String("token_" + uid1.getTime() + '_' + nextTokenNo);
                                    const bwcId = String("bwc_" + uid1.getTime() + '_' + nextTokenNo);
                                    const newCustomerId = String("customer_" + uid1.getTime());
                                    const newAddressId = String("addressId_" + uid1.getTime());
                                    const bwuId = String("bwu_" + uid1.getTime());
                                    const dabId = String("dab_" + uid1.getTime());

                                    const columnData = `billId,
                                                        firmId,
                                                        branchId,
                                                        cashier,
                                                        menuStatus,
                                                        billType,
                                                        billPayType,
                                                        discountType,
                                                        discountValue,
                                                        totalDiscount,
                                                        totalAmount,
                                                        settledAmount,
                                                        billComment,
                                                        billDate,
                                                        billStatus`;
                                    const values = `'${billId}',
                                                   '${billData.firmId}', 
                                                   '${branchId}',
                                                   '${cashier}', 
                                                   'Offline',
                                                   'Pick Up',
                                                   '${billData.billPayType}',
                                                   '${billData.discountType}',
                                                   ${billData.discountValue},
                                                   ${billData.totalDiscount},
                                                   ${billData.subTotal},
                                                   ${billData.settledAmount},
                                                   ${billData.billComment ? `'${billData.billComment}'` : null},
                                                   STR_TO_DATE('${currentDate}','%b %d %Y'),
                                                   '${billData.billStatus}'`;

                                    let sql_querry_addBillInfo = `INSERT INTO billing_data (billNumber,${columnData}) VALUES (${nextBillNo}, ${values})`;
                                    let sql_querry_addOfficialData = `INSERT INTO billing_Official_data (billNumber, ${columnData}) VALUES(${nextOfficialBillNo}, ${values})`;
                                    let sql_querry_addComplimentaryData = `INSERT INTO billing_Complimentary_data (billNumber, ${columnData}) VALUES(${nextOfficialBillNo}, ${values})`;
                                    let sql_querry_addBillData = `${sql_querry_addBillInfo};
                                                                  ${billData.isOfficial && !isComplimentary ? sql_querry_addOfficialData : isComplimentary ? sql_querry_addComplimentaryData : ''}`;
                                    connection.query(sql_querry_addBillData, (err) => {
                                        if (err) {
                                            console.error("Error inserting new bill number:", err);
                                            connection.rollback(() => {
                                                connection.release();
                                                return res.status(500).send('Database Error');
                                            });
                                        } else {
                                            let sql_query_addTokenNo = `INSERT INTO billing_token_data(tokenId, billId, branchId, tokenNo, billType, billDate)
                                                                        VALUES ('${tokenId}', '${billId}', '${branchId}', ${nextTokenNo}, '${billData.billType}', STR_TO_DATE('${currentDate}','%b %d %Y'))`;
                                            connection.query(sql_query_addTokenNo, (err) => {
                                                if (err) {
                                                    console.error("Error inserting new Token number:", err);
                                                    connection.rollback(() => {
                                                        connection.release();
                                                        return res.status(500).send('Database Error');
                                                    });
                                                } else {
                                                    const billItemData = billData.itemsData

                                                    const addBillWiseItemData = [];
                                                    const addItemWiseAddonData = [];

                                                    billItemData.forEach((item, index) => {
                                                        let uniqueId = `iwb_${Date.now() + index}_${index}`; // Unique ID generation

                                                        // Construct SQL_Add_1 for the main item
                                                        addBillWiseItemData.push(`('${uniqueId}', '${billId}', '${branchId}', '${item.itemId}', ${item.qty}, '${item.unit}', ${item.itemPrice}, ${item.price}, ${item.comment ? `'${item.comment}'` : null}, 'Pick Up', '${billData.billPayType}', '${billData.billStatus}', STR_TO_DATE('${currentDate}','%b %d %Y'))`);

                                                        // Construct SQL_Add_2 for the addons
                                                        const allAddons = item.addons ? Object.keys(item.addons) : []
                                                        if (allAddons && allAddons.length) {
                                                            allAddons.forEach((addonId, addonIndex) => {
                                                                let iwaId = `iwa_${Date.now() + addonIndex + index}_${index}`; // Unique ID for each addon
                                                                addItemWiseAddonData.push(`('${iwaId}', '${uniqueId}', '${addonId}')`);
                                                            });
                                                        }
                                                    });

                                                    let sql_query_addItems = `INSERT INTO billing_billWiseItem_data(iwbId, billId, branchId, itemId, qty, unit, itemPrice, price, comment, billType, billPayType, billStatus, billDate)
                                                                              VALUES ${addBillWiseItemData.join(", ")}`;
                                                    connection.query(sql_query_addItems, (err) => {
                                                        if (err) {
                                                            console.error("Error inserting Bill Wise Item Data:", err);
                                                            connection.rollback(() => {
                                                                connection.release();
                                                                return res.status(500).send('Database Error');
                                                            });
                                                        } else {
                                                            let sql_query_getFirmData = `SELECT firmId, firmName, gstNumber, firmAddress, pincode, firmMobileNo, otherMobileNo FROM billing_firm_data WHERE firmId = '${billData.firmId}';
                                                                                         SELECT
                                                                                           btd.tokenNo,
                                                                                           bd.billStatus,
                                                                                           bd.billId,
                                                                                           bd.settledAmount,
                                                                                           SEC_TO_TIME(
                                                                                               TIMESTAMPDIFF(
                                                                                                   SECOND,
                                                                                                   bd.billCreationDate,
                                                                                                   NOW()
                                                                                               )
                                                                                           ) AS timeDifference
                                                                                         FROM billing_token_data AS btd
                                                                                         LEFT JOIN billing_data AS bd ON bd.billId = btd.billId
                                                                                         WHERE btd.billType = 'Pick Up' AND bd.billStatus NOT IN ('complete','Cancel') AND btd.billDate = STR_TO_DATE('${currentDate}','%b %d %Y')
                                                                                         ORDER BY btd.tokenNo ASC;
                                                                    ${addItemWiseAddonData.length
                                                                    ?
                                                                    `INSERT INTO billing_itemWiseAddon_data (iwaId, iwbId, addOnsId) VALUES ${addItemWiseAddonData.join(", ")};`
                                                                    :
                                                                    ''}
                                                                    ${billData.billPayType == 'online' && billData.onlineId && billData.onlineId != 'other'
                                                                    ?
                                                                    `INSERT INTO billing_billWiseUpi_data(bwuId, onlineId, billId, amount, onlineDate)
                                                                     VALUES('${bwuId}', '${billData.onlineId}', '${billId}', '${billData.settledAmount}', STR_TO_DATE('${currentDate}','%b %d %Y'))`
                                                                    :
                                                                    billData.accountId && billData.billPayType == 'due'
                                                                        ?
                                                                        `INSERT INTO due_billAmount_data(dabId, enterBy, accountId, billId, billAmount, dueNote, dueDate)
                                                                         VALUES('${dabId}','${cashier}','${billData.accountId}','${billId}',${billData.settledAmount},${billData.dueNote ? `'${billData.dueNote}'` : null}, STR_TO_DATE('${currentDate}','%b %d %Y'))`
                                                                        :
                                                                        ''}`;
                                                            connection.query(sql_query_getFirmData, (err, firm) => {
                                                                if (err) {
                                                                    console.error("Error inserting Bill Wise Item Data:", err);
                                                                    connection.rollback(() => {
                                                                        connection.release();
                                                                        return res.status(500).send('Database Error');
                                                                    });
                                                                } else {
                                                                    const sendJson = {
                                                                        ...billData,
                                                                        firmData: firm[0][0],
                                                                        cashier: cashier,
                                                                        billNo: nextBillNo,
                                                                        officialBillNo: billData.isOfficial && !isComplimentary ? nextOfficialBillNo : isComplimentary ? 'C' + nextOfficialBillNo : 'Not Available',
                                                                        tokenNo: 'P' + nextTokenNo,
                                                                        justToken: nextTokenNo,
                                                                        billDate: new Date(currentDate).toLocaleDateString('en-GB'),
                                                                        billTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                                                    }
                                                                    console.log(sendJson);
                                                                    const tokenList = firm && firm[1].length ? firm[1] : null;
                                                                    const customerData = billData.customerDetails;
                                                                    if (customerData && customerData.customerId && customerData.addressId) {
                                                                        let sql_query_addAddressRelation = `INSERT INTO billing_billWiseCustomer_data(bwcId, billId, customerId, addressId, mobileNo, customerName, address, locality)
                                                                                                            VALUES ('${bwcId}', '${billId}', '${customerData.customerId}', '${customerData.addressId}', ${customerData.mobileNo ? `TRIM('${customerData.mobileNo}')` : null}, ${customerData.customerName ? `TRIM('${customerData.customerName}')` : null}, ${customerData.address ? `'${customerData.address}'` : null}, ${customerData.locality ? `'${customerData.locality}'` : null})`;
                                                                        connection.query(sql_query_addAddressRelation, (err) => {
                                                                            if (err) {
                                                                                console.error("Error inserting Customer Bill Wise Data:", err);
                                                                                connection.rollback(() => {
                                                                                    connection.release();
                                                                                    return res.status(500).send('Database Error');
                                                                                });
                                                                            } else {
                                                                                connection.commit((err) => {
                                                                                    if (err) {
                                                                                        console.error("Error committing transaction:", err);
                                                                                        connection.rollback(() => {
                                                                                            connection.release();
                                                                                            return res.status(500).send('Database Error');
                                                                                        });
                                                                                    } else {
                                                                                        connection.release();
                                                                                        req?.io?.emit('getTokenList', tokenList);
                                                                                        return res.status(200).send(sendJson);
                                                                                    }
                                                                                });
                                                                            }
                                                                        });
                                                                    } else if (customerData && customerData.customerId && customerData.address?.trim()) {
                                                                        let sql_queries_chkOldAdd = `SELECT addressId, customerId FROM billing_customerAddress_data WHERE customerAddress = TRIM('${customerData.address}') AND customerLocality = '${customerData.locality}'`;
                                                                        connection.query(sql_queries_chkOldAdd, (err, oldAdd) => {
                                                                            if (err) {
                                                                                console.error("Error inserting Customer New Address:", err);
                                                                                connection.rollback(() => {
                                                                                    connection.release();
                                                                                    return res.status(500).send('Database Error');
                                                                                });
                                                                            } else {
                                                                                if (oldAdd && oldAdd[0]) {
                                                                                    const existAddressId = oldAdd[0].addressId;
                                                                                    let sql_query_addAddressRelation = `INSERT INTO billing_billWiseCustomer_data(bwcId, billId, customerId, addressId, mobileNo, customerName, address, locality)
                                                                                                                        VALUES ('${bwcId}', '${billId}', '${customerData.customerId}', '${existAddressId}', ${customerData.mobileNo ? `TRIM('${customerData.mobileNo}')` : null}, ${customerData.customerName ? `TRIM('${customerData.customerName}')` : null}, ${customerData.address ? `'${customerData.address}'` : null}, ${customerData.locality ? `'${customerData.locality}'` : null})`;
                                                                                    connection.query(sql_query_addAddressRelation, (err) => {
                                                                                        if (err) {
                                                                                            console.error("Error inserting Customer Bill Wise Data:", err);
                                                                                            connection.rollback(() => {
                                                                                                connection.release();
                                                                                                return res.status(500).send('Database Error');
                                                                                            });
                                                                                        } else {
                                                                                            connection.commit((err) => {
                                                                                                if (err) {
                                                                                                    console.error("Error committing transaction:", err);
                                                                                                    connection.rollback(() => {
                                                                                                        connection.release();
                                                                                                        return res.status(500).send('Database Error');
                                                                                                    });
                                                                                                } else {
                                                                                                    connection.release();
                                                                                                    req?.io?.emit('getTokenList', tokenList);
                                                                                                    return res.status(200).send(sendJson);
                                                                                                }
                                                                                            });
                                                                                        }
                                                                                    });
                                                                                } else {
                                                                                    let sql_querry_addNewAddress = `INSERT INTO billing_customerAddress_data(addressId, customerId, customerAddress, customerLocality)
                                                                                                                    VALUES ('${newAddressId}', '${customerData.customerId}', TRIM('${customerData.address}'), ${customerData.locality ? `TRIM('${customerData.locality}')` : null})`;
                                                                                    connection.query(sql_querry_addNewAddress, (err) => {
                                                                                        if (err) {
                                                                                            console.error("Error inserting Customer New Address:", err);
                                                                                            connection.rollback(() => {
                                                                                                connection.release();
                                                                                                return res.status(500).send('Database Error');
                                                                                            });
                                                                                        } else {
                                                                                            let sql_query_addAddressRelation = `INSERT INTO billing_billWiseCustomer_data(bwcId, billId, customerId, addressId, mobileNo, customerName, address, locality)
                                                                                                                                VALUES ('${bwcId}', '${billId}', '${customerData.customerId}', '${newAddressId}', ${customerData.mobileNo ? `TRIM('${customerData.mobileNo}')` : null}, ${customerData.customerName ? `TRIM('${customerData.customerName}')` : null}, ${customerData.address ? `'${customerData.address}'` : null}, ${customerData.locality ? `'${customerData.locality}'` : null})`;
                                                                                            connection.query(sql_query_addAddressRelation, (err) => {
                                                                                                if (err) {
                                                                                                    console.error("Error inserting Customer Bill Wise Data:", err);
                                                                                                    connection.rollback(() => {
                                                                                                        connection.release();
                                                                                                        return res.status(500).send('Database Error');
                                                                                                    });
                                                                                                } else {
                                                                                                    connection.commit((err) => {
                                                                                                        if (err) {
                                                                                                            console.error("Error committing transaction:", err);
                                                                                                            connection.rollback(() => {
                                                                                                                connection.release();
                                                                                                                return res.status(500).send('Database Error');
                                                                                                            });
                                                                                                        } else {
                                                                                                            connection.release();
                                                                                                            req?.io?.emit('getTokenList', tokenList);
                                                                                                            return res.status(200).send(sendJson);
                                                                                                        }
                                                                                                    });
                                                                                                }
                                                                                            });
                                                                                        }
                                                                                    })
                                                                                }
                                                                            }
                                                                        });
                                                                    } else if (customerData && customerData.customerId) {
                                                                        let sql_query_addAddressRelation = `INSERT INTO billing_billWiseCustomer_data(bwcId, billId, customerId, addressId, mobileNo, customerName, address, locality)
                                                                                                            VALUES ('${bwcId}', '${billId}', '${customerData.customerId}', ${customerData.addressId ? `'${customerData.addressId}'` : null}, ${customerData.mobileNo ? `TRIM('${customerData.mobileNo}')` : null}, ${customerData.customerName ? `TRIM('${customerData.customerName}')` : null}, ${customerData.address ? `'${customerData.address}'` : null}, ${customerData.locality ? `'${customerData.locality}'` : null})`;
                                                                        connection.query(sql_query_addAddressRelation, (err) => {
                                                                            if (err) {
                                                                                console.error("Error inserting Customer Bill Wise Data:", err);
                                                                                connection.rollback(() => {
                                                                                    connection.release();
                                                                                    return res.status(500).send('Database Error');
                                                                                });
                                                                            } else {
                                                                                connection.commit((err) => {
                                                                                    if (err) {
                                                                                        console.error("Error committing transaction:", err);
                                                                                        connection.rollback(() => {
                                                                                            connection.release();
                                                                                            return res.status(500).send('Database Error');
                                                                                        });
                                                                                    } else {
                                                                                        connection.release();
                                                                                        req?.io?.emit('getTokenList', tokenList);
                                                                                        return res.status(200).send(sendJson);
                                                                                    }
                                                                                });
                                                                            }
                                                                        });
                                                                    } else {
                                                                        if (customerData && (customerData.customerName || customerData.mobileNo)) {
                                                                            let sql_querry_getExistCustomer = `SELECT customerId, customerMobileNumber FROM billing_customer_data WHERE customerMobileNumber = '${customerData.mobileNo}'`;
                                                                            connection.query(sql_querry_getExistCustomer, (err, num) => {
                                                                                if (err) {
                                                                                    console.error("Error Get Existing Customer Data:", err);
                                                                                    connection.rollback(() => {
                                                                                        connection.release();
                                                                                        return res.status(500).send('Database Error');
                                                                                    });
                                                                                } else {
                                                                                    const existCustomerId = num && num[0] ? num[0].customerId : null;
                                                                                    if (existCustomerId && customerData.address) {
                                                                                        let sql_queries_chkOldAdd = `SELECT addressId, customerId FROM billing_customerAddress_data WHERE customerAddress = TRIM('${customerData.address}') AND customerLocality = '${customerData.locality}'`;
                                                                                        connection.query(sql_queries_chkOldAdd, (err, oldAdd) => {
                                                                                            if (err) {
                                                                                                console.error("Error inserting Customer New Address:", err);
                                                                                                connection.rollback(() => {
                                                                                                    connection.release();
                                                                                                    return res.status(500).send('Database Error');
                                                                                                });
                                                                                            } else {
                                                                                                if (oldAdd && oldAdd[0]) {
                                                                                                    const existAddressId = oldAdd[0].addressId;
                                                                                                    let sql_query_addAddressRelation = `INSERT INTO billing_billWiseCustomer_data(bwcId, billId, customerId, addressId, mobileNo, customerName, address, locality)
                                                                                                                                        VALUES ('${bwcId}', '${billId}', '${existCustomerId}', '${existAddressId}', ${customerData.mobileNo ? `TRIM('${customerData.mobileNo}')` : null}, ${customerData.customerName ? `TRIM('${customerData.customerName}')` : null}, ${customerData.address ? `'${customerData.address}'` : null}, ${customerData.locality ? `'${customerData.locality}'` : null})`;
                                                                                                    connection.query(sql_query_addAddressRelation, (err) => {
                                                                                                        if (err) {
                                                                                                            console.error("Error inserting Customer Bill Wise Data:", err);
                                                                                                            connection.rollback(() => {
                                                                                                                connection.release();
                                                                                                                return res.status(500).send('Database Error');
                                                                                                            });
                                                                                                        } else {
                                                                                                            connection.commit((err) => {
                                                                                                                if (err) {
                                                                                                                    console.error("Error committing transaction:", err);
                                                                                                                    connection.rollback(() => {
                                                                                                                        connection.release();
                                                                                                                        return res.status(500).send('Database Error');
                                                                                                                    });
                                                                                                                } else {
                                                                                                                    connection.release();
                                                                                                                    req?.io?.emit('getTokenList', tokenList);
                                                                                                                    return res.status(200).send(sendJson);
                                                                                                                }
                                                                                                            });
                                                                                                        }
                                                                                                    });
                                                                                                } else {
                                                                                                    let sql_querry_addNewAddress = `INSERT INTO billing_customerAddress_data(addressId, customerId, customerAddress, customerLocality)
                                                                                                                                    VALUES ('${newAddressId}', '${existCustomerId}', TRIM('${customerData.address}'), ${customerData.locality ? `TRIM('${customerData.locality}')` : null})`;
                                                                                                    connection.query(sql_querry_addNewAddress, (err) => {
                                                                                                        if (err) {
                                                                                                            console.error("Error inserting Customer New Address:", err);
                                                                                                            connection.rollback(() => {
                                                                                                                connection.release();
                                                                                                                return res.status(500).send('Database Error');
                                                                                                            });
                                                                                                        } else {
                                                                                                            let sql_query_addAddressRelation = `INSERT INTO billing_billWiseCustomer_data(bwcId, billId, customerId, addressId, mobileNo, customerName, address, locality)
                                                                                                                                                VALUES ('${bwcId}', '${billId}', '${existCustomerId}', '${newAddressId}', ${customerData.mobileNo ? `TRIM('${customerData.mobileNo}')` : null}, ${customerData.customerName ? `TRIM('${customerData.customerName}')` : null}, ${customerData.address ? `'${customerData.address}'` : null}, ${customerData.locality ? `'${customerData.locality}'` : null})`;
                                                                                                            connection.query(sql_query_addAddressRelation, (err) => {
                                                                                                                if (err) {
                                                                                                                    console.error("Error inserting Customer Bill Wise Data:", err);
                                                                                                                    connection.rollback(() => {
                                                                                                                        connection.release();
                                                                                                                        return res.status(500).send('Database Error');
                                                                                                                    });
                                                                                                                } else {
                                                                                                                    connection.commit((err) => {
                                                                                                                        if (err) {
                                                                                                                            console.error("Error committing transaction:", err);
                                                                                                                            connection.rollback(() => {
                                                                                                                                connection.release();
                                                                                                                                return res.status(500).send('Database Error');
                                                                                                                            });
                                                                                                                        } else {
                                                                                                                            connection.release();
                                                                                                                            req?.io?.emit('getTokenList', tokenList);
                                                                                                                            return res.status(200).send(sendJson);
                                                                                                                        }
                                                                                                                    });
                                                                                                                }
                                                                                                            });
                                                                                                        }
                                                                                                    })
                                                                                                }
                                                                                            }
                                                                                        })
                                                                                    } else if (customerData.address?.trim()) {
                                                                                        let sql_querry_addNewCustomer = `INSERT INTO billing_customer_data(customerId, branchId, customerName, customerMobileNumber, birthDate, anniversaryDate)
                                                                                                                         VALUES ('${newCustomerId}', '${branchId}', ${customerData.customerName ? `TRIM('${customerData.customerName}')` : null}, ${customerData.mobileNo ? `'${customerData.mobileNo}'` : null}, ${customerData.birthDate ? `STR_TO_DATE('${customerData.birthDate}','%b %d %Y')` : null}, ${customerData.aniversaryDate ? `STR_TO_DATE('${customerData.aniversaryDate}','%b %d %Y')` : null})`;
                                                                                        connection.query(sql_querry_addNewCustomer, (err) => {
                                                                                            if (err) {
                                                                                                console.error("Error inserting New Customer Data:", err);
                                                                                                connection.rollback(() => {
                                                                                                    connection.release();
                                                                                                    return res.status(500).send('Database Error');
                                                                                                });
                                                                                            } else {
                                                                                                let sql_querry_addNewAddress = `INSERT INTO billing_customerAddress_data(addressId, customerId, customerAddress, customerLocality)
                                                                                                                                VALUES ('${newAddressId}', '${newCustomerId}', TRIM('${customerData.address}'), ${customerData.locality ? `TRIM('${customerData.locality}')` : null})`;
                                                                                                connection.query(sql_querry_addNewAddress, (err) => {
                                                                                                    if (err) {
                                                                                                        console.error("Error inserting Customer New Address:", err);
                                                                                                        connection.rollback(() => {
                                                                                                            connection.release();
                                                                                                            return res.status(500).send('Database Error');
                                                                                                        });
                                                                                                    } else {
                                                                                                        let sql_query_addAddressRelation = `INSERT INTO billing_billWiseCustomer_data(bwcId, billId, customerId, addressId, mobileNo, customerName, address, locality)
                                                                                                                                            VALUES ('${bwcId}', '${billId}', '${newCustomerId}', '${newAddressId}', ${customerData.mobileNo ? `TRIM('${customerData.mobileNo}')` : null}, ${customerData.customerName ? `TRIM('${customerData.customerName}')` : null}, ${customerData.address ? `'${customerData.address}'` : null}, ${customerData.locality ? `'${customerData.locality}'` : null})`;
                                                                                                        connection.query(sql_query_addAddressRelation, (err) => {
                                                                                                            if (err) {
                                                                                                                console.error("Error inserting Customer Bill Wise Data:", err);
                                                                                                                connection.rollback(() => {
                                                                                                                    connection.release();
                                                                                                                    return res.status(500).send('Database Error');
                                                                                                                });
                                                                                                            } else {
                                                                                                                connection.commit((err) => {
                                                                                                                    if (err) {
                                                                                                                        console.error("Error committing transaction:", err);
                                                                                                                        connection.rollback(() => {
                                                                                                                            connection.release();
                                                                                                                            return res.status(500).send('Database Error');
                                                                                                                        });
                                                                                                                    } else {
                                                                                                                        connection.release();
                                                                                                                        req?.io?.emit('getTokenList', tokenList);
                                                                                                                        return res.status(200).send(sendJson);
                                                                                                                    }
                                                                                                                });
                                                                                                            }
                                                                                                        });
                                                                                                    }
                                                                                                })
                                                                                            }
                                                                                        })
                                                                                    } else if (existCustomerId) {
                                                                                        let sql_query_addAddressRelation = `INSERT INTO billing_billWiseCustomer_data(bwcId, billId, customerId, addressId, mobileNo, customerName, address, locality)
                                                                                                                            VALUES ('${bwcId}', '${billId}', '${existCustomerId}', NULL, ${customerData.mobileNo ? `TRIM('${customerData.mobileNo}')` : null}, ${customerData.customerName ? `TRIM('${customerData.customerName}')` : null}, ${customerData.address ? `'${customerData.address}'` : null}, ${customerData.locality ? `'${customerData.locality}'` : null})`;
                                                                                        connection.query(sql_query_addAddressRelation, (err) => {
                                                                                            if (err) {
                                                                                                console.error("Error inserting Customer Bill Wise Data:", err);
                                                                                                connection.rollback(() => {
                                                                                                    connection.release();
                                                                                                    return res.status(500).send('Database Error');
                                                                                                });
                                                                                            } else {
                                                                                                connection.commit((err) => {
                                                                                                    if (err) {
                                                                                                        console.error("Error committing transaction:", err);
                                                                                                        connection.rollback(() => {
                                                                                                            connection.release();
                                                                                                            return res.status(500).send('Database Error');
                                                                                                        });
                                                                                                    } else {
                                                                                                        connection.release();
                                                                                                        req?.io?.emit('getTokenList', tokenList);
                                                                                                        return res.status(200).send(sendJson);
                                                                                                    }
                                                                                                });
                                                                                            }
                                                                                        });
                                                                                    } else if (customerData.mobileNo) {
                                                                                        let sql_querry_addNewCustomer = `INSERT INTO billing_customer_data(customerId, branchId, customerName, customerMobileNumber, birthDate, anniversaryDate)
                                                                                                                         VALUES ('${newCustomerId}', '${branchId}', ${customerData.customerName ? `TRIM('${customerData.customerName}')` : null}, ${customerData.mobileNo ? `'${customerData.mobileNo}'` : null}, ${customerData.birthDate ? `STR_TO_DATE('${customerData.birthDate}','%b %d %Y')` : null}, ${customerData.aniversaryDate ? `STR_TO_DATE('${customerData.aniversaryDate}','%b %d %Y')` : null})`;
                                                                                        connection.query(sql_querry_addNewCustomer, (err) => {
                                                                                            if (err) {
                                                                                                console.error("Error inserting New Customer Data:", err);
                                                                                                connection.rollback(() => {
                                                                                                    connection.release();
                                                                                                    return res.status(500).send('Database Error');
                                                                                                });
                                                                                            } else {
                                                                                                let sql_query_addAddressRelation = `INSERT INTO billing_billWiseCustomer_data(bwcId, billId, customerId, addressId, mobileNo, customerName, address, locality)
                                                                                                                                    VALUES ('${bwcId}', '${billId}', '${newCustomerId}', NULL, ${customerData.mobileNo ? `TRIM('${customerData.mobileNo}')` : null}, ${customerData.customerName ? `TRIM('${customerData.customerName}')` : null}, ${customerData.address ? `'${customerData.address}'` : null}, ${customerData.locality ? `'${customerData.locality}'` : null})`;
                                                                                                connection.query(sql_query_addAddressRelation, (err) => {
                                                                                                    if (err) {
                                                                                                        console.error("Error inserting Customer Bill Wise Data:", err);
                                                                                                        connection.rollback(() => {
                                                                                                            connection.release();
                                                                                                            return res.status(500).send('Database Error');
                                                                                                        });
                                                                                                    } else {
                                                                                                        connection.commit((err) => {
                                                                                                            if (err) {
                                                                                                                console.error("Error committing transaction:", err);
                                                                                                                connection.rollback(() => {
                                                                                                                    connection.release();
                                                                                                                    return res.status(500).send('Database Error');
                                                                                                                });
                                                                                                            } else {
                                                                                                                connection.release();
                                                                                                                req?.io?.emit('getTokenList', tokenList);
                                                                                                                return res.status(200).send(sendJson);
                                                                                                            }
                                                                                                        });
                                                                                                    }
                                                                                                });
                                                                                            }
                                                                                        })
                                                                                    } else {
                                                                                        let sql_query_addAddressRelation = `INSERT INTO billing_billWiseCustomer_data(bwcId, billId, customerId, addressId, mobileNo, customerName, address, locality)
                                                                                                                            VALUES ('${bwcId}', '${billId}', NULL, NULL, ${customerData.mobileNo ? `TRIM('${customerData.mobileNo}')` : null}, ${customerData.customerName ? `TRIM('${customerData.customerName}')` : null}, ${customerData.address ? `'${customerData.address}'` : null}, ${customerData.locality ? `'${customerData.locality}'` : null})`;
                                                                                        connection.query(sql_query_addAddressRelation, (err) => {
                                                                                            if (err) {
                                                                                                console.error("Error inserting Customer Bill Wise Data:", err);
                                                                                                connection.rollback(() => {
                                                                                                    connection.release();
                                                                                                    return res.status(500).send('Database Error');
                                                                                                });
                                                                                            } else {
                                                                                                connection.commit((err) => {
                                                                                                    if (err) {
                                                                                                        console.error("Error committing transaction:", err);
                                                                                                        connection.rollback(() => {
                                                                                                            connection.release();
                                                                                                            return res.status(500).send('Database Error');
                                                                                                        });
                                                                                                    } else {
                                                                                                        connection.release();
                                                                                                        req?.io?.emit('getTokenList', tokenList);
                                                                                                        return res.status(200).send(sendJson);
                                                                                                    }
                                                                                                });
                                                                                            }
                                                                                        });
                                                                                    }
                                                                                }
                                                                            })
                                                                        } else if (customerData.address?.trim() || customerData.locality?.trim()) {
                                                                            let sql_query_addAddressRelation = `INSERT INTO billing_billWiseCustomer_data(bwcId, billId, customerId, addressId, mobileNo, customerName, address, locality)
                                                                                                                VALUES ('${bwcId}', '${billId}', NULL, NULL, ${customerData.mobileNo ? `TRIM('${customerData.mobileNo}')` : null}, ${customerData.customerName ? `TRIM('${customerData.customerName}')` : null}, ${customerData.address ? `'${customerData.address}'` : null}, ${customerData.locality ? `'${customerData.locality}'` : null})`;
                                                                            connection.query(sql_query_addAddressRelation, (err) => {
                                                                                if (err) {
                                                                                    console.error("Error inserting Customer Bill Wise Data:", err);
                                                                                    connection.rollback(() => {
                                                                                        connection.release();
                                                                                        return res.status(500).send('Database Error');
                                                                                    });
                                                                                } else {
                                                                                    connection.commit((err) => {
                                                                                        if (err) {
                                                                                            console.error("Error committing transaction:", err);
                                                                                            connection.rollback(() => {
                                                                                                connection.release();
                                                                                                return res.status(500).send('Database Error');
                                                                                            });
                                                                                        } else {
                                                                                            connection.release();
                                                                                            req?.io?.emit('getTokenList', tokenList);
                                                                                            return res.status(200).send(sendJson);
                                                                                        }
                                                                                    });
                                                                                }
                                                                            });
                                                                        } else {
                                                                            connection.commit((err) => {
                                                                                if (err) {
                                                                                    console.error("Error committing transaction:", err);
                                                                                    connection.rollback(() => {
                                                                                        connection.release();
                                                                                        return res.status(500).send('Database Error');
                                                                                    });
                                                                                } else {
                                                                                    connection.release();
                                                                                    req?.io?.emit('getTokenList', tokenList);
                                                                                    return res.status(200).send(sendJson);
                                                                                }
                                                                            });
                                                                        }
                                                                    }
                                                                }
                                                            });
                                                        }
                                                    });
                                                }
                                            });
                                        }
                                    });
                                }
                            });
                        }
                    } else {
                        connection.rollback(() => {
                            connection.release();
                            return res.status(404).send('Please Login First....!');
                        });
                    }
                }
            });
        } catch (error) {
            console.error('An error occurred', error);
            connection.rollback(() => {
                connection.release();
                return res.status(500).json('Internal Server Error');
            })
        }
    });
}

// Add Delivery Bill Data
const addDeliveryBillData = (req, res) => {
    pool2.getConnection((err, connection) => {
        if (err) {
            console.error("Error getting database connection:", err);
            return res.status(500).send('Database Error');
        }
        try {
            connection.beginTransaction((err) => {
                if (err) {
                    console.error("Error beginning transaction:", err);
                    connection.release();
                    return res.status(500).send('Database Error');
                } else {
                    let token;
                    token = req.headers ? req.headers.authorization.split(" ")[1] : null;
                    if (token) {
                        const decoded = jwt.verify(token, process.env.JWT_SECRET);
                        const cashier = decoded.id.firstName;
                        const branchId = decoded.id.branchId;

                        const currentDate = getCurrentDate();
                        const billData = req.body;
                        if (!billData.customerDetails || !branchId || !billData.firmId || !billData.subTotal || !billData.settledAmount || !billData.billPayType || !billData.billStatus || !billData.itemsData || !billData.customerDetails.mobileNo) {
                            connection.rollback(() => {
                                connection.release();
                                return res.status(404).send('Please Fill All The Fields..!');
                            })
                        } else {
                            const isComplimentary = billData.billPayType == 'complimentary' ? true : false;
                            let sql_query_getOfficialLastBillNo = `SELECT COALESCE(MAX(billNumber),0) AS officialLastBillNo FROM billing_Official_data WHERE firmId = '${billData.firmId}' AND billCreationDate = (SELECT MAX(billCreationDate) FROM billing_Official_data WHERE firmId = '${billData.firmId}') FOR UPDATE`;
                            let sql_query_getComplimentaryLastBillNo = `SELECT COALESCE(MAX(billNumber),0) AS complimentaryBillNo FROM billing_Complimentary_data WHERE firmId = '${billData.firmId}' AND billCreationDate = (SELECT MAX(billCreationDate) FROM billing_Complimentary_data WHERE firmId = '${billData.firmId}') FOR UPDATE`;
                            let sql_query_getLastBillNo = `SELECT COALESCE(MAX(billNumber),0) AS lastBillNo FROM billing_data WHERE firmId = '${billData.firmId}' AND billCreationDate = (SELECT MAX(billCreationDate) FROM billing_data WHERE firmId = '${billData.firmId}') FOR UPDATE;
                                                           SELECT COALESCE(MAX(tokenNo),0) AS lastTokenNo FROM billing_token_data WHERE billType = '${billData.billType}' AND branchId = '${branchId}' AND billDate = STR_TO_DATE('${currentDate}','%b %d %Y') FOR UPDATE;
                                                           ${billData.isOfficial && !isComplimentary ? sql_query_getOfficialLastBillNo : isComplimentary ? sql_query_getComplimentaryLastBillNo : ''}`;
                            connection.query(sql_query_getLastBillNo, (err, result) => {
                                if (err) {
                                    console.error("Error selecting last bill and token number:", err);
                                    connection.rollback(() => {
                                        connection.release();
                                        return res.status(500).send('Database Error');
                                    });
                                } else {
                                    const lastBillNo = result && result[0] && result[0][0].lastBillNo ? result[0][0].lastBillNo : 0;
                                    const lastTokenNo = result && result[0] && result[1][0].lastTokenNo ? result[1][0].lastTokenNo : 0;
                                    const officialLastBillNo = result && result[2] && result[2][0].officialLastBillNo ? result[2][0].officialLastBillNo : result && result[2] && result[2][0].complimentaryBillNo ? result[2][0].complimentaryBillNo : 0;

                                    const nextBillNo = lastBillNo + 1;
                                    const nextOfficialBillNo = officialLastBillNo + 1;
                                    const nextTokenNo = lastTokenNo + 1;
                                    const uid1 = new Date();
                                    const billId = String("bill_" + uid1.getTime() + '_' + nextBillNo);
                                    const tokenId = String("token_" + uid1.getTime() + '_' + nextTokenNo);
                                    const bwcId = String("bwc_" + uid1.getTime() + '_' + nextTokenNo);
                                    const newCustomerId = String("customer_" + uid1.getTime());
                                    const newAddressId = String("addressId_" + uid1.getTime());
                                    const bwuId = String("bwu_" + uid1.getTime());
                                    const dabId = String("dab_" + uid1.getTime());

                                    const columnData = `billId,
                                                        firmId,
                                                        branchId,
                                                        cashier,
                                                        menuStatus,
                                                        billType,
                                                        billPayType,
                                                        discountType,
                                                        discountValue,
                                                        totalDiscount,
                                                        totalAmount,
                                                        settledAmount,
                                                        billComment,
                                                        billDate,
                                                        billStatus`;
                                    const values = `'${billId}',
                                                   '${billData.firmId}', 
                                                   '${branchId}',
                                                   '${cashier}', 
                                                   'Offline',
                                                   'Delivery',
                                                   '${billData.billPayType}',
                                                   '${billData.discountType}',
                                                   ${billData.discountValue},
                                                   ${billData.totalDiscount},
                                                   ${billData.subTotal},
                                                   ${billData.settledAmount},
                                                   ${billData.billComment ? `'${billData.billComment}'` : null},
                                                   STR_TO_DATE('${currentDate}','%b %d %Y'),
                                                   '${billData.billStatus}'`;

                                    let sql_querry_addBillInfo = `INSERT INTO billing_data (billNumber,${columnData}) VALUES (${nextBillNo}, ${values})`;
                                    let sql_querry_addOfficialData = `INSERT INTO billing_Official_data (billNumber, ${columnData}) VALUES(${nextOfficialBillNo}, ${values})`;
                                    let sql_querry_addComplimentaryData = `INSERT INTO billing_Complimentary_data (billNumber, ${columnData}) VALUES(${nextOfficialBillNo}, ${values})`;
                                    let sql_querry_addBillData = `${sql_querry_addBillInfo};
                                                                  ${billData.isOfficial && !isComplimentary ? sql_querry_addOfficialData : isComplimentary ? sql_querry_addComplimentaryData : ''}`;
                                    connection.query(sql_querry_addBillData, (err) => {
                                        if (err) {
                                            console.error("Error inserting new bill number:", err);
                                            connection.rollback(() => {
                                                connection.release();
                                                return res.status(500).send('Database Error');
                                            });
                                        } else {
                                            let sql_query_addTokenNo = `INSERT INTO billing_token_data(tokenId, billId, branchId, tokenNo, billType, billDate)
                                                                        VALUES ('${tokenId}', '${billId}', '${branchId}', ${nextTokenNo}, '${billData.billType}', STR_TO_DATE('${currentDate}','%b %d %Y'))`;
                                            connection.query(sql_query_addTokenNo, (err) => {
                                                if (err) {
                                                    console.error("Error inserting new Token number:", err);
                                                    connection.rollback(() => {
                                                        connection.release();
                                                        return res.status(500).send('Database Error');
                                                    });
                                                } else {
                                                    const billItemData = billData.itemsData

                                                    const addBillWiseItemData = [];
                                                    const addItemWiseAddonData = [];

                                                    billItemData.forEach((item, index) => {
                                                        let uniqueId = `iwb_${Date.now() + index}_${index}`; // Unique ID generation

                                                        // Construct SQL_Add_1 for the main item
                                                        addBillWiseItemData.push(`('${uniqueId}', '${billId}', '${branchId}', '${item.itemId}', ${item.qty}, '${item.unit}', ${item.itemPrice}, ${item.price}, ${item.comment ? `'${item.comment}'` : null}, 'Delivery', '${billData.billPayType}', '${billData.billStatus}', STR_TO_DATE('${currentDate}','%b %d %Y'))`);

                                                        // Construct SQL_Add_2 for the addons
                                                        const allAddons = item.addons ? Object.keys(item.addons) : []
                                                        if (allAddons && allAddons.length) {
                                                            allAddons.forEach((addonId, addonIndex) => {
                                                                let iwaId = `iwa_${Date.now() + addonIndex + index}_${index}`; // Unique ID for each addon
                                                                addItemWiseAddonData.push(`('${iwaId}', '${uniqueId}', '${addonId}')`);
                                                            });
                                                        }
                                                    });
                                                    let sql_query_addItems = `INSERT INTO billing_billWiseItem_data(iwbId, billId, branchId, itemId, qty, unit, itemPrice, price, comment, billType, billPayType, billStatus, billDate)
                                                                              VALUES ${addBillWiseItemData.join(", ")}`;
                                                    connection.query(sql_query_addItems, (err) => {
                                                        if (err) {
                                                            console.error("Error inserting Bill Wise Item Data:", err);
                                                            connection.rollback(() => {
                                                                connection.release();
                                                                return res.status(500).send('Database Error');
                                                            });
                                                        } else {
                                                            let sql_query_getFirmData = `SELECT firmId, firmName, gstNumber, firmAddress, pincode, firmMobileNo, otherMobileNo FROM billing_firm_data WHERE firmId = '${billData.firmId}';
                                                                                         SELECT
                                                                                           btd.tokenNo,
                                                                                           bd.billStatus,
                                                                                           bd.billId,
                                                                                           bd.settledAmount,
                                                                                           SEC_TO_TIME(
                                                                                               TIMESTAMPDIFF(
                                                                                                   SECOND,
                                                                                                   bd.billCreationDate,
                                                                                                   NOW()
                                                                                               )
                                                                                           ) AS timeDifference
                                                                                         FROM billing_token_data AS btd
                                                                                         LEFT JOIN billing_data AS bd ON bd.billId = btd.billId
                                                                                         WHERE btd.billType = 'Pick Up' AND bd.billStatus NOT IN ('complete','Cancel') AND btd.billDate = STR_TO_DATE('${currentDate}','%b %d %Y')
                                                                                         ORDER BY btd.tokenNo ASC;
                                                                    ${addItemWiseAddonData.length
                                                                    ?
                                                                    `INSERT INTO billing_itemWiseAddon_data (iwaId, iwbId, addOnsId) VALUES ${addItemWiseAddonData.join(", ")};`
                                                                    :
                                                                    ''}
                                                                                         ${billData.billPayType == 'online' && billData.onlineId && billData.onlineId != 'other'
                                                                    ?
                                                                    `INSERT INTO billing_billWiseUpi_data(bwuId, onlineId, billId, amount, onlineDate)
                                                                     VALUES('${bwuId}', '${billData.onlineId}', '${billId}', '${billData.settledAmount}', STR_TO_DATE('${currentDate}','%b %d %Y'))`
                                                                    :
                                                                    billData.accountId && billData.billPayType == 'due'
                                                                        ?
                                                                        `INSERT INTO due_billAmount_data(dabId, enterBy, accountId, billId, billAmount, dueNote, dueDate)
                                                                         VALUES('${dabId}','${cashier}','${billData.accountId}','${billId}',${billData.settledAmount},${billData.dueNote ? `'${billData.dueNote}'` : null}, STR_TO_DATE('${currentDate}','%b %d %Y'))`
                                                                        :
                                                                        ''}`;
                                                            connection.query(sql_query_getFirmData, (err, firm) => {
                                                                if (err) {
                                                                    console.error("Error inserting Bill Wise Item Data:", err);
                                                                    connection.rollback(() => {
                                                                        connection.release();
                                                                        return res.status(500).send('Database Error');
                                                                    });
                                                                } else {
                                                                    const sendJson = {
                                                                        ...billData,
                                                                        firmData: firm[0][0],
                                                                        cashier: cashier,
                                                                        billNo: nextBillNo,
                                                                        officialBillNo: billData.isOfficial && !isComplimentary ? nextOfficialBillNo : isComplimentary ? 'C' + nextOfficialBillNo : 'Not Available',
                                                                        tokenNo: 'D' + nextTokenNo,
                                                                        justToken: nextTokenNo,
                                                                        billDate: new Date(currentDate).toLocaleDateString('en-GB'),
                                                                        billTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                                                    }
                                                                    const tokenList = firm && firm[1].length ? firm[1] : null;
                                                                    const customerData = billData.customerDetails;
                                                                    if (customerData && customerData.customerId && customerData.addressId) {
                                                                        let sql_query_addAddressRelation = `INSERT INTO billing_billWiseCustomer_data(bwcId, billId, customerId, addressId, mobileNo, customerName, address, locality)
                                                                                                            VALUES ('${bwcId}', '${billId}', '${customerData.customerId}', '${customerData.addressId}', ${customerData.mobileNo ? `TRIM('${customerData.mobileNo}')` : null}, ${customerData.customerName ? `TRIM('${customerData.customerName}')` : null}, ${customerData.address ? `'${customerData.address}'` : null}, ${customerData.locality ? `'${customerData.locality}'` : null})`;
                                                                        connection.query(sql_query_addAddressRelation, (err) => {
                                                                            if (err) {
                                                                                console.error("Error inserting Customer Bill Wise Data:", err);
                                                                                connection.rollback(() => {
                                                                                    connection.release();
                                                                                    return res.status(500).send('Database Error');
                                                                                });
                                                                            } else {
                                                                                connection.commit((err) => {
                                                                                    if (err) {
                                                                                        console.error("Error committing transaction:", err);
                                                                                        connection.rollback(() => {
                                                                                            connection.release();
                                                                                            return res.status(500).send('Database Error');
                                                                                        });
                                                                                    } else {
                                                                                        connection.release();
                                                                                        req?.io?.emit('getTokenList', tokenList);
                                                                                        return res.status(200).send(sendJson);
                                                                                    }
                                                                                });
                                                                            }
                                                                        });
                                                                    } else if (customerData && customerData.customerId && customerData.address?.trim()) {
                                                                        let sql_queries_chkOldAdd = `SELECT addressId, customerId FROM billing_customerAddress_data WHERE customerAddress = TRIM('${customerData.address}') AND customerLocality = '${customerData.locality}'`;
                                                                        connection.query(sql_queries_chkOldAdd, (err, oldAdd) => {
                                                                            if (err) {
                                                                                console.error("Error inserting Customer New Address:", err);
                                                                                connection.rollback(() => {
                                                                                    connection.release();
                                                                                    return res.status(500).send('Database Error');
                                                                                });
                                                                            } else {
                                                                                if (oldAdd && oldAdd[0]) {
                                                                                    const existAddressId = oldAdd[0].addressId;
                                                                                    let sql_query_addAddressRelation = `INSERT INTO billing_billWiseCustomer_data(bwcId, billId, customerId, addressId, mobileNo, customerName, address, locality)
                                                                                                                        VALUES ('${bwcId}', '${billId}', '${customerData.customerId}', '${existAddressId}', ${customerData.mobileNo ? `TRIM('${customerData.mobileNo}')` : null}, ${customerData.customerName ? `TRIM('${customerData.customerName}')` : null}, ${customerData.address ? `'${customerData.address}'` : null}, ${customerData.locality ? `'${customerData.locality}'` : null})`;
                                                                                    connection.query(sql_query_addAddressRelation, (err) => {
                                                                                        if (err) {
                                                                                            console.error("Error inserting Customer Bill Wise Data:", err);
                                                                                            connection.rollback(() => {
                                                                                                connection.release();
                                                                                                return res.status(500).send('Database Error');
                                                                                            });
                                                                                        } else {
                                                                                            connection.commit((err) => {
                                                                                                if (err) {
                                                                                                    console.error("Error committing transaction:", err);
                                                                                                    connection.rollback(() => {
                                                                                                        connection.release();
                                                                                                        return res.status(500).send('Database Error');
                                                                                                    });
                                                                                                } else {
                                                                                                    connection.release();
                                                                                                    req?.io?.emit('getTokenList', tokenList);
                                                                                                    return res.status(200).send(sendJson);
                                                                                                }
                                                                                            });
                                                                                        }
                                                                                    });
                                                                                } else {
                                                                                    let sql_querry_addNewAddress = `INSERT INTO billing_customerAddress_data(addressId, customerId, customerAddress, customerLocality)
                                                                                                                    VALUES ('${newAddressId}', '${customerData.customerId}', TRIM('${customerData.address}'), ${customerData.locality ? `TRIM('${customerData.locality}')` : null})`;
                                                                                    connection.query(sql_querry_addNewAddress, (err) => {
                                                                                        if (err) {
                                                                                            console.error("Error inserting Customer New Address:", err);
                                                                                            connection.rollback(() => {
                                                                                                connection.release();
                                                                                                return res.status(500).send('Database Error');
                                                                                            });
                                                                                        } else {
                                                                                            let sql_query_addAddressRelation = `INSERT INTO billing_billWiseCustomer_data(bwcId, billId, customerId, addressId, mobileNo, customerName, address, locality)
                                                                                                                                VALUES ('${bwcId}', '${billId}', '${customerData.customerId}', '${newAddressId}', ${customerData.mobileNo ? `TRIM('${customerData.mobileNo}')` : null}, ${customerData.customerName ? `TRIM('${customerData.customerName}')` : null}, ${customerData.address ? `'${customerData.address}'` : null}, ${customerData.locality ? `'${customerData.locality}'` : null})`;
                                                                                            connection.query(sql_query_addAddressRelation, (err) => {
                                                                                                if (err) {
                                                                                                    console.error("Error inserting Customer Bill Wise Data:", err);
                                                                                                    connection.rollback(() => {
                                                                                                        connection.release();
                                                                                                        return res.status(500).send('Database Error');
                                                                                                    });
                                                                                                } else {
                                                                                                    connection.commit((err) => {
                                                                                                        if (err) {
                                                                                                            console.error("Error committing transaction:", err);
                                                                                                            connection.rollback(() => {
                                                                                                                connection.release();
                                                                                                                return res.status(500).send('Database Error');
                                                                                                            });
                                                                                                        } else {
                                                                                                            connection.release();
                                                                                                            req?.io?.emit('getTokenList', tokenList);
                                                                                                            return res.status(200).send(sendJson);
                                                                                                        }
                                                                                                    });
                                                                                                }
                                                                                            });
                                                                                        }
                                                                                    })
                                                                                }
                                                                            }
                                                                        });
                                                                    } else if (customerData && customerData.customerId) {
                                                                        let sql_query_addAddressRelation = `INSERT INTO billing_billWiseCustomer_data(bwcId, billId, customerId, addressId, mobileNo, customerName, address, locality)
                                                                                                            VALUES ('${bwcId}', '${billId}', '${customerData.customerId}', ${customerData.addressId ? `'${customerData.addressId}'` : null}, ${customerData.mobileNo ? `TRIM('${customerData.mobileNo}')` : null}, ${customerData.customerName ? `TRIM('${customerData.customerName}')` : null}, ${customerData.address ? `'${customerData.address}'` : null}, ${customerData.locality ? `'${customerData.locality}'` : null})`;
                                                                        connection.query(sql_query_addAddressRelation, (err) => {
                                                                            if (err) {
                                                                                console.error("Error inserting Customer Bill Wise Data:", err);
                                                                                connection.rollback(() => {
                                                                                    connection.release();
                                                                                    return res.status(500).send('Database Error');
                                                                                });
                                                                            } else {
                                                                                connection.commit((err) => {
                                                                                    if (err) {
                                                                                        console.error("Error committing transaction:", err);
                                                                                        connection.rollback(() => {
                                                                                            connection.release();
                                                                                            return res.status(500).send('Database Error');
                                                                                        });
                                                                                    } else {
                                                                                        connection.release();
                                                                                        req?.io?.emit('getTokenList', tokenList);
                                                                                        return res.status(200).send(sendJson);
                                                                                    }
                                                                                });
                                                                            }
                                                                        });
                                                                    } else {
                                                                        if (customerData && (customerData.customerName || customerData.mobileNo)) {
                                                                            let sql_querry_getExistCustomer = `SELECT customerId, customerMobileNumber FROM billing_customer_data WHERE customerMobileNumber = '${customerData.mobileNo}'`;
                                                                            connection.query(sql_querry_getExistCustomer, (err, num) => {
                                                                                if (err) {
                                                                                    console.error("Error Get Existing Customer Data:", err);
                                                                                    connection.rollback(() => {
                                                                                        connection.release();
                                                                                        return res.status(500).send('Database Error');
                                                                                    });
                                                                                } else {
                                                                                    const existCustomerId = num && num[0] ? num[0].customerId : null;
                                                                                    if (existCustomerId && customerData.address) {
                                                                                        let sql_queries_chkOldAdd = `SELECT addressId, customerId FROM billing_customerAddress_data WHERE customerAddress = TRIM('${customerData.address}') AND customerLocality = '${customerData.locality}'`;
                                                                                        connection.query(sql_queries_chkOldAdd, (err, oldAdd) => {
                                                                                            if (err) {
                                                                                                console.error("Error inserting Customer New Address:", err);
                                                                                                connection.rollback(() => {
                                                                                                    connection.release();
                                                                                                    return res.status(500).send('Database Error');
                                                                                                });
                                                                                            } else {
                                                                                                if (oldAdd && oldAdd[0]) {
                                                                                                    const existAddressId = oldAdd[0].addressId;
                                                                                                    let sql_query_addAddressRelation = `INSERT INTO billing_billWiseCustomer_data(bwcId, billId, customerId, addressId, mobileNo, customerName, address, locality)
                                                                                                                                        VALUES ('${bwcId}', '${billId}', '${existCustomerId}', '${existAddressId}', ${customerData.mobileNo ? `TRIM('${customerData.mobileNo}')` : null}, ${customerData.customerName ? `TRIM('${customerData.customerName}')` : null}, ${customerData.address ? `'${customerData.address}'` : null}, ${customerData.locality ? `'${customerData.locality}'` : null})`;
                                                                                                    connection.query(sql_query_addAddressRelation, (err) => {
                                                                                                        if (err) {
                                                                                                            console.error("Error inserting Customer Bill Wise Data:", err);
                                                                                                            connection.rollback(() => {
                                                                                                                connection.release();
                                                                                                                return res.status(500).send('Database Error');
                                                                                                            });
                                                                                                        } else {
                                                                                                            connection.commit((err) => {
                                                                                                                if (err) {
                                                                                                                    console.error("Error committing transaction:", err);
                                                                                                                    connection.rollback(() => {
                                                                                                                        connection.release();
                                                                                                                        return res.status(500).send('Database Error');
                                                                                                                    });
                                                                                                                } else {
                                                                                                                    connection.release();
                                                                                                                    req?.io?.emit('getTokenList', tokenList);
                                                                                                                    return res.status(200).send(sendJson);
                                                                                                                }
                                                                                                            });
                                                                                                        }
                                                                                                    });
                                                                                                } else {
                                                                                                    let sql_querry_addNewAddress = `INSERT INTO billing_customerAddress_data(addressId, customerId, customerAddress, customerLocality)
                                                                                                                                    VALUES ('${newAddressId}', '${existCustomerId}', TRIM('${customerData.address}'), ${customerData.locality ? `TRIM('${customerData.locality}')` : null})`;
                                                                                                    connection.query(sql_querry_addNewAddress, (err) => {
                                                                                                        if (err) {
                                                                                                            console.error("Error inserting Customer New Address:", err);
                                                                                                            connection.rollback(() => {
                                                                                                                connection.release();
                                                                                                                return res.status(500).send('Database Error');
                                                                                                            });
                                                                                                        } else {
                                                                                                            let sql_query_addAddressRelation = `INSERT INTO billing_billWiseCustomer_data(bwcId, billId, customerId, addressId, mobileNo, customerName, address, locality)
                                                                                                                                                VALUES ('${bwcId}', '${billId}', '${existCustomerId}', '${newAddressId}', ${customerData.mobileNo ? `TRIM('${customerData.mobileNo}')` : null}, ${customerData.customerName ? `TRIM('${customerData.customerName}')` : null}, ${customerData.address ? `'${customerData.address}'` : null}, ${customerData.locality ? `'${customerData.locality}'` : null})`;
                                                                                                            connection.query(sql_query_addAddressRelation, (err) => {
                                                                                                                if (err) {
                                                                                                                    console.error("Error inserting Customer Bill Wise Data:", err);
                                                                                                                    connection.rollback(() => {
                                                                                                                        connection.release();
                                                                                                                        return res.status(500).send('Database Error');
                                                                                                                    });
                                                                                                                } else {
                                                                                                                    connection.commit((err) => {
                                                                                                                        if (err) {
                                                                                                                            console.error("Error committing transaction:", err);
                                                                                                                            connection.rollback(() => {
                                                                                                                                connection.release();
                                                                                                                                return res.status(500).send('Database Error');
                                                                                                                            });
                                                                                                                        } else {
                                                                                                                            connection.release();
                                                                                                                            req?.io?.emit('getTokenList', tokenList);
                                                                                                                            return res.status(200).send(sendJson);
                                                                                                                        }
                                                                                                                    });
                                                                                                                }
                                                                                                            });
                                                                                                        }
                                                                                                    })
                                                                                                }
                                                                                            }
                                                                                        })
                                                                                    } else if (customerData.address?.trim()) {
                                                                                        let sql_querry_addNewCustomer = `INSERT INTO billing_customer_data(customerId, branchId, customerName, customerMobileNumber, birthDate, anniversaryDate)
                                                                                                                         VALUES ('${newCustomerId}', '${branchId}', ${customerData.customerName ? `TRIM('${customerData.customerName}')` : null}, ${customerData.mobileNo ? `'${customerData.mobileNo}'` : null}, ${customerData.birthDate ? `STR_TO_DATE('${customerData.birthDate}','%b %d %Y')` : null}, ${customerData.aniversaryDate ? `STR_TO_DATE('${customerData.aniversaryDate}','%b %d %Y')` : null})`;
                                                                                        connection.query(sql_querry_addNewCustomer, (err) => {
                                                                                            if (err) {
                                                                                                console.error("Error inserting New Customer Data:", err);
                                                                                                connection.rollback(() => {
                                                                                                    connection.release();
                                                                                                    return res.status(500).send('Database Error');
                                                                                                });
                                                                                            } else {
                                                                                                let sql_querry_addNewAddress = `INSERT INTO billing_customerAddress_data(addressId, customerId, customerAddress, customerLocality)
                                                                                                                                VALUES ('${newAddressId}', '${newCustomerId}', TRIM('${customerData.address}'), ${customerData.locality ? `TRIM('${customerData.locality}')` : null})`;
                                                                                                connection.query(sql_querry_addNewAddress, (err) => {
                                                                                                    if (err) {
                                                                                                        console.error("Error inserting Customer New Address:", err);
                                                                                                        connection.rollback(() => {
                                                                                                            connection.release();
                                                                                                            return res.status(500).send('Database Error');
                                                                                                        });
                                                                                                    } else {
                                                                                                        let sql_query_addAddressRelation = `INSERT INTO billing_billWiseCustomer_data(bwcId, billId, customerId, addressId, mobileNo, customerName, address, locality)
                                                                                                                                            VALUES ('${bwcId}', '${billId}', '${newCustomerId}', '${newAddressId}', ${customerData.mobileNo ? `TRIM('${customerData.mobileNo}')` : null}, ${customerData.customerName ? `TRIM('${customerData.customerName}')` : null}, ${customerData.address ? `'${customerData.address}'` : null}, ${customerData.locality ? `'${customerData.locality}'` : null})`;
                                                                                                        connection.query(sql_query_addAddressRelation, (err) => {
                                                                                                            if (err) {
                                                                                                                console.error("Error inserting Customer Bill Wise Data:", err);
                                                                                                                connection.rollback(() => {
                                                                                                                    connection.release();
                                                                                                                    return res.status(500).send('Database Error');
                                                                                                                });
                                                                                                            } else {
                                                                                                                connection.commit((err) => {
                                                                                                                    if (err) {
                                                                                                                        console.error("Error committing transaction:", err);
                                                                                                                        connection.rollback(() => {
                                                                                                                            connection.release();
                                                                                                                            return res.status(500).send('Database Error');
                                                                                                                        });
                                                                                                                    } else {
                                                                                                                        connection.release();
                                                                                                                        req?.io?.emit('getTokenList', tokenList);
                                                                                                                        return res.status(200).send(sendJson);
                                                                                                                    }
                                                                                                                });
                                                                                                            }
                                                                                                        });
                                                                                                    }
                                                                                                })
                                                                                            }
                                                                                        })
                                                                                    } else if (existCustomerId) {
                                                                                        let sql_query_addAddressRelation = `INSERT INTO billing_billWiseCustomer_data(bwcId, billId, customerId, addressId, mobileNo, customerName, address, locality)
                                                                                                                            VALUES ('${bwcId}', '${billId}', '${existCustomerId}', NULL, ${customerData.mobileNo ? `TRIM('${customerData.mobileNo}')` : null}, ${customerData.customerName ? `TRIM('${customerData.customerName}')` : null}, ${customerData.address ? `'${customerData.address}'` : null}, ${customerData.locality ? `'${customerData.locality}'` : null})`;
                                                                                        connection.query(sql_query_addAddressRelation, (err) => {
                                                                                            if (err) {
                                                                                                console.error("Error inserting Customer Bill Wise Data:", err);
                                                                                                connection.rollback(() => {
                                                                                                    connection.release();
                                                                                                    return res.status(500).send('Database Error');
                                                                                                });
                                                                                            } else {
                                                                                                connection.commit((err) => {
                                                                                                    if (err) {
                                                                                                        console.error("Error committing transaction:", err);
                                                                                                        connection.rollback(() => {
                                                                                                            connection.release();
                                                                                                            return res.status(500).send('Database Error');
                                                                                                        });
                                                                                                    } else {
                                                                                                        connection.release();
                                                                                                        req?.io?.emit('getTokenList', tokenList);
                                                                                                        return res.status(200).send(sendJson);
                                                                                                    }
                                                                                                });
                                                                                            }
                                                                                        });
                                                                                    } else if (customerData.mobileNo) {
                                                                                        let sql_querry_addNewCustomer = `INSERT INTO billing_customer_data(customerId, branchId, customerName, customerMobileNumber, birthDate, anniversaryDate)
                                                                                                                         VALUES ('${newCustomerId}', '${branchId}', ${customerData.customerName ? `TRIM('${customerData.customerName}')` : null}, ${customerData.mobileNo ? `'${customerData.mobileNo}'` : null}, ${customerData.birthDate ? `STR_TO_DATE('${customerData.birthDate}','%b %d %Y')` : null}, ${customerData.aniversaryDate ? `STR_TO_DATE('${customerData.aniversaryDate}','%b %d %Y')` : null})`;
                                                                                        connection.query(sql_querry_addNewCustomer, (err) => {
                                                                                            if (err) {
                                                                                                console.error("Error inserting New Customer Data:", err);
                                                                                                connection.rollback(() => {
                                                                                                    connection.release();
                                                                                                    return res.status(500).send('Database Error');
                                                                                                });
                                                                                            } else {
                                                                                                let sql_query_addAddressRelation = `INSERT INTO billing_billWiseCustomer_data(bwcId, billId, customerId, addressId, mobileNo, customerName, address, locality)
                                                                                                                                    VALUES ('${bwcId}', '${billId}', '${newCustomerId}', NULL, ${customerData.mobileNo ? `TRIM('${customerData.mobileNo}')` : null}, ${customerData.customerName ? `TRIM('${customerData.customerName}')` : null}, ${customerData.address ? `'${customerData.address}'` : null}, ${customerData.locality ? `'${customerData.locality}'` : null})`;
                                                                                                connection.query(sql_query_addAddressRelation, (err) => {
                                                                                                    if (err) {
                                                                                                        console.error("Error inserting Customer Bill Wise Data:", err);
                                                                                                        connection.rollback(() => {
                                                                                                            connection.release();
                                                                                                            return res.status(500).send('Database Error');
                                                                                                        });
                                                                                                    } else {
                                                                                                        connection.commit((err) => {
                                                                                                            if (err) {
                                                                                                                console.error("Error committing transaction:", err);
                                                                                                                connection.rollback(() => {
                                                                                                                    connection.release();
                                                                                                                    return res.status(500).send('Database Error');
                                                                                                                });
                                                                                                            } else {
                                                                                                                connection.release();
                                                                                                                req?.io?.emit('getTokenList', tokenList);
                                                                                                                return res.status(200).send(sendJson);
                                                                                                            }
                                                                                                        });
                                                                                                    }
                                                                                                });
                                                                                            }
                                                                                        })
                                                                                    } else {
                                                                                        let sql_query_addAddressRelation = `INSERT INTO billing_billWiseCustomer_data(bwcId, billId, customerId, addressId, mobileNo, customerName, address, locality)
                                                                                                                            VALUES ('${bwcId}', '${billId}', NULL, NULL, ${customerData.mobileNo ? `TRIM('${customerData.mobileNo}')` : null}, ${customerData.customerName ? `TRIM('${customerData.customerName}')` : null}, ${customerData.address ? `'${customerData.address}'` : null}, ${customerData.locality ? `'${customerData.locality}'` : null})`;
                                                                                        connection.query(sql_query_addAddressRelation, (err) => {
                                                                                            if (err) {
                                                                                                console.error("Error inserting Customer Bill Wise Data:", err);
                                                                                                connection.rollback(() => {
                                                                                                    connection.release();
                                                                                                    return res.status(500).send('Database Error');
                                                                                                });
                                                                                            } else {
                                                                                                connection.commit((err) => {
                                                                                                    if (err) {
                                                                                                        console.error("Error committing transaction:", err);
                                                                                                        connection.rollback(() => {
                                                                                                            connection.release();
                                                                                                            return res.status(500).send('Database Error');
                                                                                                        });
                                                                                                    } else {
                                                                                                        connection.release();
                                                                                                        req?.io?.emit('getTokenList', tokenList);
                                                                                                        return res.status(200).send(sendJson);
                                                                                                    }
                                                                                                });
                                                                                            }
                                                                                        });
                                                                                    }
                                                                                }
                                                                            })
                                                                        } else if (customerData.address?.trim() || customerData.locality?.trim()) {
                                                                            let sql_query_addAddressRelation = `INSERT INTO billing_billWiseCustomer_data(bwcId, billId, customerId, addressId, mobileNo, customerName, address, locality)
                                                                                                                VALUES ('${bwcId}', '${billId}', NULL, NULL, ${customerData.mobileNo ? `TRIM('${customerData.mobileNo}')` : null}, ${customerData.customerName ? `TRIM('${customerData.customerName}')` : null}, ${customerData.address ? `'${customerData.address}'` : null}, ${customerData.locality ? `'${customerData.locality}'` : null})`;
                                                                            connection.query(sql_query_addAddressRelation, (err) => {
                                                                                if (err) {
                                                                                    console.error("Error inserting Customer Bill Wise Data:", err);
                                                                                    connection.rollback(() => {
                                                                                        connection.release();
                                                                                        return res.status(500).send('Database Error');
                                                                                    });
                                                                                } else {
                                                                                    connection.commit((err) => {
                                                                                        if (err) {
                                                                                            console.error("Error committing transaction:", err);
                                                                                            connection.rollback(() => {
                                                                                                connection.release();
                                                                                                return res.status(500).send('Database Error');
                                                                                            });
                                                                                        } else {
                                                                                            connection.release();
                                                                                            req?.io?.emit('getTokenList', tokenList);
                                                                                            return res.status(200).send(sendJson);
                                                                                        }
                                                                                    });
                                                                                }
                                                                            });
                                                                        } else {
                                                                            connection.commit((err) => {
                                                                                if (err) {
                                                                                    console.error("Error committing transaction:", err);
                                                                                    connection.rollback(() => {
                                                                                        connection.release();
                                                                                        return res.status(500).send('Database Error');
                                                                                    });
                                                                                } else {
                                                                                    connection.release();
                                                                                    req?.io?.emit('getTokenList', tokenList);
                                                                                    return res.status(200).send(sendJson);
                                                                                }
                                                                            });
                                                                        }
                                                                    }
                                                                }
                                                            });
                                                        }
                                                    });
                                                }
                                            });
                                        }
                                    });
                                }
                            });
                        }
                    } else {
                        connection.rollback(() => {
                            connection.release();
                            return res.status(404).send('Please Login First....!');
                        });
                    }
                }
            });
        } catch (error) {
            console.error('An error occurred', error);
            connection.rollback(() => {
                connection.release();
                return res.status(500).json('Internal Server Error');
            })
        }
    });
}

// Update PickUp Bill Data

const updatePickUpBillData = (req, res) => {
    pool2.getConnection((err, connection) => {
        if (err) {
            console.error("Error getting database connection:", err);
            return res.status(500).send('Database Error');
        }
        try {
            connection.beginTransaction((err) => {
                if (err) {
                    console.error("Error beginning transaction:", err);
                    connection.release();
                    return res.status(500).send('Database Error');
                } else {
                    let token;
                    token = req.headers ? req.headers.authorization.split(" ")[1] : null;
                    if (token) {
                        const decoded = jwt.verify(token, process.env.JWT_SECRET);
                        const cashier = decoded.id.firstName;
                        const branchId = decoded.id.branchId;

                        const currentDate = getCurrentDate();
                        const billData = req.body;
                        console.log(billData.billStatus);
                        if (!billData.billId || !branchId || !billData.customerDetails || !billData.subTotal || !billData.settledAmount || !billData.billPayType || !billData.billStatus || !billData.itemsData) {
                            connection.rollback(() => {
                                connection.release();
                                return res.status(404).send('Please Fill All The Fields..!');
                            })
                        } else {
                            let sql_query_chkOfficial = `SELECT billId, billNumber FROM billing_Official_data WHERE billId = '${billData.billId}';
                                                         SELECT COALESCE(MAX(billNumber),0) AS officialLastBillNo FROM billing_Official_data WHERE firmId = '${billData.firmId}' AND billCreationDate = (SELECT MAX(billCreationDate) FROM billing_Official_data WHERE firmId = '${billData.firmId}') FOR UPDATE`;
                            connection.query(sql_query_chkOfficial, (err, chkExist) => {
                                if (err) {
                                    console.error("Error check official bill exist or not:", err);
                                    connection.rollback(() => {
                                        connection.release();
                                        return res.status(500).send('Database Error');
                                    });
                                } else {
                                    console.log(chkExist);
                                    const isExist = chkExist && chkExist[0].length ? true : false;
                                    const staticBillNumber = chkExist && chkExist[0].length ? chkExist[0][0].billNumber : 0;
                                    const officialLastBillNo = chkExist && chkExist[1] ? chkExist[1][0].officialLastBillNo : 0;
                                    const nextOfficialBillNo = officialLastBillNo + 1;
                                    let sql_query_getBillInfo = `SELECT
                                                                     bd.billId AS billId,
                                                                     bd.billNumber AS billNumber,
                                                                     DATE_FORMAT(bd.billDate, '%d/%m/%Y') AS billDate,
                                                                     DATE_FORMAT(bd.billCreationDate, '%h:%i %p') AS billTime,
                                                                     btd.tokenNo AS tokenNo
                                                                 FROM
                                                                     billing_data AS bd
                                                                 LEFT JOIN billing_token_data AS btd ON btd.billId = bd.billId
                                                                 WHERE bd.billId = '${billData.billId}' AND bd.billType = 'Pick Up'`;
                                    connection.query(sql_query_getBillInfo, (err, billInfo) => {
                                        if (err) {
                                            console.error("Error inserting new bill number:", err);
                                            connection.rollback(() => {
                                                connection.release();
                                                return res.status(500).send('Database Error');
                                            });
                                        } else {
                                            if (billInfo && billInfo.length) {
                                                const billNumber = billInfo && billInfo[0] && billInfo[0].billNunber ? billInfo[0].billNumber : 0;
                                                const tokenNo = billInfo && billInfo[0] && billInfo[0].tokenNo ? billInfo[0].tokenNo : 0;
                                                const billDate = billInfo && billInfo[0] && billInfo[0].billDate ? billInfo[0].billDate : 0;
                                                const billTime = billInfo && billInfo[0] && billInfo[0].billTime ? billInfo[0].billTime : 0;
                                                const uid1 = new Date();
                                                const bwcId = String("bwc_" + uid1.getTime() + '_' + tokenNo);
                                                const newCustomerId = String("customer_" + uid1.getTime());
                                                const newAddressId = String("addressId_" + uid1.getTime());
                                                const bwuId = String("bwu_" + uid1.getTime());
                                                const dabId = String("dab_" + uid1.getTime());

                                                const columnData = `billId,
                                                                    firmId,
                                                                    branchId,
                                                                    cashier,
                                                                    menuStatus,
                                                                    billType,
                                                                    billPayType,
                                                                    discountType,
                                                                    discountValue,
                                                                    totalDiscount,
                                                                    totalAmount,
                                                                    settledAmount,
                                                                    billComment,
                                                                    billDate,
                                                                    billStatus`;
                                                const values = `'${billData.billId}',
                                                                '${billData.firmId}', 
                                                                '${branchId}',
                                                                '${cashier}', 
                                                                'Offline',
                                                                'Pick Up',
                                                                '${billData.billPayType}',
                                                                '${billData.discountType}',
                                                                ${billData.discountValue},
                                                                ${billData.totalDiscount},
                                                                ${billData.subTotal},
                                                                ${billData.settledAmount},
                                                                ${billData.billComment ? `'${billData.billComment}'` : null},
                                                                STR_TO_DATE('${currentDate}','%b %d %Y'),
                                                                '${billData.billStatus}'`;

                                                let updateColumnField = `cashier = '${cashier}', 
                                                                         billPayType = '${billData.billPayType}',
                                                                         discountType = '${billData.discountType}',
                                                                         discountValue = ${billData.discountValue},
                                                                         totalDiscount = ${billData.totalDiscount},
                                                                         totalAmount = ${billData.subTotal},
                                                                         settledAmount = ${billData.settledAmount},
                                                                         billComment = ${billData.billComment ? `'${billData.billComment}'` : null},
                                                                         billDate = STR_TO_DATE('${currentDate}','%b %d %Y'),
                                                                         billStatus = '${billData.billStatus}'`;

                                                let sql_querry_updateBillInfo = `UPDATE billing_data SET ${updateColumnField} WHERE billId = '${billData.billId}';
                                                                                 ${!isExist && billData.isOfficial ?
                                                        `INSERT INTO billing_Official_data (billNumber, ${columnData}) VALUES(${nextOfficialBillNo}, ${values})` :
                                                        `UPDATE billing_Official_data SET ${updateColumnField} WHERE billId = '${billData.billId}'`};
                                                         UPDATE billing_Complimentary_data SET ${updateColumnField} WHERE billId = '${billData.billId}'`;

                                                connection.query(sql_querry_updateBillInfo, (err) => {
                                                    if (err) {
                                                        console.error("Error inserting new bill number:", err);
                                                        connection.rollback(() => {
                                                            connection.release();
                                                            return res.status(500).send('Database Error');
                                                        });
                                                    } else {
                                                        let sql_query_removeOldItemData = `DELETE FROM billing_billWiseItem_data WHERE billId = '${billData.billId}';
                                                                                           DELETE FROM billing_itemWiseAddon_data WHERE iwbId IN (SELECT COALESCE(iwbId,NULL) FROM billing_billWiseItem_data WHERE billId = '${billData.billId}')`;
                                                        connection.query(sql_query_removeOldItemData, (err) => {
                                                            if (err) {
                                                                console.error("Error inserting Bill Wise Item Data:", err);
                                                                connection.rollback(() => {
                                                                    connection.release();
                                                                    return res.status(500).send('Database Error');
                                                                });
                                                            } else {
                                                                const billItemData = billData.itemsData

                                                                const addBillWiseItemData = [];
                                                                const addItemWiseAddonData = [];

                                                                billItemData.forEach((item, index) => {
                                                                    let uniqueId = `iwb_${Date.now() + index}_${index}`; // Unique ID generation

                                                                    // Construct SQL_Add_1 for the main item
                                                                    addBillWiseItemData.push(`('${uniqueId}', '${billData.billId}', '${branchId}', '${item.itemId}', ${item.qty}, '${item.unit}', ${item.itemPrice}, ${item.price}, ${item.comment ? `'${item.comment}'` : null}, 'Pick Up', '${billData.billPayType}', '${billData.billStatus}', STR_TO_DATE('${currentDate}','%b %d %Y'))`);

                                                                    // Construct SQL_Add_2 for the addons
                                                                    const allAddons = item.addons ? Object.keys(item.addons) : []
                                                                    if (allAddons && allAddons.length) {
                                                                        allAddons.forEach((addonId, addonIndex) => {
                                                                            let iwaId = `iwa_${Date.now() + addonIndex + index}_${index}`; // Unique ID for each addon
                                                                            addItemWiseAddonData.push(`('${iwaId}', '${uniqueId}', '${addonId}')`);
                                                                        });
                                                                    }
                                                                });

                                                                let sql_query_addItems = `INSERT INTO billing_billWiseItem_data(iwbId, billId, branchId, itemId, qty, unit, itemPrice, price, comment, billType, billPayType, billStatus, billDate)
                                                                                          VALUES ${addBillWiseItemData.join(", ")}`;
                                                                connection.query(sql_query_addItems, (err) => {
                                                                    if (err) {
                                                                        console.error("Error inserting Bill Wise Item Data:", err);
                                                                        connection.rollback(() => {
                                                                            connection.release();
                                                                            return res.status(500).send('Database Error');
                                                                        });
                                                                    } else {
                                                                        let sql_query_getFirmData = `SELECT firmId, firmName, gstNumber, firmAddress, pincode, firmMobileNo, otherMobileNo FROM billing_firm_data WHERE firmId = '${billData.firmId}';
                                                                                                     SELECT
                                                                                                        btd.tokenNo,
                                                                                                        bd.billStatus,
                                                                                                        bd.billId,
                                                                                                        bd.settledAmount,
                                                                                                        SEC_TO_TIME(
                                                                                                            TIMESTAMPDIFF(
                                                                                                                SECOND,
                                                                                                                bd.billCreationDate,
                                                                                                                NOW()
                                                                                                            )
                                                                                                        ) AS timeDifference
                                                                                                     FROM billing_token_data AS btd
                                                                                                     LEFT JOIN billing_data AS bd ON bd.billId = btd.billId
                                                                                                     WHERE btd.billType = 'Pick Up' AND bd.billStatus NOT IN ('complete','Cancel') AND btd.billDate = STR_TO_DATE('${currentDate}','%b %d %Y')
                                                                                                     ORDER BY btd.tokenNo ASC;
                                                                                                     DELETE FROM billing_billWiseUpi_data WHERE billId = '${billData.billId}';
                                                                                                     ${billData.accountId && billData.billPayType == 'due' ? `DELETE FROM due_billAmount_data WHERE billId = '${billData.billId};` : ''}
                                                                                ${addItemWiseAddonData.length ? `INSERT INTO billing_itemWiseAddon_data (iwaId, iwbId, addOnsId) VALUES ${addItemWiseAddonData.join(", ")};` : ''}
                                                                                ${billData.billPayType == 'online' && billData.onlineId && billData.onlineId != 'other'
                                                                                ?
                                                                                `INSERT INTO billing_billWiseUpi_data(bwuId, onlineId, billId, amount, onlineDate)
                                                                                 VALUES('${bwuId}', '${billData.onlineId}', '${billData.billId}', '${billData.settledAmount}', STR_TO_DATE('${currentDate}','%b %d %Y'))`
                                                                                :
                                                                                billData.accountId && billData.billPayType == 'due'
                                                                                    ?
                                                                                    `INSERT INTO due_billAmount_data(dabId, enterBy, accountId, billId, billAmount, dueNote, dueDate)
                                                                                     VALUES('${dabId}','${cashier}','${billData.accountId}','${billData.billId}',${billData.settledAmount},${billData.dueNote ? `'${billData.dueNote}'` : null}, STR_TO_DATE('${currentDate}','%b %d %Y'))`
                                                                                    :
                                                                                    ''}`;
                                                                        connection.query(sql_query_getFirmData, (err, firm) => {
                                                                            if (err) {
                                                                                console.error("Error inserting Bill Wise Item Data:", err);
                                                                                connection.rollback(() => {
                                                                                    connection.release();
                                                                                    return res.status(500).send('Database Error');
                                                                                });
                                                                            } else {
                                                                                const sendJson = {
                                                                                    ...billData,
                                                                                    firmData: firm[0][0],
                                                                                    cashier: cashier,
                                                                                    billNo: billNumber,
                                                                                    officialBillNo: !isExist && billData.isOfficial ? nextOfficialBillNo : staticBillNumber,
                                                                                    tokenNo: 'P' + tokenNo,
                                                                                    justToken: tokenNo,
                                                                                    billDate: billDate,
                                                                                    billTime: billTime
                                                                                }
                                                                                console.log(!isExist && billData.isOfficial ? nextOfficialBillNo : staticBillNumber)
                                                                                console.log(sendJson,)
                                                                                const tokenList = firm && firm[1].length ? firm[1] : null;
                                                                                const customerData = billData.customerDetails;
                                                                                if (customerData && customerData.customerId && customerData.addressId) {
                                                                                    let sql_query_addAddressRelation = `DELETE FROM billing_billWiseCustomer_data WHERE billId = '${billData.billId}';
                                                                                                                        INSERT INTO billing_billWiseCustomer_data(bwcId, billId, customerId, addressId, mobileNo, customerName, address, locality)
                                                                                                                        VALUES ('${bwcId}', '${billData.billId}', '${customerData.customerId}', '${customerData.addressId}', ${customerData.mobileNo ? `TRIM('${customerData.mobileNo}')` : null}, ${customerData.customerName ? `TRIM('${customerData.customerName}')` : null}, ${customerData.address ? `'${customerData.address}'` : null}, ${customerData.locality ? `'${customerData.locality}'` : null})`;
                                                                                    connection.query(sql_query_addAddressRelation, (err) => {
                                                                                        if (err) {
                                                                                            console.error("Error inserting Customer Bill Wise Data:", err);
                                                                                            connection.rollback(() => {
                                                                                                connection.release();
                                                                                                return res.status(500).send('Database Error');
                                                                                            });
                                                                                        } else {
                                                                                            connection.commit((err) => {
                                                                                                if (err) {
                                                                                                    console.error("Error committing transaction:", err);
                                                                                                    connection.rollback(() => {
                                                                                                        connection.release();
                                                                                                        return res.status(500).send('Database Error');
                                                                                                    });
                                                                                                } else {
                                                                                                    connection.release();
                                                                                                    req?.io?.emit('getTokenList', tokenList);
                                                                                                    return res.status(200).send(sendJson);
                                                                                                }
                                                                                            });
                                                                                        }
                                                                                    });
                                                                                } else if (customerData && customerData.customerId && customerData.address?.trim()) {
                                                                                    let sql_queries_chkOldAdd = `SELECT addressId, customerId FROM billing_customerAddress_data WHERE customerAddress = TRIM('${customerData.address}') AND customerLocality = '${customerData.locality}'`;
                                                                                    connection.query(sql_queries_chkOldAdd, (err, oldAdd) => {
                                                                                        if (err) {
                                                                                            console.error("Error inserting Customer New Address:", err);
                                                                                            connection.rollback(() => {
                                                                                                connection.release();
                                                                                                return res.status(500).send('Database Error');
                                                                                            });
                                                                                        } else {
                                                                                            if (oldAdd && oldAdd[0]) {
                                                                                                const existAddressId = oldAdd[0].addressId;
                                                                                                let sql_query_addAddressRelation = `DELETE FROM billing_billWiseCustomer_data WHERE billId = '${billData.billId}';
                                                                                                                                    INSERT INTO billing_billWiseCustomer_data(bwcId, billId, customerId, addressId, mobileNo, customerName, address, locality)
                                                                                                                                    VALUES ('${bwcId}', '${billData.billId}', '${customerData.customerId}', '${existAddressId}', ${customerData.mobileNo ? `TRIM('${customerData.mobileNo}')` : null}, ${customerData.customerName ? `TRIM('${customerData.customerName}')` : null}, ${customerData.address ? `'${customerData.address}'` : null}, ${customerData.locality ? `'${customerData.locality}'` : null})`;
                                                                                                connection.query(sql_query_addAddressRelation, (err) => {
                                                                                                    if (err) {
                                                                                                        console.error("Error inserting Customer Bill Wise Data:", err);
                                                                                                        connection.rollback(() => {
                                                                                                            connection.release();
                                                                                                            return res.status(500).send('Database Error');
                                                                                                        });
                                                                                                    } else {
                                                                                                        connection.commit((err) => {
                                                                                                            if (err) {
                                                                                                                console.error("Error committing transaction:", err);
                                                                                                                connection.rollback(() => {
                                                                                                                    connection.release();
                                                                                                                    return res.status(500).send('Database Error');
                                                                                                                });
                                                                                                            } else {
                                                                                                                connection.release();
                                                                                                                req?.io?.emit('getTokenList', tokenList);
                                                                                                                return res.status(200).send(sendJson);
                                                                                                            }
                                                                                                        });
                                                                                                    }
                                                                                                });
                                                                                            } else {
                                                                                                let sql_querry_addNewAddress = `INSERT INTO billing_customerAddress_data(addressId, customerId, customerAddress, customerLocality)
                                                                                                                                VALUES ('${newAddressId}', '${customerData.customerId}', TRIM('${customerData.address}'), ${customerData.locality ? `TRIM('${customerData.locality}')` : null})`;
                                                                                                connection.query(sql_querry_addNewAddress, (err) => {
                                                                                                    if (err) {
                                                                                                        console.error("Error inserting Customer New Address:", err);
                                                                                                        connection.rollback(() => {
                                                                                                            connection.release();
                                                                                                            return res.status(500).send('Database Error');
                                                                                                        });
                                                                                                    } else {
                                                                                                        let sql_query_addAddressRelation = `DELETE FROM billing_billWiseCustomer_data WHERE billId = '${billData.billId}';
                                                                                                                                            INSERT INTO billing_billWiseCustomer_data(bwcId, billId, customerId, addressId, mobileNo, customerName, address, locality)
                                                                                                                                            VALUES ('${bwcId}', '${billData.billId}', '${customerData.customerId}', '${newAddressId}', ${customerData.mobileNo ? `TRIM('${customerData.mobileNo}')` : null}, ${customerData.customerName ? `TRIM('${customerData.customerName}')` : null}, ${customerData.address ? `'${customerData.address}'` : null}, ${customerData.locality ? `'${customerData.locality}'` : null})`;
                                                                                                        connection.query(sql_query_addAddressRelation, (err) => {
                                                                                                            if (err) {
                                                                                                                console.error("Error inserting Customer Bill Wise Data:", err);
                                                                                                                connection.rollback(() => {
                                                                                                                    connection.release();
                                                                                                                    return res.status(500).send('Database Error');
                                                                                                                });
                                                                                                            } else {
                                                                                                                connection.commit((err) => {
                                                                                                                    if (err) {
                                                                                                                        console.error("Error committing transaction:", err);
                                                                                                                        connection.rollback(() => {
                                                                                                                            connection.release();
                                                                                                                            return res.status(500).send('Database Error');
                                                                                                                        });
                                                                                                                    } else {
                                                                                                                        connection.release();
                                                                                                                        req?.io?.emit('getTokenList', tokenList);
                                                                                                                        return res.status(200).send(sendJson);
                                                                                                                    }
                                                                                                                });
                                                                                                            }
                                                                                                        });
                                                                                                    }
                                                                                                })
                                                                                            }
                                                                                        }
                                                                                    });
                                                                                } else if (customerData && customerData.customerId) {
                                                                                    let sql_query_addAddressRelation = `DELETE FROM billing_billWiseCustomer_data WHERE billId = '${billData.billId}';
                                                                                                                        INSERT INTO billing_billWiseCustomer_data(bwcId, billId, customerId, addressId, mobileNo, customerName, address, locality)
                                                                                                                        VALUES ('${bwcId}', '${billData.billId}', '${customerData.customerId}', ${customerData.addressId ? `'${customerData.addressId}'` : null}, ${customerData.mobileNo ? `TRIM('${customerData.mobileNo}')` : null}, ${customerData.customerName ? `TRIM('${customerData.customerName}')` : null}, ${customerData.address ? `'${customerData.address}'` : null}, ${customerData.locality ? `'${customerData.locality}'` : null})`;
                                                                                    connection.query(sql_query_addAddressRelation, (err) => {
                                                                                        if (err) {
                                                                                            console.error("Error inserting Customer Bill Wise Data:", err);
                                                                                            connection.rollback(() => {
                                                                                                connection.release();
                                                                                                return res.status(500).send('Database Error');
                                                                                            });
                                                                                        } else {
                                                                                            connection.commit((err) => {
                                                                                                if (err) {
                                                                                                    console.error("Error committing transaction:", err);
                                                                                                    connection.rollback(() => {
                                                                                                        connection.release();
                                                                                                        return res.status(500).send('Database Error');
                                                                                                    });
                                                                                                } else {
                                                                                                    connection.release();
                                                                                                    req?.io?.emit('getTokenList', tokenList);
                                                                                                    return res.status(200).send(sendJson);
                                                                                                }
                                                                                            });
                                                                                        }
                                                                                    });
                                                                                } else {
                                                                                    if (customerData && (customerData.customerName || customerData.mobileNo)) {
                                                                                        let sql_querry_getExistCustomer = `SELECT customerId, customerMobileNumber FROM billing_customer_data WHERE customerMobileNumber = '${customerData.mobileNo}'`;
                                                                                        connection.query(sql_querry_getExistCustomer, (err, num) => {
                                                                                            if (err) {
                                                                                                console.error("Error Get Existing Customer Data:", err);
                                                                                                connection.rollback(() => {
                                                                                                    connection.release();
                                                                                                    return res.status(500).send('Database Error');
                                                                                                });
                                                                                            } else {
                                                                                                const existCustomerId = num && num[0] ? num[0].customerId : null;
                                                                                                if (existCustomerId && customerData.address) {
                                                                                                    let sql_queries_chkOldAdd = `SELECT addressId, customerId FROM billing_customerAddress_data WHERE customerAddress = TRIM('${customerData.address}') AND customerLocality = '${customerData.locality}'`;
                                                                                                    connection.query(sql_queries_chkOldAdd, (err, oldAdd) => {
                                                                                                        if (err) {
                                                                                                            console.error("Error inserting Customer New Address:", err);
                                                                                                            connection.rollback(() => {
                                                                                                                connection.release();
                                                                                                                return res.status(500).send('Database Error');
                                                                                                            });
                                                                                                        } else {
                                                                                                            if (oldAdd && oldAdd[0]) {
                                                                                                                const existAddressId = oldAdd[0].addressId;
                                                                                                                let sql_query_addAddressRelation = `DELETE FROM billing_billWiseCustomer_data WHERE billId = '${billData.billId}';
                                                                                                                                                    INSERT INTO billing_billWiseCustomer_data(bwcId, billId, customerId, addressId, mobileNo, customerName, address, locality)
                                                                                                                                                    VALUES ('${bwcId}', '${billData.billId}', '${existCustomerId}', '${existAddressId}', ${customerData.mobileNo ? `TRIM('${customerData.mobileNo}')` : null}, ${customerData.customerName ? `TRIM('${customerData.customerName}')` : null}, ${customerData.address ? `'${customerData.address}'` : null}, ${customerData.locality ? `'${customerData.locality}'` : null})`;
                                                                                                                connection.query(sql_query_addAddressRelation, (err) => {
                                                                                                                    if (err) {
                                                                                                                        console.error("Error inserting Customer Bill Wise Data:", err);
                                                                                                                        connection.rollback(() => {
                                                                                                                            connection.release();
                                                                                                                            return res.status(500).send('Database Error');
                                                                                                                        });
                                                                                                                    } else {
                                                                                                                        connection.commit((err) => {
                                                                                                                            if (err) {
                                                                                                                                console.error("Error committing transaction:", err);
                                                                                                                                connection.rollback(() => {
                                                                                                                                    connection.release();
                                                                                                                                    return res.status(500).send('Database Error');
                                                                                                                                });
                                                                                                                            } else {
                                                                                                                                connection.release();
                                                                                                                                req?.io?.emit('getTokenList', tokenList);
                                                                                                                                return res.status(200).send(sendJson);
                                                                                                                            }
                                                                                                                        });
                                                                                                                    }
                                                                                                                });
                                                                                                            } else {
                                                                                                                let sql_querry_addNewAddress = `INSERT INTO billing_customerAddress_data(addressId, customerId, customerAddress, customerLocality)
                                                                                                                                                VALUES ('${newAddressId}', '${existCustomerId}', TRIM('${customerData.address}'), ${customerData.locality ? `TRIM('${customerData.locality}')` : null})`;
                                                                                                                connection.query(sql_querry_addNewAddress, (err) => {
                                                                                                                    if (err) {
                                                                                                                        console.error("Error inserting Customer New Address:", err);
                                                                                                                        connection.rollback(() => {
                                                                                                                            connection.release();
                                                                                                                            return res.status(500).send('Database Error');
                                                                                                                        });
                                                                                                                    } else {
                                                                                                                        let sql_query_addAddressRelation = `DELETE FROM billing_billWiseCustomer_data WHERE billId = '${billData.billId}';
                                                                                                                                                            INSERT INTO billing_billWiseCustomer_data(bwcId, billId, customerId, addressId, mobileNo, customerName, address, locality)
                                                                                                                                                            VALUES ('${bwcId}', '${billData.billId}', '${existCustomerId}', '${newAddressId}', ${customerData.mobileNo ? `TRIM('${customerData.mobileNo}')` : null}, ${customerData.customerName ? `TRIM('${customerData.customerName}')` : null}, ${customerData.address ? `'${customerData.address}'` : null}, ${customerData.locality ? `'${customerData.locality}'` : null})`;
                                                                                                                        connection.query(sql_query_addAddressRelation, (err) => {
                                                                                                                            if (err) {
                                                                                                                                console.error("Error inserting Customer Bill Wise Data:", err);
                                                                                                                                connection.rollback(() => {
                                                                                                                                    connection.release();
                                                                                                                                    return res.status(500).send('Database Error');
                                                                                                                                });
                                                                                                                            } else {
                                                                                                                                connection.commit((err) => {
                                                                                                                                    if (err) {
                                                                                                                                        console.error("Error committing transaction:", err);
                                                                                                                                        connection.rollback(() => {
                                                                                                                                            connection.release();
                                                                                                                                            return res.status(500).send('Database Error');
                                                                                                                                        });
                                                                                                                                    } else {
                                                                                                                                        connection.release();
                                                                                                                                        req?.io?.emit('getTokenList', tokenList);
                                                                                                                                        return res.status(200).send(sendJson);
                                                                                                                                    }
                                                                                                                                });
                                                                                                                            }
                                                                                                                        });
                                                                                                                    }
                                                                                                                })
                                                                                                            }
                                                                                                        }
                                                                                                    })
                                                                                                } else if (customerData.address?.trim()) {
                                                                                                    let sql_querry_addNewCustomer = `INSERT INTO billing_customer_data(customerId, branchId, customerName, customerMobileNumber, birthDate, anniversaryDate)
                                                                                                                                     VALUES ('${newCustomerId}', '${branchId}', ${customerData.customerName ? `TRIM('${customerData.customerName}')` : null}, ${customerData.mobileNo ? `'${customerData.mobileNo}'` : null}, ${customerData.birthDate ? `STR_TO_DATE('${customerData.birthDate}','%b %d %Y')` : null}, ${customerData.aniversaryDate ? `STR_TO_DATE('${customerData.aniversaryDate}','%b %d %Y')` : null})`;
                                                                                                    connection.query(sql_querry_addNewCustomer, (err) => {
                                                                                                        if (err) {
                                                                                                            console.error("Error inserting New Customer Data:", err);
                                                                                                            connection.rollback(() => {
                                                                                                                connection.release();
                                                                                                                return res.status(500).send('Database Error');
                                                                                                            });
                                                                                                        } else {
                                                                                                            let sql_querry_addNewAddress = `INSERT INTO billing_customerAddress_data(addressId, customerId, customerAddress, customerLocality)
                                                                                                                                            VALUES ('${newAddressId}', '${newCustomerId}', TRIM('${customerData.address}'), ${customerData.locality ? `TRIM('${customerData.locality}')` : null})`;
                                                                                                            connection.query(sql_querry_addNewAddress, (err) => {
                                                                                                                if (err) {
                                                                                                                    console.error("Error inserting Customer New Address:", err);
                                                                                                                    connection.rollback(() => {
                                                                                                                        connection.release();
                                                                                                                        return res.status(500).send('Database Error');
                                                                                                                    });
                                                                                                                } else {
                                                                                                                    let sql_query_addAddressRelation = `DELETE FROM billing_billWiseCustomer_data WHERE billId = '${billData.billId}';
                                                                                                                                                        INSERT INTO billing_billWiseCustomer_data(bwcId, billId, customerId, addressId, mobileNo, customerName, address, locality)
                                                                                                                                                        VALUES ('${bwcId}', '${billData.billId}', '${newCustomerId}', '${newAddressId}', ${customerData.mobileNo ? `TRIM('${customerData.mobileNo}')` : null}, ${customerData.customerName ? `TRIM('${customerData.customerName}')` : null}, ${customerData.address ? `'${customerData.address}'` : null}, ${customerData.locality ? `'${customerData.locality}'` : null})`;
                                                                                                                    connection.query(sql_query_addAddressRelation, (err) => {
                                                                                                                        if (err) {
                                                                                                                            console.error("Error inserting Customer Bill Wise Data:", err);
                                                                                                                            connection.rollback(() => {
                                                                                                                                connection.release();
                                                                                                                                return res.status(500).send('Database Error');
                                                                                                                            });
                                                                                                                        } else {
                                                                                                                            connection.commit((err) => {
                                                                                                                                if (err) {
                                                                                                                                    console.error("Error committing transaction:", err);
                                                                                                                                    connection.rollback(() => {
                                                                                                                                        connection.release();
                                                                                                                                        return res.status(500).send('Database Error');
                                                                                                                                    });
                                                                                                                                } else {
                                                                                                                                    connection.release();
                                                                                                                                    req?.io?.emit('getTokenList', tokenList);
                                                                                                                                    return res.status(200).send(sendJson);
                                                                                                                                }
                                                                                                                            });
                                                                                                                        }
                                                                                                                    });
                                                                                                                }
                                                                                                            })
                                                                                                        }
                                                                                                    })
                                                                                                } else if (existCustomerId) {
                                                                                                    let sql_query_addAddressRelation = `DELETE FROM billing_billWiseCustomer_data WHERE billId = '${billData.billId}';
                                                                                                                                        INSERT INTO billing_billWiseCustomer_data(bwcId, billId, customerId, addressId, mobileNo, customerName, address, locality)
                                                                                                                                        VALUES ('${bwcId}', '${billData.billId}', '${existCustomerId}', NULL, ${customerData.mobileNo ? `TRIM('${customerData.mobileNo}')` : null}, ${customerData.customerName ? `TRIM('${customerData.customerName}')` : null}, ${customerData.address ? `'${customerData.address}'` : null}, ${customerData.locality ? `'${customerData.locality}'` : null})`;
                                                                                                    connection.query(sql_query_addAddressRelation, (err) => {
                                                                                                        if (err) {
                                                                                                            console.error("Error inserting Customer Bill Wise Data:", err);
                                                                                                            connection.rollback(() => {
                                                                                                                connection.release();
                                                                                                                return res.status(500).send('Database Error');
                                                                                                            });
                                                                                                        } else {
                                                                                                            connection.commit((err) => {
                                                                                                                if (err) {
                                                                                                                    console.error("Error committing transaction:", err);
                                                                                                                    connection.rollback(() => {
                                                                                                                        connection.release();
                                                                                                                        return res.status(500).send('Database Error');
                                                                                                                    });
                                                                                                                } else {
                                                                                                                    connection.release();
                                                                                                                    req?.io?.emit('getTokenList', tokenList);
                                                                                                                    return res.status(200).send(sendJson);
                                                                                                                }
                                                                                                            });
                                                                                                        }
                                                                                                    });
                                                                                                } else if (customerData.mobileNo) {
                                                                                                    let sql_querry_addNewCustomer = `INSERT INTO billing_customer_data(customerId, branchId, customerName, customerMobileNumber, birthDate, anniversaryDate)
                                                                                                                                     VALUES ('${newCustomerId}', '${branchId}', ${customerData.customerName ? `TRIM('${customerData.customerName}')` : null}, ${customerData.mobileNo ? `'${customerData.mobileNo}'` : null}, ${customerData.birthDate ? `STR_TO_DATE('${customerData.birthDate}','%b %d %Y')` : null}, ${customerData.aniversaryDate ? `STR_TO_DATE('${customerData.aniversaryDate}','%b %d %Y')` : null})`;
                                                                                                    connection.query(sql_querry_addNewCustomer, (err) => {
                                                                                                        if (err) {
                                                                                                            console.error("Error inserting New Customer Data:", err);
                                                                                                            connection.rollback(() => {
                                                                                                                connection.release();
                                                                                                                return res.status(500).send('Database Error');
                                                                                                            });
                                                                                                        } else {
                                                                                                            let sql_query_addAddressRelation = `DELETE FROM billing_billWiseCustomer_data WHERE billId = '${billData.billId}';
                                                                                                                                                INSERT INTO billing_billWiseCustomer_data(bwcId, billId, customerId, addressId, mobileNo, customerName, address, locality)
                                                                                                                                                VALUES ('${bwcId}', '${billData.billId}', '${newCustomerId}', NULL, ${customerData.mobileNo ? `TRIM('${customerData.mobileNo}')` : null}, ${customerData.customerName ? `TRIM('${customerData.customerName}')` : null}, ${customerData.address ? `'${customerData.address}'` : null}, ${customerData.locality ? `'${customerData.locality}'` : null})`;
                                                                                                            connection.query(sql_query_addAddressRelation, (err) => {
                                                                                                                if (err) {
                                                                                                                    console.error("Error inserting Customer Bill Wise Data:", err);
                                                                                                                    connection.rollback(() => {
                                                                                                                        connection.release();
                                                                                                                        return res.status(500).send('Database Error');
                                                                                                                    });
                                                                                                                } else {
                                                                                                                    connection.commit((err) => {
                                                                                                                        if (err) {
                                                                                                                            console.error("Error committing transaction:", err);
                                                                                                                            connection.rollback(() => {
                                                                                                                                connection.release();
                                                                                                                                return res.status(500).send('Database Error');
                                                                                                                            });
                                                                                                                        } else {
                                                                                                                            connection.release();
                                                                                                                            req?.io?.emit('getTokenList', tokenList);
                                                                                                                            return res.status(200).send(sendJson);
                                                                                                                        }
                                                                                                                    });
                                                                                                                }
                                                                                                            });
                                                                                                        }
                                                                                                    })
                                                                                                } else {
                                                                                                    let sql_query_addAddressRelation = `DELETE FROM billing_billWiseCustomer_data WHERE billId = '${billData.billId}';
                                                                                                                                        INSERT INTO billing_billWiseCustomer_data(bwcId, billId, customerId, addressId, mobileNo, customerName, address, locality)
                                                                                                                                        VALUES ('${bwcId}', '${billData.billId}', NULL, NULL, ${customerData.mobileNo ? `TRIM('${customerData.mobileNo}')` : null}, ${customerData.customerName ? `TRIM('${customerData.customerName}')` : null}, ${customerData.address ? `'${customerData.address}'` : null}, ${customerData.locality ? `'${customerData.locality}'` : null})`;
                                                                                                    connection.query(sql_query_addAddressRelation, (err) => {
                                                                                                        if (err) {
                                                                                                            console.error("Error inserting Customer Bill Wise Data:", err);
                                                                                                            connection.rollback(() => {
                                                                                                                connection.release();
                                                                                                                return res.status(500).send('Database Error');
                                                                                                            });
                                                                                                        } else {
                                                                                                            connection.commit((err) => {
                                                                                                                if (err) {
                                                                                                                    console.error("Error committing transaction:", err);
                                                                                                                    connection.rollback(() => {
                                                                                                                        connection.release();
                                                                                                                        return res.status(500).send('Database Error');
                                                                                                                    });
                                                                                                                } else {
                                                                                                                    connection.release();
                                                                                                                    req?.io?.emit('getTokenList', tokenList);
                                                                                                                    return res.status(200).send(sendJson);
                                                                                                                }
                                                                                                            });
                                                                                                        }
                                                                                                    });
                                                                                                }
                                                                                            }
                                                                                        })
                                                                                    } else if (customerData.address?.trim() || customerData.locality?.trim()) {
                                                                                        let sql_query_addAddressRelation = `DELETE FROM billing_billWiseCustomer_data WHERE billId = '${billData.billId}';
                                                                                                                            INSERT INTO billing_billWiseCustomer_data(bwcId, billId, customerId, addressId, mobileNo, customerName, address, locality)
                                                                                                                            VALUES ('${bwcId}', '${billData.billId}', NULL, NULL, ${customerData.mobileNo ? `TRIM('${customerData.mobileNo}')` : null}, ${customerData.customerName ? `TRIM('${customerData.customerName}')` : null}, ${customerData.address ? `'${customerData.address}'` : null}, ${customerData.locality ? `'${customerData.locality}'` : null})`;
                                                                                        connection.query(sql_query_addAddressRelation, (err) => {
                                                                                            if (err) {
                                                                                                console.error("Error inserting Customer Bill Wise Data:", err);
                                                                                                connection.rollback(() => {
                                                                                                    connection.release();
                                                                                                    return res.status(500).send('Database Error');
                                                                                                });
                                                                                            } else {
                                                                                                connection.commit((err) => {
                                                                                                    if (err) {
                                                                                                        console.error("Error committing transaction:", err);
                                                                                                        connection.rollback(() => {
                                                                                                            connection.release();
                                                                                                            return res.status(500).send('Database Error');
                                                                                                        });
                                                                                                    } else {
                                                                                                        connection.release();
                                                                                                        req?.io?.emit('getTokenList', tokenList);
                                                                                                        return res.status(200).send(sendJson);
                                                                                                    }
                                                                                                });
                                                                                            }
                                                                                        });
                                                                                    } else {
                                                                                        connection.commit((err) => {
                                                                                            if (err) {
                                                                                                console.error("Error committing transaction:", err);
                                                                                                connection.rollback(() => {
                                                                                                    connection.release();
                                                                                                    return res.status(500).send('Database Error');
                                                                                                });
                                                                                            } else {
                                                                                                connection.release();
                                                                                                req?.io?.emit('getTokenList', tokenList);
                                                                                                return res.status(200).send(sendJson);
                                                                                            }
                                                                                        });
                                                                                    }
                                                                                }
                                                                            }
                                                                        });
                                                                    }
                                                                });
                                                            }
                                                        });
                                                    }
                                                });
                                            } else {
                                                connection.rollback(() => {
                                                    connection.release();
                                                    return res.status(404).send('billId Not Found...!');
                                                })
                                            }
                                        }
                                    })
                                }
                            })
                        }
                    } else {
                        connection.rollback(() => {
                            connection.release();
                            return res.status(404).send('Please Login First....!');
                        });
                    }
                }
            });
        } catch (error) {
            console.error('An error occurred', error);
            connection.rollback(() => {
                connection.release();
                return res.status(500).json('Internal Server Error');
            })
        }
    });
}

// Update Delivery Bill Data

const updateDeliveryBillData = (req, res) => {
    pool2.getConnection((err, connection) => {
        if (err) {
            console.error("Error getting database connection:", err);
            return res.status(500).send('Database Error');
        }
        try {
            connection.beginTransaction((err) => {
                if (err) {
                    console.error("Error beginning transaction:", err);
                    connection.release();
                    return res.status(500).send('Database Error');
                } else {
                    let token;
                    token = req.headers ? req.headers.authorization.split(" ")[1] : null;
                    if (token) {
                        const decoded = jwt.verify(token, process.env.JWT_SECRET);
                        const cashier = decoded.id.firstName;
                        const branchId = decoded.id.branchId;

                        const currentDate = getCurrentDate();
                        const billData = req.body;
                        console.log(billData.billStatus);
                        if (!billData.billId || !branchId || !billData.customerDetails || !billData.subTotal || !billData.settledAmount || !billData.billPayType || !billData.billStatus || !billData.itemsData || !billData.customerDetails.mobileNo) {
                            connection.rollback(() => {
                                connection.release();
                                return res.status(404).send('Please Fill All The Fields..!');
                            })
                        } else {
                            let sql_query_chkOfficial = `SELECT billId, billNumber FROM billing_Official_data WHERE billId = '${billData.billId}';
                                                         SELECT COALESCE(MAX(billNumber),0) AS officialLastBillNo FROM billing_Official_data WHERE firmId = '${billData.firmId}' AND billCreationDate = (SELECT MAX(billCreationDate) FROM billing_Official_data WHERE firmId = '${billData.firmId}') FOR UPDATE`;
                            connection.query(sql_query_chkOfficial, (err, chkExist) => {
                                if (err) {
                                    console.error("Error check official bill exist or not:", err);
                                    connection.rollback(() => {
                                        connection.release();
                                        return res.status(500).send('Database Error');
                                    });
                                } else {
                                    console.log(chkExist);
                                    const isExist = chkExist && chkExist[0].length ? true : false;
                                    const staticBillNumber = chkExist && chkExist[0].length ? chkExist[0][0].billNumber : 0;
                                    const officialLastBillNo = chkExist && chkExist[1] ? chkExist[1][0].officialLastBillNo : 0;
                                    const nextOfficialBillNo = officialLastBillNo + 1;
                                    let sql_query_getBillInfo = `SELECT
                                                                     bd.billId AS billId,
                                                                     bd.billNumber AS billNumber,
                                                                     DATE_FORMAT(bd.billDate, '%d/%m/%Y') AS billDate,
                                                                     DATE_FORMAT(bd.billCreationDate, '%h:%i %p') AS billTime,
                                                                     btd.tokenNo AS tokenNo
                                                                 FROM
                                                                     billing_data AS bd
                                                                 LEFT JOIN billing_token_data AS btd ON btd.billId = bd.billId
                                                                 WHERE bd.billId = '${billData.billId}' AND bd.billType = 'Pick Up'`;
                                    connection.query(sql_query_getBillInfo, (err, billInfo) => {
                                        if (err) {
                                            console.error("Error inserting new bill number:", err);
                                            connection.rollback(() => {
                                                connection.release();
                                                return res.status(500).send('Database Error');
                                            });
                                        } else {
                                            if (billInfo && billInfo.length) {
                                                const billNumber = billInfo && billInfo[0] && billInfo[0].billNunber ? billInfo[0].billNumber : 0;
                                                const tokenNo = billInfo && billInfo[0] && billInfo[0].tokenNo ? billInfo[0].tokenNo : 0;
                                                const billDate = billInfo && billInfo[0] && billInfo[0].billDate ? billInfo[0].billDate : 0;
                                                const billTime = billInfo && billInfo[0] && billInfo[0].billTime ? billInfo[0].billTime : 0;
                                                const uid1 = new Date();
                                                const bwcId = String("bwc_" + uid1.getTime() + '_' + tokenNo);
                                                const newCustomerId = String("customer_" + uid1.getTime());
                                                const newAddressId = String("addressId_" + uid1.getTime());
                                                const bwuId = String("bwu_" + uid1.getTime());
                                                const dabId = String("dab_" + uid1.getTime());

                                                const columnData = `billId,
                                                                    firmId,
                                                                    branchId,
                                                                    cashier,
                                                                    menuStatus,
                                                                    billType,
                                                                    billPayType,
                                                                    discountType,
                                                                    discountValue,
                                                                    totalDiscount,
                                                                    totalAmount,
                                                                    settledAmount,
                                                                    billComment,
                                                                    billDate,
                                                                    billStatus`;
                                                const values = `'${billData.billId}',
                                                                '${billData.firmId}', 
                                                                '${branchId}',
                                                                '${cashier}', 
                                                                'Offline',
                                                                'Delivery',
                                                                '${billData.billPayType}',
                                                                '${billData.discountType}',
                                                                ${billData.discountValue},
                                                                ${billData.totalDiscount},
                                                                ${billData.subTotal},
                                                                ${billData.settledAmount},
                                                                ${billData.billComment ? `'${billData.billComment}'` : null},
                                                                STR_TO_DATE('${currentDate}','%b %d %Y'),
                                                                '${billData.billStatus}'`;

                                                let updateColumnField = `cashier = '${cashier}', 
                                                                         billPayType = '${billData.billPayType}',
                                                                         discountType = '${billData.discountType}',
                                                                         discountValue = ${billData.discountValue},
                                                                         totalDiscount = ${billData.totalDiscount},
                                                                         totalAmount = ${billData.subTotal},
                                                                         settledAmount = ${billData.settledAmount},
                                                                         billComment = ${billData.billComment ? `'${billData.billComment}'` : null},
                                                                         billDate = STR_TO_DATE('${currentDate}','%b %d %Y'),
                                                                         billStatus = '${billData.billStatus}'`;

                                                let sql_querry_updateBillInfo = `UPDATE billing_data SET ${updateColumnField} WHERE billId = '${billData.billId}';
                                                                                 ${!isExist && billData.isOfficial ?
                                                        `INSERT INTO billing_Official_data (billNumber, ${columnData}) VALUES(${nextOfficialBillNo}, ${values})` :
                                                        `UPDATE billing_Official_data SET ${updateColumnField} WHERE billId = '${billData.billId}'`};
                                                         UPDATE billing_Complimentary_data SET ${updateColumnField} WHERE billId = '${billData.billId}'`;

                                                connection.query(sql_querry_updateBillInfo, (err) => {
                                                    if (err) {
                                                        console.error("Error inserting new bill number:", err);
                                                        connection.rollback(() => {
                                                            connection.release();
                                                            return res.status(500).send('Database Error');
                                                        });
                                                    } else {
                                                        let sql_query_removeOldItemData = `DELETE FROM billing_billWiseItem_data WHERE billId = '${billData.billId}';
                                                                                           DELETE FROM billing_itemWiseAddon_data WHERE iwbId IN (SELECT COALESCE(iwbId,NULL) FROM billing_billWiseItem_data WHERE billId = '${billData.billId}')`;
                                                        connection.query(sql_query_removeOldItemData, (err) => {
                                                            if (err) {
                                                                console.error("Error inserting Bill Wise Item Data:", err);
                                                                connection.rollback(() => {
                                                                    connection.release();
                                                                    return res.status(500).send('Database Error');
                                                                });
                                                            } else {
                                                                const billItemData = billData.itemsData

                                                                const addBillWiseItemData = [];
                                                                const addItemWiseAddonData = [];

                                                                billItemData.forEach((item, index) => {
                                                                    let uniqueId = `iwb_${Date.now() + index}_${index}`; // Unique ID generation

                                                                    // Construct SQL_Add_1 for the main item
                                                                    addBillWiseItemData.push(`('${uniqueId}', '${billData.billId}', '${branchId}', '${item.itemId}', ${item.qty}, '${item.unit}', ${item.itemPrice}, ${item.price}, ${item.comment ? `'${item.comment}'` : null}, 'Delivery', '${billData.billPayType}', '${billData.billStatus}', STR_TO_DATE('${currentDate}','%b %d %Y'))`);

                                                                    // Construct SQL_Add_2 for the addons
                                                                    const allAddons = item.addons ? Object.keys(item.addons) : []
                                                                    if (allAddons && allAddons.length) {
                                                                        allAddons.forEach((addonId, addonIndex) => {
                                                                            let iwaId = `iwa_${Date.now() + addonIndex + index}_${index}`; // Unique ID for each addon
                                                                            addItemWiseAddonData.push(`('${iwaId}', '${uniqueId}', '${addonId}')`);
                                                                        });
                                                                    }
                                                                });
                                                                let sql_query_addItems = `INSERT INTO billing_billWiseItem_data(iwbId, billId, branchId, itemId, qty, unit, itemPrice, price, comment, billType, billPayType, billStatus, billDate)
                                                                                          VALUES ${addBillWiseItemData.join(", ")}`;
                                                                connection.query(sql_query_addItems, (err) => {
                                                                    if (err) {
                                                                        console.error("Error inserting Bill Wise Item Data:", err);
                                                                        connection.rollback(() => {
                                                                            connection.release();
                                                                            return res.status(500).send('Database Error');
                                                                        });
                                                                    } else {
                                                                        let sql_query_getFirmData = `SELECT firmId, firmName, gstNumber, firmAddress, pincode, firmMobileNo, otherMobileNo FROM billing_firm_data WHERE firmId = '${billData.firmId}';
                                                                                                     SELECT
                                                                                                        btd.tokenNo,
                                                                                                        bd.billStatus,
                                                                                                        bd.billId,
                                                                                                        bd.settledAmount,
                                                                                                        SEC_TO_TIME(
                                                                                                            TIMESTAMPDIFF(
                                                                                                                SECOND,
                                                                                                                bd.billCreationDate,
                                                                                                                NOW()
                                                                                                            )
                                                                                                        ) AS timeDifference
                                                                                                     FROM billing_token_data AS btd
                                                                                                     LEFT JOIN billing_data AS bd ON bd.billId = btd.billId
                                                                                                     WHERE btd.billType = 'Pick Up' AND bd.billStatus NOT IN ('complete','Cancel') AND btd.billDate = STR_TO_DATE('${currentDate}','%b %d %Y')
                                                                                                     ORDER BY btd.tokenNo ASC;
                                                                                                     DELETE FROM billing_billWiseUpi_data WHERE billId = '${billData.billId}';
                                                                                                     ${billData.accountId && billData.billPayType == 'due' ? `DELETE FROM due_billAmount_data WHERE billId = '${billData.billId};` : ''}
                                                                                ${addItemWiseAddonData.length ? `INSERT INTO billing_itemWiseAddon_data (iwaId, iwbId, addOnsId) VALUES ${addItemWiseAddonData.join(", ")};` : ''}
                                                                                ${billData.billPayType == 'online' && billData.onlineId && billData.onlineId != 'other'
                                                                                ?
                                                                                `INSERT INTO billing_billWiseUpi_data(bwuId, onlineId, billId, amount, onlineDate)
                                                                                 VALUES('${bwuId}', '${billData.onlineId}', '${billData.billId}', '${billData.settledAmount}', STR_TO_DATE('${currentDate}','%b %d %Y'))`
                                                                                :
                                                                                billData.accountId && billData.billPayType == 'due'
                                                                                    ?
                                                                                    `INSERT INTO due_billAmount_data(dabId, enterBy, accountId, billId, billAmount, dueNote, dueDate)
                                                                                     VALUES('${dabId}','${cashier}','${billData.accountId}','${billData.billId}',${billData.settledAmount},${billData.dueNote ? `'${billData.dueNote}'` : null}, STR_TO_DATE('${currentDate}','%b %d %Y'))`
                                                                                    :
                                                                                    ''}`;
                                                                        connection.query(sql_query_getFirmData, (err, firm) => {
                                                                            if (err) {
                                                                                console.error("Error inserting Bill Wise Item Data:", err);
                                                                                connection.rollback(() => {
                                                                                    connection.release();
                                                                                    return res.status(500).send('Database Error');
                                                                                });
                                                                            } else {
                                                                                const sendJson = {
                                                                                    ...billData,
                                                                                    firmData: firm[0][0],
                                                                                    cashier: cashier,
                                                                                    billNo: billNumber,
                                                                                    officialBillNo: !isExist && billData.isOfficial ? nextOfficialBillNo : staticBillNumber,
                                                                                    tokenNo: 'D' + tokenNo,
                                                                                    justToken: tokenNo,
                                                                                    billDate: billDate,
                                                                                    billTime: billTime
                                                                                }
                                                                                console.log(!isExist && billData.isOfficial ? nextOfficialBillNo : staticBillNumber)
                                                                                console.log(sendJson,)
                                                                                const tokenList = firm && firm[1].length ? firm[1] : null;
                                                                                const customerData = billData.customerDetails;
                                                                                if (customerData && customerData.customerId && customerData.addressId) {
                                                                                    let sql_query_addAddressRelation = `DELETE FROM billing_billWiseCustomer_data WHERE billId = '${billData.billId}';
                                                                                                                        INSERT INTO billing_billWiseCustomer_data(bwcId, billId, customerId, addressId, mobileNo, customerName, address, locality)
                                                                                                                        VALUES ('${bwcId}', '${billData.billId}', '${customerData.customerId}', '${customerData.addressId}', ${customerData.mobileNo ? `TRIM('${customerData.mobileNo}')` : null}, ${customerData.customerName ? `TRIM('${customerData.customerName}')` : null}, ${customerData.address ? `'${customerData.address}'` : null}, ${customerData.locality ? `'${customerData.locality}'` : null})`;
                                                                                    connection.query(sql_query_addAddressRelation, (err) => {
                                                                                        if (err) {
                                                                                            console.error("Error inserting Customer Bill Wise Data:", err);
                                                                                            connection.rollback(() => {
                                                                                                connection.release();
                                                                                                return res.status(500).send('Database Error');
                                                                                            });
                                                                                        } else {
                                                                                            connection.commit((err) => {
                                                                                                if (err) {
                                                                                                    console.error("Error committing transaction:", err);
                                                                                                    connection.rollback(() => {
                                                                                                        connection.release();
                                                                                                        return res.status(500).send('Database Error');
                                                                                                    });
                                                                                                } else {
                                                                                                    connection.release();
                                                                                                    req?.io?.emit('getTokenList', tokenList);
                                                                                                    return res.status(200).send(sendJson);
                                                                                                }
                                                                                            });
                                                                                        }
                                                                                    });
                                                                                } else if (customerData && customerData.customerId && customerData.address?.trim()) {
                                                                                    let sql_queries_chkOldAdd = `SELECT addressId, customerId FROM billing_customerAddress_data WHERE customerAddress = TRIM('${customerData.address}') AND customerLocality = '${customerData.locality}'`;
                                                                                    connection.query(sql_queries_chkOldAdd, (err, oldAdd) => {
                                                                                        if (err) {
                                                                                            console.error("Error inserting Customer New Address:", err);
                                                                                            connection.rollback(() => {
                                                                                                connection.release();
                                                                                                return res.status(500).send('Database Error');
                                                                                            });
                                                                                        } else {
                                                                                            if (oldAdd && oldAdd[0]) {
                                                                                                const existAddressId = oldAdd[0].addressId;
                                                                                                let sql_query_addAddressRelation = `DELETE FROM billing_billWiseCustomer_data WHERE billId = '${billData.billId}';
                                                                                                                                    INSERT INTO billing_billWiseCustomer_data(bwcId, billId, customerId, addressId, mobileNo, customerName, address, locality)
                                                                                                                                    VALUES ('${bwcId}', '${billData.billId}', '${customerData.customerId}', '${existAddressId}', ${customerData.mobileNo ? `TRIM('${customerData.mobileNo}')` : null}, ${customerData.customerName ? `TRIM('${customerData.customerName}')` : null}, ${customerData.address ? `'${customerData.address}'` : null}, ${customerData.locality ? `'${customerData.locality}'` : null})`;
                                                                                                connection.query(sql_query_addAddressRelation, (err) => {
                                                                                                    if (err) {
                                                                                                        console.error("Error inserting Customer Bill Wise Data:", err);
                                                                                                        connection.rollback(() => {
                                                                                                            connection.release();
                                                                                                            return res.status(500).send('Database Error');
                                                                                                        });
                                                                                                    } else {
                                                                                                        connection.commit((err) => {
                                                                                                            if (err) {
                                                                                                                console.error("Error committing transaction:", err);
                                                                                                                connection.rollback(() => {
                                                                                                                    connection.release();
                                                                                                                    return res.status(500).send('Database Error');
                                                                                                                });
                                                                                                            } else {
                                                                                                                connection.release();
                                                                                                                req?.io?.emit('getTokenList', tokenList);
                                                                                                                return res.status(200).send(sendJson);
                                                                                                            }
                                                                                                        });
                                                                                                    }
                                                                                                });
                                                                                            } else {
                                                                                                let sql_querry_addNewAddress = `INSERT INTO billing_customerAddress_data(addressId, customerId, customerAddress, customerLocality)
                                                                                                                                VALUES ('${newAddressId}', '${customerData.customerId}', TRIM('${customerData.address}'), ${customerData.locality ? `TRIM('${customerData.locality}')` : null})`;
                                                                                                connection.query(sql_querry_addNewAddress, (err) => {
                                                                                                    if (err) {
                                                                                                        console.error("Error inserting Customer New Address:", err);
                                                                                                        connection.rollback(() => {
                                                                                                            connection.release();
                                                                                                            return res.status(500).send('Database Error');
                                                                                                        });
                                                                                                    } else {
                                                                                                        let sql_query_addAddressRelation = `DELETE FROM billing_billWiseCustomer_data WHERE billId = '${billData.billId}';
                                                                                                                                            INSERT INTO billing_billWiseCustomer_data(bwcId, billId, customerId, addressId, mobileNo, customerName, address, locality)
                                                                                                                                            VALUES ('${bwcId}', '${billData.billId}', '${customerData.customerId}', '${newAddressId}', ${customerData.mobileNo ? `TRIM('${customerData.mobileNo}')` : null}, ${customerData.customerName ? `TRIM('${customerData.customerName}')` : null}, ${customerData.address ? `'${customerData.address}'` : null}, ${customerData.locality ? `'${customerData.locality}'` : null})`;
                                                                                                        connection.query(sql_query_addAddressRelation, (err) => {
                                                                                                            if (err) {
                                                                                                                console.error("Error inserting Customer Bill Wise Data:", err);
                                                                                                                connection.rollback(() => {
                                                                                                                    connection.release();
                                                                                                                    return res.status(500).send('Database Error');
                                                                                                                });
                                                                                                            } else {
                                                                                                                connection.commit((err) => {
                                                                                                                    if (err) {
                                                                                                                        console.error("Error committing transaction:", err);
                                                                                                                        connection.rollback(() => {
                                                                                                                            connection.release();
                                                                                                                            return res.status(500).send('Database Error');
                                                                                                                        });
                                                                                                                    } else {
                                                                                                                        connection.release();
                                                                                                                        req?.io?.emit('getTokenList', tokenList);
                                                                                                                        return res.status(200).send(sendJson);
                                                                                                                    }
                                                                                                                });
                                                                                                            }
                                                                                                        });
                                                                                                    }
                                                                                                })
                                                                                            }
                                                                                        }
                                                                                    });
                                                                                } else if (customerData && customerData.customerId) {
                                                                                    let sql_query_addAddressRelation = `DELETE FROM billing_billWiseCustomer_data WHERE billId = '${billData.billId}';
                                                                                                                        INSERT INTO billing_billWiseCustomer_data(bwcId, billId, customerId, addressId, mobileNo, customerName, address, locality)
                                                                                                                        VALUES ('${bwcId}', '${billData.billId}', '${customerData.customerId}', ${customerData.addressId ? `'${customerData.addressId}'` : null}, ${customerData.mobileNo ? `TRIM('${customerData.mobileNo}')` : null}, ${customerData.customerName ? `TRIM('${customerData.customerName}')` : null}, ${customerData.address ? `'${customerData.address}'` : null}, ${customerData.locality ? `'${customerData.locality}'` : null})`;
                                                                                    connection.query(sql_query_addAddressRelation, (err) => {
                                                                                        if (err) {
                                                                                            console.error("Error inserting Customer Bill Wise Data:", err);
                                                                                            connection.rollback(() => {
                                                                                                connection.release();
                                                                                                return res.status(500).send('Database Error');
                                                                                            });
                                                                                        } else {
                                                                                            connection.commit((err) => {
                                                                                                if (err) {
                                                                                                    console.error("Error committing transaction:", err);
                                                                                                    connection.rollback(() => {
                                                                                                        connection.release();
                                                                                                        return res.status(500).send('Database Error');
                                                                                                    });
                                                                                                } else {
                                                                                                    connection.release();
                                                                                                    req?.io?.emit('getTokenList', tokenList);
                                                                                                    return res.status(200).send(sendJson);
                                                                                                }
                                                                                            });
                                                                                        }
                                                                                    });
                                                                                } else {
                                                                                    if (customerData && (customerData.customerName || customerData.mobileNo)) {
                                                                                        let sql_querry_getExistCustomer = `SELECT customerId, customerMobileNumber FROM billing_customer_data WHERE customerMobileNumber = '${customerData.mobileNo}'`;
                                                                                        connection.query(sql_querry_getExistCustomer, (err, num) => {
                                                                                            if (err) {
                                                                                                console.error("Error Get Existing Customer Data:", err);
                                                                                                connection.rollback(() => {
                                                                                                    connection.release();
                                                                                                    return res.status(500).send('Database Error');
                                                                                                });
                                                                                            } else {
                                                                                                const existCustomerId = num && num[0] ? num[0].customerId : null;
                                                                                                if (existCustomerId && customerData.address) {
                                                                                                    let sql_queries_chkOldAdd = `SELECT addressId, customerId FROM billing_customerAddress_data WHERE customerAddress = TRIM('${customerData.address}') AND customerLocality = '${customerData.locality}'`;
                                                                                                    connection.query(sql_queries_chkOldAdd, (err, oldAdd) => {
                                                                                                        if (err) {
                                                                                                            console.error("Error inserting Customer New Address:", err);
                                                                                                            connection.rollback(() => {
                                                                                                                connection.release();
                                                                                                                return res.status(500).send('Database Error');
                                                                                                            });
                                                                                                        } else {
                                                                                                            if (oldAdd && oldAdd[0]) {
                                                                                                                const existAddressId = oldAdd[0].addressId;
                                                                                                                let sql_query_addAddressRelation = `DELETE FROM billing_billWiseCustomer_data WHERE billId = '${billData.billId}';
                                                                                                                                                    INSERT INTO billing_billWiseCustomer_data(bwcId, billId, customerId, addressId, mobileNo, customerName, address, locality)
                                                                                                                                                    VALUES ('${bwcId}', '${billData.billId}', '${existCustomerId}', '${existAddressId}', ${customerData.mobileNo ? `TRIM('${customerData.mobileNo}')` : null}, ${customerData.customerName ? `TRIM('${customerData.customerName}')` : null}, ${customerData.address ? `'${customerData.address}'` : null}, ${customerData.locality ? `'${customerData.locality}'` : null})`;
                                                                                                                connection.query(sql_query_addAddressRelation, (err) => {
                                                                                                                    if (err) {
                                                                                                                        console.error("Error inserting Customer Bill Wise Data:", err);
                                                                                                                        connection.rollback(() => {
                                                                                                                            connection.release();
                                                                                                                            return res.status(500).send('Database Error');
                                                                                                                        });
                                                                                                                    } else {
                                                                                                                        connection.commit((err) => {
                                                                                                                            if (err) {
                                                                                                                                console.error("Error committing transaction:", err);
                                                                                                                                connection.rollback(() => {
                                                                                                                                    connection.release();
                                                                                                                                    return res.status(500).send('Database Error');
                                                                                                                                });
                                                                                                                            } else {
                                                                                                                                connection.release();
                                                                                                                                req?.io?.emit('getTokenList', tokenList);
                                                                                                                                return res.status(200).send(sendJson);
                                                                                                                            }
                                                                                                                        });
                                                                                                                    }
                                                                                                                });
                                                                                                            } else {
                                                                                                                let sql_querry_addNewAddress = `INSERT INTO billing_customerAddress_data(addressId, customerId, customerAddress, customerLocality)
                                                                                                                                                VALUES ('${newAddressId}', '${existCustomerId}', TRIM('${customerData.address}'), ${customerData.locality ? `TRIM('${customerData.locality}')` : null})`;
                                                                                                                connection.query(sql_querry_addNewAddress, (err) => {
                                                                                                                    if (err) {
                                                                                                                        console.error("Error inserting Customer New Address:", err);
                                                                                                                        connection.rollback(() => {
                                                                                                                            connection.release();
                                                                                                                            return res.status(500).send('Database Error');
                                                                                                                        });
                                                                                                                    } else {
                                                                                                                        let sql_query_addAddressRelation = `DELETE FROM billing_billWiseCustomer_data WHERE billId = '${billData.billId}';
                                                                                                                                                            INSERT INTO billing_billWiseCustomer_data(bwcId, billId, customerId, addressId, mobileNo, customerName, address, locality)
                                                                                                                                                            VALUES ('${bwcId}', '${billData.billId}', '${existCustomerId}', '${newAddressId}', ${customerData.mobileNo ? `TRIM('${customerData.mobileNo}')` : null}, ${customerData.customerName ? `TRIM('${customerData.customerName}')` : null}, ${customerData.address ? `'${customerData.address}'` : null}, ${customerData.locality ? `'${customerData.locality}'` : null})`;
                                                                                                                        connection.query(sql_query_addAddressRelation, (err) => {
                                                                                                                            if (err) {
                                                                                                                                console.error("Error inserting Customer Bill Wise Data:", err);
                                                                                                                                connection.rollback(() => {
                                                                                                                                    connection.release();
                                                                                                                                    return res.status(500).send('Database Error');
                                                                                                                                });
                                                                                                                            } else {
                                                                                                                                connection.commit((err) => {
                                                                                                                                    if (err) {
                                                                                                                                        console.error("Error committing transaction:", err);
                                                                                                                                        connection.rollback(() => {
                                                                                                                                            connection.release();
                                                                                                                                            return res.status(500).send('Database Error');
                                                                                                                                        });
                                                                                                                                    } else {
                                                                                                                                        connection.release();
                                                                                                                                        req?.io?.emit('getTokenList', tokenList);
                                                                                                                                        return res.status(200).send(sendJson);
                                                                                                                                    }
                                                                                                                                });
                                                                                                                            }
                                                                                                                        });
                                                                                                                    }
                                                                                                                })
                                                                                                            }
                                                                                                        }
                                                                                                    })
                                                                                                } else if (customerData.address?.trim()) {
                                                                                                    let sql_querry_addNewCustomer = `INSERT INTO billing_customer_data(customerId, branchId, customerName, customerMobileNumber, birthDate, anniversaryDate)
                                                                                                                                     VALUES ('${newCustomerId}', '${branchId}', ${customerData.customerName ? `TRIM('${customerData.customerName}')` : null}, ${customerData.mobileNo ? `'${customerData.mobileNo}'` : null}, ${customerData.birthDate ? `STR_TO_DATE('${customerData.birthDate}','%b %d %Y')` : null}, ${customerData.aniversaryDate ? `STR_TO_DATE('${customerData.aniversaryDate}','%b %d %Y')` : null})`;
                                                                                                    connection.query(sql_querry_addNewCustomer, (err) => {
                                                                                                        if (err) {
                                                                                                            console.error("Error inserting New Customer Data:", err);
                                                                                                            connection.rollback(() => {
                                                                                                                connection.release();
                                                                                                                return res.status(500).send('Database Error');
                                                                                                            });
                                                                                                        } else {
                                                                                                            let sql_querry_addNewAddress = `INSERT INTO billing_customerAddress_data(addressId, customerId, customerAddress, customerLocality)
                                                                                                                                            VALUES ('${newAddressId}', '${newCustomerId}', TRIM('${customerData.address}'), ${customerData.locality ? `TRIM('${customerData.locality}')` : null})`;
                                                                                                            connection.query(sql_querry_addNewAddress, (err) => {
                                                                                                                if (err) {
                                                                                                                    console.error("Error inserting Customer New Address:", err);
                                                                                                                    connection.rollback(() => {
                                                                                                                        connection.release();
                                                                                                                        return res.status(500).send('Database Error');
                                                                                                                    });
                                                                                                                } else {
                                                                                                                    let sql_query_addAddressRelation = `DELETE FROM billing_billWiseCustomer_data WHERE billId = '${billData.billId}';
                                                                                                                                                        INSERT INTO billing_billWiseCustomer_data(bwcId, billId, customerId, addressId, mobileNo, customerName, address, locality)
                                                                                                                                                        VALUES ('${bwcId}', '${billData.billId}', '${newCustomerId}', '${newAddressId}', ${customerData.mobileNo ? `TRIM('${customerData.mobileNo}')` : null}, ${customerData.customerName ? `TRIM('${customerData.customerName}')` : null}, ${customerData.address ? `'${customerData.address}'` : null}, ${customerData.locality ? `'${customerData.locality}'` : null})`;
                                                                                                                    connection.query(sql_query_addAddressRelation, (err) => {
                                                                                                                        if (err) {
                                                                                                                            console.error("Error inserting Customer Bill Wise Data:", err);
                                                                                                                            connection.rollback(() => {
                                                                                                                                connection.release();
                                                                                                                                return res.status(500).send('Database Error');
                                                                                                                            });
                                                                                                                        } else {
                                                                                                                            connection.commit((err) => {
                                                                                                                                if (err) {
                                                                                                                                    console.error("Error committing transaction:", err);
                                                                                                                                    connection.rollback(() => {
                                                                                                                                        connection.release();
                                                                                                                                        return res.status(500).send('Database Error');
                                                                                                                                    });
                                                                                                                                } else {
                                                                                                                                    connection.release();
                                                                                                                                    req?.io?.emit('getTokenList', tokenList);
                                                                                                                                    return res.status(200).send(sendJson);
                                                                                                                                }
                                                                                                                            });
                                                                                                                        }
                                                                                                                    });
                                                                                                                }
                                                                                                            })
                                                                                                        }
                                                                                                    })
                                                                                                } else if (existCustomerId) {
                                                                                                    let sql_query_addAddressRelation = `DELETE FROM billing_billWiseCustomer_data WHERE billId = '${billData.billId}';
                                                                                                                                        INSERT INTO billing_billWiseCustomer_data(bwcId, billId, customerId, addressId, mobileNo, customerName, address, locality)
                                                                                                                                        VALUES ('${bwcId}', '${billData.billId}', '${existCustomerId}', NULL, ${customerData.mobileNo ? `TRIM('${customerData.mobileNo}')` : null}, ${customerData.customerName ? `TRIM('${customerData.customerName}')` : null}, ${customerData.address ? `'${customerData.address}'` : null}, ${customerData.locality ? `'${customerData.locality}'` : null})`;
                                                                                                    connection.query(sql_query_addAddressRelation, (err) => {
                                                                                                        if (err) {
                                                                                                            console.error("Error inserting Customer Bill Wise Data:", err);
                                                                                                            connection.rollback(() => {
                                                                                                                connection.release();
                                                                                                                return res.status(500).send('Database Error');
                                                                                                            });
                                                                                                        } else {
                                                                                                            connection.commit((err) => {
                                                                                                                if (err) {
                                                                                                                    console.error("Error committing transaction:", err);
                                                                                                                    connection.rollback(() => {
                                                                                                                        connection.release();
                                                                                                                        return res.status(500).send('Database Error');
                                                                                                                    });
                                                                                                                } else {
                                                                                                                    connection.release();
                                                                                                                    req?.io?.emit('getTokenList', tokenList);
                                                                                                                    return res.status(200).send(sendJson);
                                                                                                                }
                                                                                                            });
                                                                                                        }
                                                                                                    });
                                                                                                } else if (customerData.mobileNo) {
                                                                                                    let sql_querry_addNewCustomer = `INSERT INTO billing_customer_data(customerId, branchId, customerName, customerMobileNumber, birthDate, anniversaryDate)
                                                                                                                                     VALUES ('${newCustomerId}', '${branchId}', ${customerData.customerName ? `TRIM('${customerData.customerName}')` : null}, ${customerData.mobileNo ? `'${customerData.mobileNo}'` : null}, ${customerData.birthDate ? `STR_TO_DATE('${customerData.birthDate}','%b %d %Y')` : null}, ${customerData.aniversaryDate ? `STR_TO_DATE('${customerData.aniversaryDate}','%b %d %Y')` : null})`;
                                                                                                    connection.query(sql_querry_addNewCustomer, (err) => {
                                                                                                        if (err) {
                                                                                                            console.error("Error inserting New Customer Data:", err);
                                                                                                            connection.rollback(() => {
                                                                                                                connection.release();
                                                                                                                return res.status(500).send('Database Error');
                                                                                                            });
                                                                                                        } else {
                                                                                                            let sql_query_addAddressRelation = `DELETE FROM billing_billWiseCustomer_data WHERE billId = '${billData.billId}';
                                                                                                                                                INSERT INTO billing_billWiseCustomer_data(bwcId, billId, customerId, addressId, mobileNo, customerName, address, locality)
                                                                                                                                                VALUES ('${bwcId}', '${billData.billId}', '${newCustomerId}', NULL, ${customerData.mobileNo ? `TRIM('${customerData.mobileNo}')` : null}, ${customerData.customerName ? `TRIM('${customerData.customerName}')` : null}, ${customerData.address ? `'${customerData.address}'` : null}, ${customerData.locality ? `'${customerData.locality}'` : null})`;
                                                                                                            connection.query(sql_query_addAddressRelation, (err) => {
                                                                                                                if (err) {
                                                                                                                    console.error("Error inserting Customer Bill Wise Data:", err);
                                                                                                                    connection.rollback(() => {
                                                                                                                        connection.release();
                                                                                                                        return res.status(500).send('Database Error');
                                                                                                                    });
                                                                                                                } else {
                                                                                                                    connection.commit((err) => {
                                                                                                                        if (err) {
                                                                                                                            console.error("Error committing transaction:", err);
                                                                                                                            connection.rollback(() => {
                                                                                                                                connection.release();
                                                                                                                                return res.status(500).send('Database Error');
                                                                                                                            });
                                                                                                                        } else {
                                                                                                                            connection.release();
                                                                                                                            req?.io?.emit('getTokenList', tokenList);
                                                                                                                            return res.status(200).send(sendJson);
                                                                                                                        }
                                                                                                                    });
                                                                                                                }
                                                                                                            });
                                                                                                        }
                                                                                                    })
                                                                                                } else {
                                                                                                    let sql_query_addAddressRelation = `DELETE FROM billing_billWiseCustomer_data WHERE billId = '${billData.billId}';
                                                                                                                                        INSERT INTO billing_billWiseCustomer_data(bwcId, billId, customerId, addressId, mobileNo, customerName, address, locality)
                                                                                                                                        VALUES ('${bwcId}', '${billData.billId}', NULL, NULL, ${customerData.mobileNo ? `TRIM('${customerData.mobileNo}')` : null}, ${customerData.customerName ? `TRIM('${customerData.customerName}')` : null}, ${customerData.address ? `'${customerData.address}'` : null}, ${customerData.locality ? `'${customerData.locality}'` : null})`;
                                                                                                    connection.query(sql_query_addAddressRelation, (err) => {
                                                                                                        if (err) {
                                                                                                            console.error("Error inserting Customer Bill Wise Data:", err);
                                                                                                            connection.rollback(() => {
                                                                                                                connection.release();
                                                                                                                return res.status(500).send('Database Error');
                                                                                                            });
                                                                                                        } else {
                                                                                                            connection.commit((err) => {
                                                                                                                if (err) {
                                                                                                                    console.error("Error committing transaction:", err);
                                                                                                                    connection.rollback(() => {
                                                                                                                        connection.release();
                                                                                                                        return res.status(500).send('Database Error');
                                                                                                                    });
                                                                                                                } else {
                                                                                                                    connection.release();
                                                                                                                    req?.io?.emit('getTokenList', tokenList);
                                                                                                                    return res.status(200).send(sendJson);
                                                                                                                }
                                                                                                            });
                                                                                                        }
                                                                                                    });
                                                                                                }
                                                                                            }
                                                                                        })
                                                                                    } else if (customerData.address?.trim() || customerData.locality?.trim()) {
                                                                                        let sql_query_addAddressRelation = `DELETE FROM billing_billWiseCustomer_data WHERE billId = '${billData.billId}';
                                                                                                                            INSERT INTO billing_billWiseCustomer_data(bwcId, billId, customerId, addressId, mobileNo, customerName, address, locality)
                                                                                                                            VALUES ('${bwcId}', '${billData.billId}', NULL, NULL, ${customerData.mobileNo ? `TRIM('${customerData.mobileNo}')` : null}, ${customerData.customerName ? `TRIM('${customerData.customerName}')` : null}, ${customerData.address ? `'${customerData.address}'` : null}, ${customerData.locality ? `'${customerData.locality}'` : null})`;
                                                                                        connection.query(sql_query_addAddressRelation, (err) => {
                                                                                            if (err) {
                                                                                                console.error("Error inserting Customer Bill Wise Data:", err);
                                                                                                connection.rollback(() => {
                                                                                                    connection.release();
                                                                                                    return res.status(500).send('Database Error');
                                                                                                });
                                                                                            } else {
                                                                                                connection.commit((err) => {
                                                                                                    if (err) {
                                                                                                        console.error("Error committing transaction:", err);
                                                                                                        connection.rollback(() => {
                                                                                                            connection.release();
                                                                                                            return res.status(500).send('Database Error');
                                                                                                        });
                                                                                                    } else {
                                                                                                        connection.release();
                                                                                                        req?.io?.emit('getTokenList', tokenList);
                                                                                                        return res.status(200).send(sendJson);
                                                                                                    }
                                                                                                });
                                                                                            }
                                                                                        });
                                                                                    } else {
                                                                                        connection.commit((err) => {
                                                                                            if (err) {
                                                                                                console.error("Error committing transaction:", err);
                                                                                                connection.rollback(() => {
                                                                                                    connection.release();
                                                                                                    return res.status(500).send('Database Error');
                                                                                                });
                                                                                            } else {
                                                                                                connection.release();
                                                                                                req?.io?.emit('getTokenList', tokenList);
                                                                                                return res.status(200).send(sendJson);
                                                                                            }
                                                                                        });
                                                                                    }
                                                                                }
                                                                            }
                                                                        });
                                                                    }
                                                                });
                                                            }
                                                        });
                                                    }
                                                });
                                            } else {
                                                connection.rollback(() => {
                                                    connection.release();
                                                    return res.status(404).send('billId Not Found...!');
                                                })
                                            }
                                        }
                                    })
                                }
                            })
                        }
                    } else {
                        connection.rollback(() => {
                            connection.release();
                            return res.status(404).send('Please Login First....!');
                        });
                    }
                }
            });
        } catch (error) {
            console.error('An error occurred', error);
            connection.rollback(() => {
                connection.release();
                return res.status(500).json('Internal Server Error');
            })
        }
    });
}

// Update Bill Status In Live View

const updateBillStatusById = (req, res) => {
    try {
        const billId = req.query.billId;
        const billStatus = req.query.billStatus;
        if (!billId || !billStatus) {
            return res.status(404).send('Bill Id Not Found !')
        } else {
            let sql_query_updateBillStatus = `UPDATE billing_data SET billStatus = '${billStatus}' WHERE billId = '${billId}';
                                              UPDATE billing_Official_data SET billStatus = '${billStatus}' WHERE billId = '${billId}';
                                              UPDATE billing_Complimentary_data SET billStatus = '${billStatus}' WHERE billId = '${billId}'`;
            pool.query(sql_query_updateBillStatus, (err, data) => {
                if (err) {
                    console.error("An error occurred in SQL Queery", err);
                    return res.status(500).send('Database Error');
                } else {
                    return res.status(200).send('Status Updated Succesfully');
                }
            })
        }
    } catch (error) {
        console.error('An error occurred', error);
        res.status(500).json('Internal Server Error');
    }
}

// Print Old Bills

const printBillInAdminSystem = (req, res) => {
    try {
        const billId = req.query.billId;
        if (!billId) {
            return res.status(404).send('billId Not Found');
        } else {
            let sql_query_chkBillExist = `SELECT billId, billType FROM billing_data WHERE billId = '${billId}'`;
            pool.query(sql_query_chkBillExist, (err, bill) => {
                if (err) {
                    console.error("An error occurred in SQL Queery", err);
                    return res.status(500).send('Database Error');
                } else {
                    if (bill && bill.length) {
                        const billType = bill[0].billType;
                        let sql_query_getBillingData = `SELECT 
                                                            bd.billId AS billId, 
                                                            bd.billNumber AS billNumber,
                                                            COALESCE(bod.billNumber, CONCAT('C', bcd.billNumber), 'Not Available') AS officialBillNo,
                                                            CASE
                                                                WHEN bd.billType = 'Hotel' THEN CONCAT('H',btd.tokenNo)
                                                                WHEN bd.billType = 'Pick Up' THEN CONCAT('P',btd.tokenNo)
                                                                WHEN bd.billType = 'Delivery' THEN CONCAT('D',btd.tokenNo)
                                                                WHEN bd.billType = 'Dine In' THEN CONCAT('R',btd.tokenNo)
                                                                ELSE NULL
                                                            END AS tokenNo,
                                                            CASE
                                                                WHEN bd.billPayType = 'online' THEN bwu.onlineId
                                                                ELSE NULL
                                                            END AS otherId,
                                                            bd.firmId AS firmId, 
                                                            bd.cashier AS cashier, 
                                                            bd.menuStatus AS menuStatus, 
                                                            bd.billType AS billType, 
                                                            bd.billPayType AS billPayType, 
                                                            bd.discountType AS discountType, 
                                                            bd.discountValue AS discountValue, 
                                                            bd.totalDiscount AS totalDiscount, 
                                                            bd.totalAmount AS subTotal, 
                                                            bd.settledAmount AS settledAmount, 
                                                            bd.billComment AS billComment, 
                                                            DATE_FORMAT(bd.billDate,'%d/%m/%Y') AS billDate,
                                                            bd.billStatus AS billStatus,
                                                            DATE_FORMAT(bd.billCreationDate,'%h:%i %p') AS billTime
                                                        FROM 
                                                            billing_data AS bd
                                                        LEFT JOIN billing_Official_data AS bod ON bod.billId = bd.billId
                                                        LEFT JOIN billing_Complimentary_data AS bcd ON bcd.billId = bd.billId
                                                        LEFT JOIN billing_token_data AS btd ON btd.billId = bd.billId
                                                        LEFT JOIN billing_firm_data AS bfd ON bfd.firmId = bd.firmId
                                                        LEFT JOIN billing_billWiseUpi_data AS bwu ON bwu.billId = bd.billId
                                                        WHERE bd.billId = '${billId}'`;
                        let sql_query_getBillwiseItem = `SELECT
                                                             bwid.iwbId AS iwbId,
                                                             bwid.itemId AS itemId,
                                                             imd.itemName AS itemName,
                                                             imd.itemCode AS inputCode,
                                                             bwid.qty AS qty,
                                                             bwid.unit AS unit,
                                                             bwid.itemPrice AS itemPrice,
                                                             bwid.price AS price,
                                                             bwid.comment AS comment
                                                         FROM
                                                             billing_billWiseItem_data AS bwid
                                                         INNER JOIN item_menuList_data AS imd ON imd.itemId = bwid.itemId
                                                         WHERE bwid.billId = '${billId}'`;
                        let sql_query_getCustomerInfo = `SELECT
                                                             bwcd.bwcId AS bwcId,
                                                             bwcd.customerId AS customerId,
                                                             bwcd.mobileNo AS mobileNo,
                                                             bwcd.addressId AS addressId,
                                                             bwcd.address AS address,
                                                             bwcd.locality AS locality,
                                                             bwcd.customerName AS customerName
                                                         FROM
                                                             billing_billWiseCustomer_data AS bwcd
                                                         WHERE bwcd.billId = '${billId}'`;
                        let sql_query_getHotelInfo = `SELECT
                                                          bhid.hotelInfoId AS hotelInfoId,
                                                          bhid.hotelId AS hotelId,
                                                          bhd.hotelName AS hotelName,
                                                          bhd.hotelAddress AS hotelAddress,
                                                          bhd.hotelLocality AS hotelLocality,
                                                          bhd.hotelMobileNo AS hotelMobileNo,
                                                          bhid.roomNo AS roomNo,
                                                          bhid.customerName AS customerName,
                                                          bhid.phoneNumber AS mobileNo
                                                      FROM
                                                          billing_hotelInfo_data AS bhid
                                                      LEFT JOIN billing_hotel_data AS bhd ON bhd.hotelId = bhid.hotelId
                                                      WHERE bhid.billId = '${billId}'`
                        let sql_query_getFirmData = `SELECT 
                                                        firmId, 
                                                        firmName, 
                                                        gstNumber, 
                                                        firmAddress, 
                                                        pincode, 
                                                        firmMobileNo, 
                                                        otherMobileNo 
                                                     FROM 
                                                        billing_firm_data 
                                                     WHERE 
                                                        firmId = (SELECT firmId FROM billing_data WHERE billId = '${billId}')`
                        const sql_query_getBillData = `${sql_query_getBillingData};
                                                       ${sql_query_getBillwiseItem};
                                                       ${sql_query_getFirmData};
                                                       ${billType == 'Hotel' ? sql_query_getHotelInfo + ';' : ''}
                                                       ${billType == 'Pick Up' || billType == 'Delivery' ? sql_query_getCustomerInfo : ''}`;
                        pool.query(sql_query_getBillData, (err, billData) => {
                            if (err) {
                                console.error("An error occurred in SQL Queery", err);
                                return res.status(500).send('Database Error'); t
                            } else {
                                const json = {
                                    ...billData[0][0],
                                    itemsData: billData && billData[1] ? billData[1] : [],
                                    firmData: billData && billData[2] ? billData[2][0] : [],
                                    ...(billType === 'Hotel' ? { hotelDetails: billData[3][0] } : ''),
                                    ...(billType == 'Pick Up' || billType == 'Delivery' ? { customerDetails: billData && billData[3][0] ? billData[3][0] : '' } : '')
                                }
                                req?.io?.emit('print_Bill_86ee97442104adc27e74ce61fa4b57f158995292e9ab484bd618a75394ecc535', json);
                                return res.status(200).send(json);
                            }
                        })
                    } else {
                        return res.status(404).send('Bill Id Not Found');
                    }
                }
            })
        }
    } catch (error) {
        console.error('An error occurred', error);
        res.status(500).json('Internal Server Error');
    }
}


module.exports = {
    // Get Bill Data
    getBillingStaticsData,
    getBillDataById,
    getRecentBillData,
    getBillDataByToken,
    getLiveViewByCategoryId,

    // Add Bill Data
    addPickUpBillData,
    addDeliveryBillData,

    // Update Bill Data
    updatePickUpBillData,
    updateDeliveryBillData,
    updateBillStatusById,

    // Print Bill Data
    printBillInAdminSystem
}