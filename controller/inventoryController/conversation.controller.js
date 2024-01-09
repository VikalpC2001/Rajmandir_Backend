const pool = require('../../database');

function computeConversionFactors(unitsData) {
    const conversionFactors = {};

    // Find the smallest unit by going through the unitsData
    let smallestUnit = unitsData[0].smallerUnit;

    // The conversion factor for the smallest unit is 1
    conversionFactors[smallestUnit] = 1;

    // Compute conversion factors from the smallest unit to larger units
    for (const unit of unitsData) {
        conversionFactors[unit.largerUnit] = conversionFactors[unit.smallerUnit] * unit.value;
    }

    const result = [];
    for (const [unitName, value] of Object.entries(conversionFactors)) {
        result.push({ unitName, value });
    }

    return result.reverse();  // Reverse the array to get the desired order
}

function convertQuantity(quantity, unitsDatas) {
    const conversionFactorsArray = computeConversionFactors(unitsDatas);
    let result = [];
    console.log('conversionFactorsArray', conversionFactorsArray)
    for (let i = 0; i < conversionFactorsArray.length; i++) {
        const unitData = conversionFactorsArray[i];
        const quotient = Math.floor(quantity / unitData.value);
        const remainder = quantity % unitData.value;
        console.log('partial result', quotient, remainder, unitData.value)
        if (quotient > 0) {

            result.push(`${quotient} ${unitData.unitName}`);
            quantity = remainder;
        }
    }

    // Add remaining value in the smallest unit
    if (quantity > 0) {
        result.push(`${quantity} ${conversionFactorsArray[0].unitName}`);
    }

    return result.join(' ');
}

function conversation(qty, id, unit, callback) {
    const sql_query_getJson = `SELECT bigUnitName AS largerUnit, unitNumber AS value, smallUnitName AS smallerUnit FROM product_unit_preference WHERE productId = '${id}' ORDER BY priorityNumber ASC`;

    pool.query(sql_query_getJson, (err, data) => {
        if (err) {
            console.error("An error occurred in SQL Query", err);
            return callback('Database Error', null);
        }
        let unitJson = Object.values(JSON.parse(JSON.stringify(data)));
        console.log('jo to', unitJson);
        if (unitJson.length != 0) {
            let conversationFactor = computeConversionFactors(unitJson);
            let transformedArray = conversationFactor.map(item => {
                console.log('errir>>', (Number(qty / item.value).toFixed(4)), parseInt(Number(qty / item.value)), (Number(qty / item.value).toFixed(4)) % parseInt(Number(qty / item.value)), (Number(qty / item.value).toFixed(4)), parseInt(Number(qty / item.value)))
                return { unitName: item.unitName, value: parseInt(Number(qty / item.value)) == 0 && Number(qty / item.value) > 0 ? (Number(qty / item.value).toFixed(4)) : (Number(qty / item.value).toFixed(4)) % parseInt(Number(qty / item.value)) > 0 ? (Number(qty / item.value).toFixed(4)) : parseInt(Number(qty / item.value)) };
            });
            let convertedQuantity = convertQuantity(qty, unitJson);
            let newJson = {
                vikJson: transformedArray,
                convertedQuantity: convertedQuantity ? convertedQuantity : qty + ' ' + unit // Assuming this is the result of your conversion
            };
            callback(null, newJson);
        } else {
            const newJson = {
                vikJson: [{ unitName: unit, value: qty }],
                convertedQuantity: qty + ' ' + unit
            };
            callback(null, newJson,);
        }
    });
}

// Wrap the conversation function in a Promise to handle asynchronous behavior
function conversationAsync(qty, id, baseUnit) {
    return new Promise((resolve, reject) => {
        conversation(qty, id, baseUnit, (err, newJson) => {
            if (err) {
                console.error(err);
                reject(err);
            } else {
                resolve(newJson);
            }
        });
    });
}

async function processDatas(datas) {
    console.log('jarak joo', datas);
    const updatedDatas = [];
    for (const e of datas) {
        try {
            const newJson = await conversationAsync(e.remainingStock, e.productId, e.minProductUnit);
            console.log('Jo Lodi', newJson);
            updatedDatas.push(newJson);
        } catch (error) {
            // Handle errors here
            console.error(error);
        }
    }
    return updatedDatas;
}

function newConversationAsync(qty, id, baseUnit) {
    return new Promise((resolve, reject) => {
        conversation(qty, id, baseUnit, (err, newJson) => {
            if (err) {
                console.error(err);
                reject(err);
            } else {
                resolve(newJson.convertedQuantity);
            }
        });
    });
}

// newConversationAsync(400, 'product_1703751380133', 'glass').then((res) => {
//     // data = { ...data, productQty: res.data }
//     console.log('>>>responce', res)
// })
// console.log('jaaaaaaaa', newConversationAsync);

module.exports = {
    processDatas,
    newConversationAsync,
    computeConversionFactors
}