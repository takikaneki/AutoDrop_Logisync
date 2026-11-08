const express = require("express");

const {
  listSellerCustomers,
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
  reviewDiscreetRequest,
  verifyParcel,
  rejectParcel,
  requestReupload,
  streamVideo,
  coordinatorHubVerify,
  coordinatorRtsDispatch,
  sellerConfirmReturned,
  reportRiderIncident,
  listRiderIncidents,
  confirmRiderIncident,
  actionRiderIncident
} = require("../controllers/parcelController");
const { authenticateToken, authorizeRoles } = require("../middleware/auth");
const { uploadVideo: uploadVideoMiddleware } = require("../middleware/upload");

const router = express.Router();

// Listahan ng parcels (seller = sarili lang, coordinator = lahat)
router.get("/", authenticateToken, authorizeRoles("seller", "coordinator"), listParcels);

// Saved customers mula sa database para sa kasalukuyang naka-login na seller
router.get("/customers", authenticateToken, authorizeRoles("seller"), listSellerCustomers);

// Hanapin gamit ang transaction number (ilagay bago ang "/:parcelId")
router.get("/by-transaction/:transactionNumber", authenticateToken, getParcelByTransaction);

// Delivery ng rider (ilagay bago ang "/:parcelId")
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

router.post("/coordinator/:parcelId/discreet",
  authenticateToken,
  authorizeRoles("coordinator"),
  reviewDiscreetRequest
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

// Return to Sender (RTS) Workflow
router.post("/coordinator/:parcelId/hub-verify",
  authenticateToken,
  authorizeRoles("coordinator"),
  coordinatorHubVerify
);

router.post("/coordinator/:parcelId/rts-dispatch",
  authenticateToken,
  authorizeRoles("coordinator"),
  coordinatorRtsDispatch
);

router.post("/seller/:parcelId/confirm-returned",
  authenticateToken,
  authorizeRoles("seller", "coordinator"),
  sellerConfirmReturned
);

// Rider Incidents & Delivery Hold
router.post("/rider/incidents",
  authenticateToken,
  authorizeRoles("rider"),
  reportRiderIncident
);

router.get("/rider/incidents",
  authenticateToken,
  authorizeRoles("rider"),
  listRiderIncidents
);

router.get("/coordinator/incidents",
  authenticateToken,
  authorizeRoles("coordinator"),
  listRiderIncidents
);

router.post("/coordinator/incidents/:incidentId/confirm",
  authenticateToken,
  authorizeRoles("coordinator"),
  confirmRiderIncident
);

router.post("/coordinator/incidents/:incidentId/action",
  authenticateToken,
  authorizeRoles("coordinator"),
  actionRiderIncident
);

module.exports = router;
