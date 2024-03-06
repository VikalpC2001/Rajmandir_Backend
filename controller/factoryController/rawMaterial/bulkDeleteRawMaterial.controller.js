const pool = require('../../../database');

const emptyModifiedHistoryOfStockOut = async (req, res) => {
    try {
        sql_query_trunketMso = `TRUNCATE TABLE factory_rmModified_history`;
        pool.query(sql_query_trunketMso, (err, data) => {
            if (err) {
                console.error("An error occurd in SQL Queery", err);
                return res.status(500).send('Database Error');
            }
            return res.status(200).send("Delete Success");
        })
    }
    catch (error) {
        console.error('An error occurd', error);
        res.status(500).send('Internal Server Error');
    }
}

const emptyModifiedHistoryOfStockOutById = async (req, res) => {
    try {

        const rmStockOutId = req.query.rmStockOutId
        sql_query_trunketMso = `DELETE FROM factory_rmModified_history WHERE rmStockOutId = '${rmStockOutId}'`;
        pool.query(sql_query_trunketMso, (err, data) => {
            if (err) {
                console.error("An error occurd in SQL Queery", err);
                return res.status(500).send('Database Error');
            }
            return res.status(200).send("Delete Success");
        })
    }
    catch (error) {
        console.error('An error occurd', error);
        res.status(500).send('Internal Server Error');
    }
}

module.exports = {
    emptyModifiedHistoryOfStockOut,
    emptyModifiedHistoryOfStockOutById
}

