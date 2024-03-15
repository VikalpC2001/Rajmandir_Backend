const express = require('express');
const router = express.Router();
const { protect } = require("../../middlewares/authMiddlewares.js");

// Manufacture Products Routs

const mfProductController = require("../../controller/factoryController/finalProductController/mfProduct.controller.js");

router.get('/getManufactureProductTable', protect, mfProductController.getManufactureProductTable);
router.get('/getMfProductListCounter', protect, mfProductController.getMfProductListCounter);
router.post('/addMfProductData', protect, mfProductController.addMfProductData);
router.delete('/removeMfProductData', protect, mfProductController.removeMfProductData);
router.post('/updateMfProductData', protect, mfProductController.updateMfProductData);
router.get('/getmfProductDetailsById', protect, mfProductController.getmfProductDetailsById);
router.get('/getMfProductCountDetailsById', protect, mfProductController.getMfProductCountDetailsById);
router.get('/getOutCategoryWiseMfProductData', protect, mfProductController.getOutCategoryWiseMfProductData);
router.get('/getOutCategoryWiseUsedByProduct', protect, mfProductController.getOutCategoryWiseUsedByProduct);
router.get('/getDistridutorWiseSellByMfProductId', protect, mfProductController.getDistridutorWiseSellByMfProductId);

// Manufacture Product Category Routs

const mfCategoryController = require("../../controller/factoryController/finalProductController/mfProductCategory.controller.js");

router.get('/getMfProductCategoryList', protect, mfCategoryController.getMfProductCategoryList);
router.post('/addMfProductCategory', protect, mfCategoryController.addMfProductCategory);
router.delete('/removeMfProductCategory', protect, mfCategoryController.removeMfProductCategory);
router.post('/updateMfProductCategory', protect, mfCategoryController.updateMfProductCategory);

// Manufacture Product OUT Category Routs

const mfOutCategoryController = require("../../controller/factoryController/finalProductController/mfProductOutCategory.controller.js");

router.get('/getmfProductOutCategoryList', protect, mfOutCategoryController.getmfProductOutCategoryList);
router.post('/addmfProductOutCategory', protect, mfOutCategoryController.addmfProductOutCategory);
router.delete('/removemfProductOutCategory', protect, mfOutCategoryController.removemfProductOutCategory);
router.post('/updatemfProductOutCategory', protect, mfOutCategoryController.updatemfProductOutCategory);

// Distributor Routs

const distributorController = require("../../controller/factoryController/finalProductController/distributor.controller.js");

router.get('/getFactoryDistributordata', protect, distributorController.getFactoryDistributordata);
router.get('/getFactoryDistributorDetailsById', protect, distributorController.getFactoryDistributorDetailsById);
router.get('/fillDistributorDetails', protect, distributorController.fillDistributorDetails);
router.get('/getDistributorCounterDetailsById', protect, distributorController.getDistributorCounterDetailsById);
router.get('/getAllProductDetailsByDistributorId', protect, distributorController.getAllProductDetailsByDistributorId);
router.post('/addDistributorDetails', protect, distributorController.addDistributorDetails);
router.delete('/removeDistributorDetails', protect, distributorController.removeDistributorDetails);
router.post('/updateDistributorDetails', protect, distributorController.updateDistributorDetails);

// Manufacture Product StockIn Data

const mfStockInController = require("../../controller/factoryController/finalProductController/mfProductStockIn.controller.js");

router.get('/getmfProductStockInList', protect, mfStockInController.getmfProductStockInList);
router.get('/fillMfProductStockInData', protect, mfStockInController.fillMfProductStockInData);
router.post('/addMfProductStockInData', protect, mfStockInController.addMfProductStockInData);
router.delete('/removeMfProductStockInData', protect, mfStockInController.removeMfProductStockInData);
router.post('/updateMfProductStockInData', protect, mfStockInController.updateMfProductStockInData);
router.get('/exportExcelSheetForMfStockIn', protect, mfStockInController.exportExcelSheetForMfStockIn);
router.get('/exportPdfForMfStockIn', protect, mfStockInController.exportPdfForMfStockIn);

// Manufacture Product StockOut Data

const mfStockOutController = require("../../controller/factoryController/finalProductController/mfProductStockOut.controller.js");

router.get('/getMfStockOutList', protect, mfStockOutController.getMfStockOutList);
router.get('/fillMfProductStockOutData', protect, mfStockOutController.fillMfProductStockOutData);
router.post('/addMfProductStockOutData', protect, mfStockOutController.addMfProductStockOutData);
router.delete('/removeMfProductStockOutTransaction', protect, mfStockOutController.removeMfProductStockOutTransaction);
router.post('/updateMfStockOutTransaction', protect, mfStockOutController.updateMfStockOutTransaction);
router.get('/exportExcelSheetForMfStockOut', protect, mfStockOutController.exportExcelSheetForMfStockOut);
router.get('/exportPdfForMfStockOut', protect, mfStockOutController.exportPdfForMfStockOut);

// Other Source Routs

const otherSourceController = require("../../controller/factoryController/finalProductController/otherSource.controller.js");

router.get('/getOtherSourceList', protect, otherSourceController.getOtherSourceList);
router.post('/addOtherSourceData', protect, otherSourceController.addOtherSourceData);
router.delete('/removeOtherSourceData', protect, otherSourceController.removeOtherSourceData);
router.post('/updateOtherSourceData', protect, otherSourceController.updateOtherSourceData);

// Recipee Routs

const recipeeController = require("../../controller/factoryController/finalProductController/recipee.controller.js");

router.post('/addRecipeeData', protect, recipeeController.addRecipeeData);
router.delete('/removeRecipeeData', protect, recipeeController.removeRecipeeData);
router.post('/updateRecipeeData', protect, recipeeController.updateRecipeeData);
router.get('/fillRecipeeDataByQty', protect, recipeeController.fillRecipeeDataByQty);
router.get('/fillRecipeeDataByBatch', protect, recipeeController.fillRecipeeDataByBatch);
router.get('/fillEditRecipeeDataById', protect, recipeeController.fillEditRecipeeDataById);

// Distributor Transaction Routs

const distributorTransactionController = require("../../controller/factoryController/finalProductController/distributorTransaction.controller.js");

router.post('/addFacttoryDistributorTransactionDetails', protect, distributorTransactionController.addFacttoryDistributorTransactionDetails);
router.delete('/removeFactoryDistributorTransactionDetails', protect, distributorTransactionController.removeFactoryDistributorTransactionDetails);
router.post('/updateFactoryDistributorTransactionDetails', protect, distributorTransactionController.updateFactoryDistributorTransactionDetails);
router.get('/fillFactoryDistributorTransactionrDetails', protect, distributorTransactionController.fillFactoryDistributorTransactionrDetails);
router.get('/getdistributorDebitTransactionList', protect, distributorTransactionController.getdistributorDebitTransactionList);
router.get('/getDistributorCashAndDebit', protect, distributorTransactionController.getDistributorCashAndDebit);
router.get('/getDistributorCashTransactionCounter', protect, distributorTransactionController.getDistributorCashTransactionCounter);
router.get('/getDistributorDebitTransactionCounter', protect, distributorTransactionController.getDistributorDebitTransactionCounter);


// DDL Final Product Routs

const ddlController = require("../../controller/factoryController/finalProductController/ddlFinalProduct.controller.js");

router.get('/ddlOtherSourceData', protect, ddlController.ddlOtherSourceData);
router.get('/ddlManufactureProductData', protect, ddlController.ddlManufactureProductData);
router.get('/ddlmfProductUnitById', protect, ddlController.ddlmfProductUnitById);
router.get('/ddlMfProduct', protect, ddlController.ddlMfProduct);
router.get('/ddlDistributorData', protect, ddlController.ddlDistributorData);

// Common Table Routs

const commonTableController = require("../../controller/factoryController/finalProductController/commonTable.controller.js");

router.get('/getCommonRawMaterialData', protect, commonTableController.getCommonRawMaterialData);
router.get('/getCommonOtherSourceData', protect, commonTableController.getCommonOtherSourceData);
router.get('/getCommonMfProductData', protect, commonTableController.getCommonMfProductData);
router.get('/exportExcelForCommonRawMaterialData', protect, commonTableController.exportExcelForCommonRawMaterialData);
router.get('/exportExcelForCommonOtherSourceData', protect, commonTableController.exportExcelForCommonOtherSourceData);
router.get('/exportExcelForCommonMfProductData', protect, commonTableController.exportExcelForCommonMfProductData);
router.get('/exportPDFForCommonRawMaterialData', protect, commonTableController.exportPDFForCommonRawMaterialData);
router.get('/exportPDFForCommonOtherSourceData', protect, commonTableController.exportPDFForCommonOtherSourceData);
router.get('/exportPDFForCommonMfProductData', protect, commonTableController.exportPDFForCommonMfProductData);


module.exports = router;

"Requesting prompt settlement of all outstanding payments post-function. Your swift attention is valued. Thank you."