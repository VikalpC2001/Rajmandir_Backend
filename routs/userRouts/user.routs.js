const express = require('express')
const router = express.Router();
const { protect } = require("../../middlewares/authMiddlewares.js");

const userController = require("../../controller/userController/user.controller.js");

router.post('/authUser', userController.authUser);
router.post('/getNewTokenByBranchId', userController.getNewTokenByBranchId);
router.post('/addUserDetailsByBranchOwner', userController.addUserDetailsByBranchOwner);
router.post('/addUserDetailsByOwner', userController.addUserDetailsByOwner);
router.get('/getUserDetails', protect, userController.getUserDetails);
router.get('/ddlRights', protect, userController.ddlRights);
router.delete('/removeUser', protect, userController.removeUserDetails);
router.post('/updateUserDetailsByOwner', protect, userController.updateUserDetailsByOwner);
router.post('/addUserDetailsByBranchOwner', protect, userController.addUserDetailsByBranchOwner);
router.post('/updateUserDetailsByBranchOwner', protect, userController.updateUserDetailsBranchOwner);
router.get('/fillUserDetails', protect, userController.fillUserDetails);

module.exports = router;