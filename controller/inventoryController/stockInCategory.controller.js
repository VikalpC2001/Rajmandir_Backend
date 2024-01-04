const pool = require('../../database');
const { jsPDF } = require('jspdf');
require('jspdf-autotable');

// Get Category List

const getStockInCategoryList = async (req, res) => {
    try {
        const page = req.query.page;
        const numPerPage = req.query.numPerPage;
        const skip = (page - 1) * numPerPage;
        const limit = skip + ',' + numPerPage;
        const startDate = (req.query.startDate ? req.query.startDate : '').slice(4, 15);
        const endDate = (req.query.endDate ? req.query.endDate : '').slice(4, 15);
        sql_querry_getdetails = `SELECT count(*) as numRows FROM inventory_stockInCategory_data`;
        pool.query(sql_querry_getdetails, (err, rows, fields) => {
            if (err) {
                console.error("An error occurd in SQL Queery", err);
                return res.status(500).send('Database Error');
            } else {
                const numRows = rows[0].numRows;
                const numPages = Math.ceil(numRows / numPerPage);
                if (req.query.startDate && req.query.endDate) {
                    sql_queries_getCategoryTable = `SELECT
                                                        iscd.stockInCategoryId,
                                                        iscd.stockInCategoryName
                                                    FROM
                                                        inventory_stockInCategory_data AS iscd
                                                    LIMIT ${limit}`;
                } else {
                    sql_queries_getCategoryTable = `SELECT
                                                        iscd.stockInCategoryId,
                                                        iscd.stockInCategoryName
                                                    FROM
                                                        inventory_stockInCategory_data AS iscd
                                                    LIMIT ${limit}`;
                }
                pool.query(sql_queries_getCategoryTable, (err, rows, fields) => {
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
                            return res.status(200).send({ rows, numRows, totalCategorystockInPrice: rows[0].totalCategorystockInPrice });
                        }
                    }
                });
            }
        })


    } catch (error) {
        console.error('An error occurd', error);
        res.status(500).json('Internal Server Error');
    }
}

// Add stockIn Category API

const addstockInCategory = async (req, res) => {
    try {

        const uid1 = new Date();
        const stockInCategoryId = String("stockInCategory_" + uid1.getTime());
        console.log("...", stockInCategoryId);

        const data = {
            stockInCategoryName: req.body.stockInCategoryName.trim(),
        }
        if (!data.stockInCategoryName) {
            return res.status(400).send("Please Add Category");
        } else {
            req.body.productName = pool.query(`SELECT stockInCategoryName FROM inventory_stockInCategory_data WHERE stockInCategoryName = '${data.stockInCategoryName}'`, function (err, row) {
                if (err) {
                    console.error("An error occurd in SQL Queery", err);
                    return res.status(500).send('Database Error');
                }
                if (row && row.length) {
                    return res.status(400).send('Category is Already In Use');
                } else {
                    const sql_querry_addCategory = `INSERT INTO inventory_stockInCategory_data (stockInCategoryId, stockInCategoryName)  
                                                    VALUES ('${stockInCategoryId}','${data.stockInCategoryName}')`;
                    pool.query(sql_querry_addCategory, (err, data) => {
                        if (err) {
                            console.error("An error occurd in SQL Queery", err);
                            return res.status(500).send('Database Error');
                        }
                        return res.status(200).send("Category Added Successfully");
                    })
                }
            })
        }
    } catch (error) {
        console.error('An error occurd', error);
        res.status(500).send('Internal Server Error');
    }
}

// Remove stockInCategory API

const removestockInCategory = async (req, res) => {

    try {
        const stockInCategoryId = req.query.stockInCategoryId.trim();
        req.query.stockInCategoryId = pool.query(`SELECT stockInCategoryId FROM inventory_stockInCategory_data WHERE stockInCategoryId = '${stockInCategoryId}'`, (err, row) => {
            if (err) {
                console.error("An error occurd in SQL Queery", err);
                return res.status(500).send('Database Error');
            }
            if (row && row.length) {
                const sql_querry_removedetails = `DELETE FROM inventory_stockInCategory_data WHERE stockInCategoryId = '${stockInCategoryId}'`;
                pool.query(sql_querry_removedetails, (err, data) => {
                    if (err) {
                        console.error("An error occurd in SQL Queery", err);
                        return res.status(500).send('Database Error');
                    }
                    return res.status(200).send("Category Deleted Successfully");
                })
            } else {
                return res.send('CategoryId Not Found');
            }
        })
    } catch (error) {
        console.error('An error occurd', error);
        res.status(500).send('Internal Server Error');
    }
}

// Update stockIn Category API

const updatestockInCategory = async (req, res) => {
    try {
        const data = {
            stockInCategoryId: req.body.stockInCategoryId.trim(),
            stockInCategoryName: req.body.stockInCategoryName.trim()
        }
        if (!data.stockInCategoryName) {
            res.status(400).send("Please Add Category");
        }
        const sql_querry_updatedetails = `UPDATE inventory_stockInCategory_data SET stockInCategoryName = '${data.stockInCategoryName}'
                                          WHERE stockInCategoryId = '${data.stockInCategoryId}'`;
        pool.query(sql_querry_updatedetails, (err, data) => {
            if (err) {
                console.error("An error occurd in SQL Queery", err);
                return res.status(500).send('Database Error');
            }
            return res.status(200).send("Category Updated Successfully");
        })
    } catch (error) {
        console.error('An error occurd', error);
        res.status(500).send('Internal Server Error');
    }
}

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

const exportPdfForInventoryCategoryData = (req, res) => {
    try {
        var date = new Date(), y = date.getFullYear(), m = (date.getMonth());
        var firstDay = new Date(y, m, 1).toString().slice(4, 15);
        var lastDay = new Date(y, m + 1, 0).toString().slice(4, 15);
        const startDate = (req.query.startDate ? req.query.startDate : '').slice(4, 15);
        const endDate = (req.query.endDate ? req.query.endDate : '').slice(4, 15);

        if (req.query.startDate && req.query.endDate) {
            sql_queries_getCategoryTable = `SELECT
                                               iscd.stockInCategoryName AS "Category Name",
                                                COALESCE(ROUND(socd.categorystockInPrice),0) AS "Out Price",
                                                CONCAT(
                                                    ROUND(COALESCE(ROUND(socd.categorystockInPrice), 0) / total.totalCategorystockInPrice * 100),
                                                    ' %'
                                                ) AS "Out Ratio(%)"
                                            FROM
                                                inventory_stockInCategory_data AS iscd
                                            LEFT JOIN (
                                                SELECT
                                                    inventory_stockIn_data.stockInCategory,
                                                    SUM(inventory_stockIn_data.stockInPrice) AS categorystockInPrice
                                                FROM
                                                    inventory_stockIn_data
                                                WHERE
                                                    inventory_stockIn_data.stockInDate BETWEEN STR_TO_DATE('${startDate}', '%b %d %Y') AND STR_TO_DATE('${endDate}', '%b %d %Y')
                                                GROUP BY
                                                    inventory_stockIn_data.stockInCategory
                                            ) AS socd ON iscd.stockInCategoryId = socd.stockInCategory
                                            LEFT JOIN (
                                                SELECT SUM(categorystockInPrice) AS totalCategorystockInPrice
                                                FROM (
                                                    SELECT
                                                        inventory_stockIn_data.stockInCategory,
                                                        SUM(inventory_stockIn_data.stockInPrice) AS categorystockInPrice
                                                    FROM
                                                        inventory_stockIn_data
                                                    WHERE
                                                        inventory_stockIn_data.stockInDate BETWEEN STR_TO_DATE('${startDate}', '%b %d %Y') AND STR_TO_DATE('${endDate}', '%b %d %Y')
                                                    GROUP BY
                                                        inventory_stockIn_data.stockInCategory
                                                ) AS temp
                                            ) AS total ON 1=1`;
        } else {
            sql_queries_getCategoryTable = `SELECT
                                                iscd.stockInCategoryName AS "Category Name",
                                                COALESCE(ROUND(socd.categorystockInPrice),0) AS "Out Price",
                                                CONCAT(
                                                    ROUND(COALESCE(ROUND(socd.categorystockInPrice), 0) / total.totalCategorystockInPrice * 100),
                                                    ' %'
                                                ) AS "Out Ratio(%)"
                                            FROM
                                                inventory_stockInCategory_data AS iscd
                                            LEFT JOIN (
                                                SELECT
                                                    inventory_stockIn_data.stockInCategory,
                                                    SUM(inventory_stockIn_data.stockInPrice) AS categorystockInPrice
                                                FROM
                                                    inventory_stockIn_data
                                                WHERE
                                                    MONTH(inventory_stockIn_data.stockInDate) = MONTH(CURDATE()) AND YEAR(inventory_stockIn_data.stockInDate) = YEAR(CURDATE())
                                                GROUP BY
                                                    inventory_stockIn_data.stockInCategory
                                            ) AS socd ON iscd.stockInCategoryId = socd.stockInCategory
                                            LEFT JOIN (
                                                SELECT SUM(categorystockInPrice) AS totalCategorystockInPrice
                                                FROM (
                                                    SELECT
                                                        inventory_stockIn_data.stockInCategory,
                                                        SUM(inventory_stockIn_data.stockInPrice) AS categorystockInPrice
                                                    FROM
                                                        inventory_stockIn_data
                                                    WHERE
                                                        MONTH(inventory_stockIn_data.stockInDate) = MONTH(CURDATE()) AND YEAR(inventory_stockIn_data.stockInDate) = YEAR(CURDATE())
                                                    GROUP BY
                                                        inventory_stockIn_data.stockInCategory
                                                ) AS temp
                                            ) AS total ON 1=1`;
        }
        pool.query(sql_queries_getCategoryTable, (err, rows) => {
            if (err) {
                console.error("An error occurd in SQL Queery", err);
                return res.status(500).send('Database Error');
            } else if (rows && rows.length <= 0) {
                return res.status(400).send('No Data Found');
            }
            const abc = Object.values(JSON.parse(JSON.stringify(rows)));
            const sumOutPrice = abc.reduce((total, item) => total + (item['Out Price'] || 0), 0);
            const sumFooterArray = ['Total', '', sumOutPrice];

            if (req.query.startDate && req.query.endDate) {
                tableHeading = `Stock Out Data From ${startDate} To ${endDate}`;
            } else {
                tableHeading = `Stock Out From ${firstDay} To ${lastDay}`;
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
    } catch (error) {
        console.error('An error occurd', error);
        res.status(500).send('Internal Server Error');
    }
}

module.exports = {
    getStockInCategoryList,
    addstockInCategory,
    removestockInCategory,
    updatestockInCategory,
    exportPdfForInventoryCategoryData
}