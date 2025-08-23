const pool2 = require("../../databasePool");


function queryAsync(conn, sql, params) {
    return new Promise((resolve, reject) => {
        conn.query(sql, params, (err, results) => {
            if (err) return reject(err);
            resolve(results);
        });
    });
}

const dryRunSettleBills = (req, res) => {
    const { fromDate, toDate, settleType, settleValue } = req.body;

    if (!fromDate || !toDate || !settleType || !settleValue) {
        return res.status(400).json({ message: "Invalid input" });
    }

    pool2.getConnection(async (err, conn) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ message: "DB connection error" });
        }

        try {
            await queryAsync(conn, "START TRANSACTION");

            // 1. Fetch bills
            const bills = await queryAsync(
                conn,
                `SELECT * FROM billing_data 
         WHERE billDate BETWEEN ? AND ? 
         ORDER BY totalAmount DESC`,
                [fromDate, toDate]
            );

            if (!bills.length) {
                await queryAsync(conn, "ROLLBACK");
                conn.release();
                return res.json({ message: "No bills found in date range" });
            }

            // 2. Attach items for each bill
            for (const bill of bills) {
                const items = await queryAsync(
                    conn,
                    `SELECT * FROM billing_billWiseItem_data 
           WHERE billId = ? ORDER BY price DESC`,
                    [bill.billId]
                );
                bill.items = items;
            }

            const originalTotal = bills.reduce((sum, b) => sum + b.totalAmount, 0);
            const targetAmount =
                settleType === "percentage"
                    ? (originalTotal * settleValue) / 100
                    : settleValue;

            let currentTotal = originalTotal;
            let deletedItemsByBill = {};
            let iterations = 0;

            // 3. Simulate deletions
            while (currentTotal > targetAmount) {
                let deleted = false;

                for (const bill of bills) {
                    if (bill.items.length > 1) {
                        const item = bill.items[0]; // highest priced
                        bill.items.shift();

                        // group bill + item
                        if (!deletedItemsByBill[bill.billId]) {
                            deletedItemsByBill[bill.billId] = {
                                billDetails: { ...bill, items: undefined },
                                items: []
                            };
                        }
                        deletedItemsByBill[bill.billId].items.push(item);

                        // recalc totals
                        const newTotal = bill.items.reduce((s, it) => s + it.price, 0);
                        let discount = 0;
                        if (bill.discountType === "percentage") {
                            discount = (newTotal * bill.discountValue) / 100;
                        } else if (bill.discountType === "fixed") {
                            discount = bill.discountValue > newTotal ? 0 : bill.discountValue;
                        }

                        bill.totalAmount = newTotal;
                        bill.totalDiscount = discount;
                        bill.settledAmount = newTotal - discount;

                        currentTotal -= item.price;
                        deleted = true;
                        break; // only one item per iteration
                    }
                }

                if (!deleted) break;
                iterations++;
            }

            // 4. Build summary
            const allDeleted = Object.values(deletedItemsByBill).flatMap(b => b.items);
            let summary = {};
            if (allDeleted.length > 0) {
                const prices = allDeleted.map(d => d.price);
                summary = {
                    iterations,
                    totalDeletedItems: allDeleted.length,
                    largestDeletedItem: Math.max(...prices),
                    smallestDeletedItem: Math.min(...prices),
                    averageDeletedValue: (prices.reduce((a, b) => a + b, 0) / prices.length).toFixed(2)
                };
            } else {
                summary = { iterations, totalDeletedItems: 0 };
            }

            // ❌ Dry-run = rollback transaction
            await queryAsync(conn, "ROLLBACK");

            // 5. Respond
            res.json({
                mode: "dry-run",
                originalTotal,
                targetAmount,
                finalTotal: currentTotal,
                summary,
                deletedItemsByBill: Object.entries(deletedItemsByBill).map(([billId, data]) => ({
                    billId,
                    billDetails: data.billDetails,
                    deletedItems: data.items
                })),
                updatedBills: bills.map(b => ({
                    billId: b.billId,
                    totalAmount: b.totalAmount,
                    totalDiscount: b.totalDiscount,
                    settledAmount: b.settledAmount,
                    remainingItems: b.items.length
                }))
            });

        } catch (error) {
            console.error(error);
            await queryAsync(conn, "ROLLBACK");
            res.status(500).json({ message: "Internal server error" });
        } finally {
            conn.release();
        }
    });
};

const settleBills = (req, res) => {
    const { fromDate, toDate, settleType, settleValue } = req.body;

    if (!fromDate || !toDate || !settleType || !settleValue) {
        return res.status(400).json({ message: "Invalid input" });
    }

    pool2.getConnection(async (err, conn) => {
        if (err) {
            console.error("DB connection error:", err);
            return res.status(500).json({ message: "DB connection error" });
        }

        try {
            await queryAsync(conn, "START TRANSACTION");

            // 1. Fetch bills
            const bills = await queryAsync(
                conn,
                `SELECT * FROM billing_data 
                 WHERE billDate BETWEEN ? AND ?
                 ORDER BY totalAmount DESC`,
                [fromDate, toDate]
            );

            if (!bills.length) {
                await queryAsync(conn, "ROLLBACK");
                conn.release();
                return res.json({ message: "No bills found in date range" });
            }

            // 2. Fetch items for each bill
            for (const bill of bills) {
                const items = await queryAsync(
                    conn,
                    `SELECT * FROM billing_billWiseItem_data 
                     WHERE billId = ? 
                     ORDER BY price DESC`,
                    [bill.billId]
                );
                bill.items = items;
            }

            const originalTotal = bills.reduce((sum, b) => sum + b.totalAmount, 0);
            const targetAmount =
                settleType === "percentage"
                    ? (originalTotal * settleValue) / 100
                    : settleValue;

            let currentTotal = originalTotal;
            const deletedItemsByBill = {};
            let iterations = 0;

            // 3. Start deleting items
            while (currentTotal > targetAmount) {
                let deleted = false;

                for (const bill of bills) {
                    if (bill.items.length > 1) {
                        const item = bill.items[0]; // highest priced
                        bill.items.shift();

                        // record for response
                        if (!deletedItemsByBill[bill.billId]) {
                            deletedItemsByBill[bill.billId] = {
                                billDetails: { ...bill, items: undefined },
                                items: []
                            };
                        }
                        deletedItemsByBill[bill.billId].items.push(item);

                        // ❌ delete from DB
                        await queryAsync(
                            conn,
                            `DELETE FROM billing_billWiseItem_data WHERE iwbId = ?`,
                            [item.iwbId]
                        );

                        // recalc totals
                        const newTotal = bill.items.reduce((s, it) => s + it.price, 0);
                        let discount = 0;
                        if (bill.discountType === "percentage") {
                            discount = (newTotal * bill.discountValue) / 100;
                        } else if (bill.discountType === "fixed") {
                            discount = bill.discountValue > newTotal ? 0 : bill.discountValue;
                        }

                        bill.totalAmount = newTotal;
                        bill.totalDiscount = discount;
                        bill.settledAmount = newTotal - discount;

                        // ❌ update bill in DB
                        await queryAsync(
                            conn,
                            `UPDATE billing_data 
                             SET totalAmount = ?, totalDiscount = ?, settledAmount = ? 
                             WHERE billId = ?`,
                            [bill.totalAmount, bill.totalDiscount, bill.settledAmount, bill.billId]
                        );

                        currentTotal -= item.price;
                        deleted = true;
                        break; // one item per iteration
                    }
                }

                if (!deleted) break;
                iterations++;
            }

            // 4. Summary
            const allDeleted = Object.values(deletedItemsByBill).flatMap(b => b.items);
            let summary = {};
            if (allDeleted.length > 0) {
                const prices = allDeleted.map(d => d.price);
                summary = {
                    iterations,
                    totalDeletedItems: allDeleted.length,
                    largestDeletedItem: Math.max(...prices),
                    smallestDeletedItem: Math.min(...prices),
                    averageDeletedValue: (prices.reduce((a, b) => a + b, 0) / prices.length).toFixed(2)
                };
            } else {
                summary = { iterations, totalDeletedItems: 0 };
            }

            // ✅ Commit changes
            await queryAsync(conn, "COMMIT");

            res.json({
                mode: "apply",
                originalTotal,
                targetAmount,
                finalTotal: currentTotal,
                summary,
                deletedItemsByBill: Object.entries(deletedItemsByBill).map(([billId, data]) => ({
                    billId,
                    billDetails: data.billDetails,
                    deletedItems: data.items
                })),
                updatedBills: bills.map(b => ({
                    billId: b.billId,
                    totalAmount: b.totalAmount,
                    totalDiscount: b.totalDiscount,
                    settledAmount: b.settledAmount,
                    remainingItems: b.items.length
                }))
            });

        } catch (error) {
            console.error("Error in settleBills:", error);
            await queryAsync(conn, "ROLLBACK");
            res.status(500).json({ message: "Internal server error" });
        } finally {
            conn.release();
        }
    });
};


module.exports = {
    settleBills,
    dryRunSettleBills
}