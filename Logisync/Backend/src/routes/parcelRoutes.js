const express = require("express");

const {
  riderScanParcel,
  riderDelivered,
  riderFailed,
  listRiderParcels,
  listParcels,
  getParcelByTransaction,
  createParcel,
  getParcelForRole,
  getSellerParcel,
  uploadVideo,
  getCoordinatorParcel,
  verifyParcel,
  rejectParcel,
  requestReupload,
  streamVideo
} = require("../controllers/parcelController");
const { authenticateToken, authorizeRoles } = require("../middleware/auth");
const { uploadVideo: uploadVideoMiddleware } = require("../middleware/upload");

const router = express.Router();

// BAGO: listahan ng parcels (seller = sarili lang, coordinator = lahat)
router.get("/", authenticateToken, authorizeRoles("seller", "coordinator"), listParcels);

// BAGO: hanapin gamit ang transaction number (ilagay bago ang "/:parcelId")
router.get("/by-transaction/:transactionNumber", authenticateToken, getParcelByTransaction);

// BAGO: delivery ng rider (ilagay bago ang "/:parcelId")
router.get("/rider/mine", authenticateToken, authorizeRoles("rider"), listRiderParcels);
router.post("/rider/:parcelId/scan", authenticateToken, authorizeRoles("rider"), riderScanParcel);
router.post("/rider/:parcelId/delivered", authenticateToken, authorizeRoles("rider"), riderDelivered);
router.post("/rider/:parcelId/failed", authenticateToken, authorizeRoles("rider"), riderFailed);

router.post(
  "/",
  authenticateToken,
  authorizeRoles("seller"),
  createParcel
);

router.get("/:parcelId", authenticateToken, getParcelForRole);

router.get("/seller/:parcelId",
  authenticateToken,
  authorizeRoles("seller"),
  getSellerParcel
);

router.post("/seller/:parcelId/video",
  authenticateToken,
  authorizeRoles("seller"),
  uploadVideoMiddleware.single("video"),
  uploadVideo
);

router.get("/coordinator/:parcelId",
  authenticateToken,
  authorizeRoles("coordinator"),
  getCoordinatorParcel
);

router.post("/coordinator/:parcelId/verify",
  authenticateToken,
  authorizeRoles("coordinator"),
  verifyParcel
);

router.post("/coordinator/:parcelId/reject",
  authenticateToken,
  authorizeRoles("coordinator"),
  rejectParcel
);

router.post("/coordinator/:parcelId/request-reupload",
  authenticateToken,
  authorizeRoles("coordinator"),
  requestReupload
);

router.get("/videos/:videoId",
  authenticateToken,
  authorizeRoles("coordinator"),
  streamVideo
);

module.exports = router;