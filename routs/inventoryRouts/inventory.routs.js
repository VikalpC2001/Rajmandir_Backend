const express = require('express');
const router = express.Router();
const { protect } = require("../../middlewares/authMiddlewares.js");

// Product Routs

const productController = require("../../controller/inventoryController/product.controller.js");

router.post('/addProduct', protect, productController.addProduct);
router.post('/updateProduct', protect, productController.updateProduct);
router.delete('/removeProduct', protect, productController.removeProduct);
router.get('/getProductList', protect, productController.getProductList);
router.get('/getProductListCounter', protect, productController.getProductListCounter);
router.get('/getProductCountDetailsById', protect, productController.getProductCountDetailsById);
router.get('/getSupplierByProductId', protect, productController.getSupplierByProductId);
router.get('/getProductDetailsTable', protect, productController.getProductDetailsTable);
router.get('/exportExcelSheetForProductTable', protect, productController.exportExcelSheetForProductTable);
router.get('/getProductDetailsById', protect, productController.getProductDetailsById);
router.get('/getCategoryWiseUsedByProduct', protect, productController.getCategoryWiseUsedByProduct);
router.get('/getUnitPreferenceById', protect, productController.getUnitPreferenceById);
router.get('/exportPdfForAllProductsData', protect, productController.exportPdfForAllProductsData);
router.get('/getOutStockByCategory', protect, productController.getOutStockByCategory);
router.get('/exportPdfOutStockByCategory', protect, productController.exportPdfOutStockByCategory);
router.get('/exportExcelOutStockByCategory', protect, productController.exportExcelOutStockByCategory);

// Supplier Routs

const supplierController = require("../../controller/inventoryController/supplier.controller.js");

router.get('/getSupplierdata', supplierController.getSupplierdata);
router.get('/getSupplierAllBranchData', supplierController.getSupplierAllBranchData);
router.post('/addSupplierDetails', protect, supplierController.addSupplierDetails);
router.post('/updateSupplierDetails', protect, supplierController.updateSupplierDetails);
router.delete('/removeSupplierDetails', protect, supplierController.removeSupplierDetails);
router.get('/fillSupplierDetails', protect, supplierController.fillSupplierDetails);
router.get('/getSupplierDetailsById', protect, supplierController.getSupplierDetailsById);
router.get('/getSupplierCounterDetailsById', protect, supplierController.getSupplierCounterDetailsById);
router.get('/getProductDetailsBySupplierId', protect, supplierController.getProductDetailsBySupplierId);
router.get('/getAllProductDetailsBySupplierId', protect, supplierController.getAllProductDetailsBySupplierId);
router.get('/exportExcelSheetForAllProductBySupplierId', protect, supplierController.exportExcelSheetForAllProductBySupplierId);
router.get('/exportPdfForAllProductBySupplierId', protect, supplierController.exportPdfForAllProductBySupplierId);

// StockIn Routs

const stockInController = require("../../controller/inventoryController/stockIn.controller.js");

router.post('/addStockInDetails', protect, stockInController.addStockInDetails);
router.delete('/removeStockInTransaction', protect, stockInController.removeStockInTransaction);
router.post('/updateStockInTransaction', protect, stockInController.updateStockInTransaction);
router.get('/fillStockInTransaction', protect, stockInController.fillStockInTransaction);
router.get('/getStockInList', protect, stockInController.getStockInList);
router.get('/exportExcelSheetForStockin', protect, stockInController.exportExcelSheetForStockin);
router.get('/exportPdfForStockIn', protect, stockInController.exportPdfForStockIn);

// StockIn Category Routs

const stockInCategoryController = require("../../controller/inventoryController/stockInCategory.controller.js");

router.get('/getStockInCategoryList', protect, stockInCategoryController.getStockInCategoryList);
router.post('/addstockInCategory', protect, stockInCategoryController.addstockInCategory);
router.delete('/removestockInCategory', protect, stockInCategoryController.removestockInCategory);
router.post('/updatestockInCategory', protect, stockInCategoryController.updatestockInCategory);

// StockOut Category Routs

const stockOutCategoryController = require("../../controller/inventoryController/stockOutCategory.controller.js");

router.get('/getStockOutCategoryList', protect, stockOutCategoryController.getStockOutCategoryList);
router.post('/addstockOutCategory', protect, stockOutCategoryController.addstockOutCategory);
router.delete('/removeStockOutCategory', protect, stockOutCategoryController.removeStockOutCategory);
router.post('/updateStockOutCategory', protect, stockOutCategoryController.updateStockOutCategory);

// StockOut Routs

const stockOutController = require("../../controller/inventoryController/stockOut.controller.js");

router.post('/addStockOutDetails', protect, stockOutController.addStockOutDetails);
router.delete('/removeStockOutTransaction', protect, stockOutController.removeStockOutTransaction);
router.get('/fillStockOutTransaction', protect, stockOutController.fillStockOutTransaction);
router.post('/updateStockOutTransaction', protect, stockOutController.updateStockOutTransaction);
router.get('/getStockOutList', protect, stockOutController.getStockOutList);
router.get('/exportExcelSheetForStockout', protect, stockOutController.exportExcelSheetForStockout);
router.get('/getUpdateStockOutList', protect, stockOutController.getUpdateStockOutList);
router.get('/getUpdateStockOutListById', protect, stockOutController.getUpdateStockOutListById);
router.get('/getAllStockOutTransaction', stockOutController.getAllStockOutTransaction);
router.get('/getStockOutDataByCategory', stockOutController.getStockOutDataByCategory);
router.get('/exportExcelSheetForStockOutDataByCategoryId', stockOutController.exportExcelSheetForStockOutDataByCategoryId);
router.get('/exportPdfForStockOut', stockOutController.exportPdfForStockOut);
router.get('/exportPdfForStockOutDataByCategoryId', stockOutController.exportPdfForStockOutDataByCategoryId);

// Supplier Transaction Routs

const supplierTransactionController = require("../../controller/inventoryController/supplierTransaction.controller.js");

router.post('/addSupplierTransactionDetails', protect, supplierTransactionController.addSupplierTransactionDetails);
router.post('/updateSupplierTransactionDetails', protect, supplierTransactionController.updateSupplierTransactionDetails);
router.delete('/removeSupplierTransactionDetails', protect, supplierTransactionController.removeSupplierTransactionDetails);
router.get('/fillSupplieTransactionrDetails', protect, supplierTransactionController.fillSupplieTransactionrDetails);
router.get('/getDebitTransactionList', protect, supplierTransactionController.getDebitTransactionList);
router.get('/getCashTransactionList', protect, supplierTransactionController.getCashTransactionList);
router.get('/exportExcelSheetForDebitTransactionList', protect, supplierTransactionController.exportExcelSheetForDebitTransactionList);
router.get('/exportExcelSheetForCashTransactionList', protect, supplierTransactionController.exportExcelSheetForCashTransactionList);
router.get('/getCashTransactionCounter', protect, supplierTransactionController.getCashTransactionCounter);
router.get('/getDebitTransactionCounter', protect, supplierTransactionController.getDebitTransactionCounter);
router.get('/exportExcelSheetForDeditTransaction', protect, supplierTransactionController.exportExcelSheetForDeditTransaction);
router.get('/exportPdfForCashTransactionList', protect, supplierTransactionController.exportPdfForCashTransactionList);
router.get('/exportPdfForDebitTransactionList', protect, supplierTransactionController.exportPdfForDebitTransactionList);
router.get('/exportPdfForDeditTransaction', protect, supplierTransactionController.exportPdfForDeditTransaction);

// Supplier Common Data For Owner

const supplierCommonController = require("../../controller/inventoryController/supplierCommon.controller.js");

router.get('/getOwnerAllProductDetailsBySupplierId', protect, supplierCommonController.getOwnerAllProductDetailsBySupplierId);
router.get('/getOwnerProductDetailsBySupplierId', protect, supplierCommonController.getOwnerProductDetailsBySupplierId);
router.get('/getOwnerSupplierCounterDetailsById', protect, supplierCommonController.getOwnerSupplierCounterDetailsById);
router.get('/getOwnerStockInList', protect, supplierCommonController.getOwnerStockInList);
router.get('/exportExcelSheetForOwnerAllProductBySupplierId', protect, supplierCommonController.exportExcelSheetForOwnerAllProductBySupplierId);
router.get('/exportExcelSheetForOwnerStockIn', protect, supplierCommonController.exportExcelSheetForOwnerStockIn);
router.get('/exportPdfForOwnerAllProductBySupplierId', protect, supplierCommonController.exportPdfForOwnerAllProductBySupplierId);
router.get('/exportPdfForOwnerStockIn', protect, supplierCommonController.exportPdfForOwnerStockIn);

// Supplier Transaction For Owner Routs

const supplierCommonTransactionController = require("../../controller/inventoryController/supplierCommonTransaction.controller.js");

router.get('/getOwnerCashTransactionCounter', protect, supplierCommonTransactionController.getOwnerCashTransactionCounter);
router.get('/getOwnerCashTransactionList', protect, supplierCommonTransactionController.getOwnerCashTransactionList);
router.get('/getOwnerDebitTransactionCounter', protect, supplierCommonTransactionController.getOwnerDebitTransactionCounter);
router.get('/getOwnerDebitTransactionList', protect, supplierCommonTransactionController.getOwnerDebitTransactionList);
router.get('/exportExcelSheetForOwnerDebitTransactionList', protect, supplierCommonTransactionController.exportExcelSheetForOwnerDebitTransactionList);
router.get('/exportExcelSheetForOwnerCashTransactionList', protect, supplierCommonTransactionController.exportExcelSheetForOwnerCashTransactionList);
router.get('/exportExcelSheetForOwnerDeditTransaction', protect, supplierCommonTransactionController.exportExcelSheetForOwnerDeditTransaction);
router.get('/exportTransactionInvoiceData', protect, supplierCommonTransactionController.exportTransactionInvoiceData);
router.get('/exportPdfForOwnerCashTransactionList', protect, supplierCommonTransactionController.exportPdfForOwnerCashTransactionList);
router.get('/exportPdfForOwnerDebitTransactionList', protect, supplierCommonTransactionController.exportPdfForOwnerDebitTransactionList);
router.get('/exportPdfForOwnerDeditTransaction', protect, supplierCommonTransactionController.exportPdfForOwnerDeditTransaction);


// Inventory Dropdown List Routs

const ddlInventoryController = require("../../controller/inventoryController/ddlInventory.controller.js");

router.get('/productWiseSupplierDDL', protect, ddlInventoryController.productWiseSupplierDDL);
router.get('/ddlStockInCategory', protect, ddlInventoryController.ddlStockInCategory);
router.get('/ddlUnitById', protect, ddlInventoryController.ddlUnitById);
router.get('/ddlStockOutCategory', protect, ddlInventoryController.ddlStockOutCategory);
router.get('/ddlProduct', protect, ddlInventoryController.ddlProduct);
router.get('/ddlBranchList', protect, ddlInventoryController.ddlBranchList);
router.get('/ddlAllProductData', protect, ddlInventoryController.ddlAllProductData);

// Bulk Delete Routs

const bulkDeleteController = require("../../controller/inventoryController/bulkDeleteInventory.controller.js");

router.delete('/emptyModifiedHistoryOfStockOut', protect, bulkDeleteController.emptyModifiedHistoryOfStockOut);
router.delete('/emptyModifiedHistoryOfStockOutById', protect, bulkDeleteController.emptyModifiedHistoryOfStockOutById);

// Auto StockOut Details

const autoStockOutController = require("../../controller/inventoryController/autoStockOut.controller.js");

router.get('/addAutoStoctOutDetails', protect, autoStockOutController.addAutoStoctOutDetails);

module.exports = router;