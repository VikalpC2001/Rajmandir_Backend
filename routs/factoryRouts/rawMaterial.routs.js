const express = require('express');
const router = express.Router();
const { protect } = require("../../middlewares/authMiddlewares.js");

// Raw Material Data Routs

const rawMaterialController = require("../../controller/factoryController/rawMaterial/rawMaterial.controller.js");

router.get('/getRawMaterialList', protect, rawMaterialController.getRawMaterialList);
router.post('/addRawMaterial', protect, rawMaterialController.addRawMaterial);
router.get('/getCategoryWiseUsedByRawMaterial', protect, rawMaterialController.getCategoryWiseUsedByRawMaterial);
router.get('/getRawMaterialDetailsById', protect, rawMaterialController.getRawMaterialDetailsById);
router.get('/getRawMaterialListCounter', protect, rawMaterialController.getRawMaterialListCounter);
router.get('/getRawMaterialTable', protect, rawMaterialController.getRawMaterialTable);
router.get('/getRmUnitPreferenceById', protect, rawMaterialController.getRmUnitPreferenceById);
router.get('/getRowMaterialCountDetailsById', protect, rawMaterialController.getRowMaterialCountDetailsById);
router.get('/getSupplierByRawMaterialId', protect, rawMaterialController.getSupplierByRawMaterialId);
router.delete('/removeRawMaterial', protect, rawMaterialController.removeRawMaterial);
router.post('/updateRawMaterial', protect, rawMaterialController.updateRawMaterial);
router.get('/exportPdfForAllRawMaterialData', protect, rawMaterialController.exportPdfForAllRawMaterialData);
router.get('/exportExcelSheetForRawMaterialTable', protect, rawMaterialController.exportExcelSheetForRawMaterialTable);

// Raw Material Supplier Routs

const rmSupplierController = require("../../controller/factoryController/rawMaterial/rmSupplier.controller.js");

router.post('/addFactorySupplierDetails', protect, rmSupplierController.addFactorySupplierDetails);
router.get('/fillFactorySupplierDetails', protect, rmSupplierController.fillFactorySupplierDetails);
router.get('/getAllRawMaterialsBySupplierId', protect, rmSupplierController.getAllRawMaterialsBySupplierId);
router.get('/getFactorySupplierAllData', protect, rmSupplierController.getFactorySupplierAllData);
router.get('/getFactorySupplierCounterDetailsById', protect, rmSupplierController.getFactorySupplierCounterDetailsById);
router.get('/getFactorySupplierDetailsById', protect, rmSupplierController.getFactorySupplierDetailsById);
router.get('/getFactorySupplierdata', protect, rmSupplierController.getFactorySupplierdata);
router.get('/getRawMaterialsBySupplierId', protect, rmSupplierController.getRawMaterialsBySupplierId);
router.delete('/removeFactorySupplierDetails', protect, rmSupplierController.removeFactorySupplierDetails);
router.post('/updateFactorySupplierDetails', protect, rmSupplierController.updateFactorySupplierDetails);
router.get('/exportExcelSheetForAllRawMaterialsBySupplierId', protect, rmSupplierController.exportExcelSheetForAllRawMaterialsBySupplierId);

// Raw Material Stock In Category Routs

const rmStockInCategoryController = require("../../controller/factoryController/rawMaterial/rmStockInCategory.controller.js");

router.post('/addRmStockInCategory', protect, rmStockInCategoryController.addRmStockInCategory);
router.get('/getRmStockInCategoryList', protect, rmStockInCategoryController.getRmStockInCategoryList);
router.delete('/removeRmStockInCategory', protect, rmStockInCategoryController.removeRmStockInCategory);
router.post('/updateRmstockInCategory', protect, rmStockInCategoryController.updateRmstockInCategory);

// Raw Material Stock Out Category Routs

const rmStockOutCategoryController = require("../../controller/factoryController/rawMaterial/rmStockOutCategory.controller.js");

router.post('/addRmStockOutCategory', protect, rmStockOutCategoryController.addRmStockOutCategory);
router.get('/getRmStockOutCategoryList', protect, rmStockOutCategoryController.getRmStockOutCategoryList);
router.delete('/removeRmStockOutCategory', protect, rmStockOutCategoryController.removeRmStockOutCategory);
router.post('/updateRmStockOutCategory', protect, rmStockOutCategoryController.updateRmStockOutCategory);

// Raw Material Stock In Routs

const rmStockInController = require("../../controller/factoryController/rawMaterial/rmStockIn.controller.js");

router.post('/addRawMaterialStockInDetails', protect, rmStockInController.addRawMaterialStockInDetails);
router.get('/fillRawMaterialStockInTransaction', protect, rmStockInController.fillRawMaterialStockInTransaction);
router.get('/getRawMaterialStockInList', protect, rmStockInController.getRawMaterialStockInList);
router.delete('/removeRawMaterialStockInTransaction', protect, rmStockInController.removeRawMaterialStockInTransaction);
router.post('/updateRawMaterialStockInTransaction', protect, rmStockInController.updateRawMaterialStockInTransaction);
router.get('/exportPdfForRawMaterialStockInList', protect, rmStockInController.exportPdfForRawMaterialStockInList);
router.get('/exportExcelSheetForRawMaterialStockInList', protect, rmStockInController.exportExcelSheetForRawMaterialStockInList);

// Raw Material Stock Out Routs

const rmStockOutController = require("../../controller/factoryController/rawMaterial/rmStockOut.controller.js");

router.post('/addRmStockOutDetails', protect, rmStockOutController.addRmStockOutDetails);
router.get('/fillRmStockOutTransaction', protect, rmStockOutController.fillRmStockOutTransaction);
router.get('/getRmStockOutDataByCategory', protect, rmStockOutController.getRmStockOutDataByCategory);
router.get('/getRmStockOutList', protect, rmStockOutController.getRmStockOutList);
router.get('/getUpdateRmStockOutList', protect, rmStockOutController.getUpdateRmStockOutList);
router.get('/getUpdateRmStockOutListById', protect, rmStockOutController.getUpdateRmStockOutListById);
router.delete('/removeRmStockOutTransaction', protect, rmStockOutController.removeRmStockOutTransaction);
router.post('/updateRmStockOutTransaction', protect, rmStockOutController.updateRmStockOutTransaction);
router.get('/exportPdfForRmStockOutDataByCategoryId', protect, rmStockOutController.exportPdfForRmStockOutDataByCategoryId);
router.get('/exportPdfForRmStockOutList', protect, rmStockOutController.exportPdfForRmStockOutList);
router.get('/exportExcelSheetForRmStockoutList', protect, rmStockOutController.exportExcelSheetForRmStockoutList);
router.get('/exportExcelSheetForRmStockOutDataByCategoryId', protect, rmStockOutController.exportExcelSheetForRmStockOutDataByCategoryId);

// DDL Raw Material Routs

const ddlRowMaterialController = require("../../controller/factoryController/rawMaterial/ddlRawMaterial.controler.js");

router.get('/ddlAllRawMaterialData', protect, ddlRowMaterialController.ddlAllRawMaterialData);
router.get('/ddlRawMaterial', protect, ddlRowMaterialController.ddlRawMaterial);
router.get('/ddlRmStockInCategory', protect, ddlRowMaterialController.ddlRmStockInCategory);
router.get('/ddlRmStockOutCategory', protect, ddlRowMaterialController.ddlRmStockOutCategory);
router.get('/ddlRmUnitById', protect, ddlRowMaterialController.ddlRmUnitById);
router.get('/rawMaterialWiseSupplierDDL', protect, ddlRowMaterialController.rawMaterialWiseSupplierDDL);

// Raw Material Supplier Transaction Routs

const rmSupplierTransactionRouts = require("../../controller/factoryController/rawMaterial/rmSupplierTransaction.controller.js");

router.post('/addFacttorySupplierTransactionDetails', protect, rmSupplierTransactionRouts.addFacttorySupplierTransactionDetails);
router.get('/fillFactorySupplieTransactionrDetails', protect, rmSupplierTransactionRouts.fillFactorySupplieTransactionrDetails);
router.get('/getRmCashTransactionCounter', protect, rmSupplierTransactionRouts.getRmCashTransactionCounter);
router.get('/getRmCashTransactionList', protect, rmSupplierTransactionRouts.getRmCashTransactionList);
router.get('/getRmDebitTransactionCounter', protect, rmSupplierTransactionRouts.getRmDebitTransactionCounter);
router.get('/getRmDebitTransactionList', protect, rmSupplierTransactionRouts.getRmDebitTransactionList);
router.delete('/removeFactorySupplierTransactionDetails', protect, rmSupplierTransactionRouts.removeFactorySupplierTransactionDetails);
router.post('/updateFactorySupplierTransactionDetails', protect, rmSupplierTransactionRouts.updateFactorySupplierTransactionDetails);
router.get('/exportExcelSheetForRmDeditTransaction', protect, rmSupplierTransactionRouts.exportExcelSheetForRmDeditTransaction);
router.get('/exportExcelSheetForRmDebitTransactionList', protect, rmSupplierTransactionRouts.exportExcelSheetForRmDebitTransactionList);
router.get('/exportExcelSheetForRmCashTransactionList', protect, rmSupplierTransactionRouts.exportExcelSheetForRmCashTransactionList);


// Bulk Delete Raw Material Routs

const bulkDeleteRowMaterialController = require("../../controller/factoryController/rawMaterial/bulkDeleteRawMaterial.controller.js");

router.delete('/emptyModifiedHistoryOfStockOut', protect, bulkDeleteRowMaterialController.emptyModifiedHistoryOfStockOut);
router.delete('/emptyModifiedHistoryOfStockOutById', protect, bulkDeleteRowMaterialController.emptyModifiedHistoryOfStockOutById);

module.exports = router;