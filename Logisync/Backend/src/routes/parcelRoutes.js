const express = require("express");

const {
  listSellerCustomers,
  getParcelDraft,
  saveParcelDraft,
  deleteParcelDraft,
  riderScanParcel,
  riderDelivered,
  riderFailed,
  listRiderParcels,
  listParcels,
  getParcelByTransaction,
  createParcel,
  getParcelForRole,
  getSellerParcel,
  getVideoUploadSignature,
  uploadVideo,
  getCoordinatorParcel,
  reviewDiscreetRequest,
  verifyParcel,
  rejectParcel,
  requestReupload,
  streamVideo,
  coordinatorInitiateReturnToHub,
  reportRiderIncident,
  listRiderIncidents,
  confirmRiderIncident,
  actionRiderIncident,
  scanUnified,
  riderReschedule,
  riderRequestRth,
  coordinatorListRth,
  coordinatorConfirmRth,
  getParcelHistory
} = require("../controllers/parcelController");
const { authenticateToken, authorizeRoles, requireRiderType } = require("../middleware/auth");
const { uploadVideo: uploadVideoMiddleware } = require("../middleware/upload");

const router = express.Router();

// Listahan ng parcels (seller = sarili lang, coordinator = lahat)
router.get("/", authenticateToken, authorizeRoles("seller", "coordinator"), listParcels);

// Saved customers mula sa database para sa kasalukuyang naka-login na seller
router.get("/customers", authenticateToken, authorizeRoles("seller"), listSellerCustomers);

// Seller Create Parcel Auto-Save & Draft Recovery (ilagay bago ang "/:parcelId")
router.get("/draft", authenticateToken, authorizeRoles("seller"), getParcelDraft);
router.put("/draft", authenticateToken, authorizeRoles("seller"), saveParcelDraft);
router.post("/draft", authenticateToken, authorizeRoles("seller"), saveParcelDraft);
router.delete("/draft", authenticateToken, authorizeRoles("seller"), deleteParcelDraft);

// Hanapin gamit ang transaction number (ilagay bago ang "/:parcelId")
router.get("/by-transaction/:transactionNumber", authenticateToken, getParcelByTransaction);

// Delivery ng rider (ilagay bago ang "/:parcelId")
router.get("/rider/mine", authenticateToken, authorizeRoles("rider"), listRiderParcels);
router.post("/rider/:parcelId/scan", authenticateToken, authorizeRoles("rider"), requireRiderType("LM"), riderScanParcel);
router.post("/rider/:parcelId/delivered", authenticateToken, authorizeRoles("rider"), requireRiderType("LM"), riderDelivered);
router.post("/rider/:parcelId/failed", authenticateToken, authorizeRoles("rider"), requireRiderType("LM"), riderFailed);
router.post("/rider/:parcelId/reschedule", authenticateToken, authorizeRoles("rider"), riderReschedule);
router.post("/rider/:parcelId/rth-request", authenticateToken, authorizeRoles("rider"), riderRequestRth);

// Unified QR Code Scan (accessible to all authenticated roles)
router.post("/scan-unified", authenticateToken, scanUnified);

// Coordinator Return to Hub (ilagay bago ang /coordinator/:parcelId)
router.get("/coordinator/rth", authenticateToken, authorizeRoles("coordinator"), coordinatorListRth);
router.post("/coordinator/:parcelId/rth-confirm", authenticateToken, authorizeRoles("coordinator"), coordinatorConfirmRth);

// Parcel Movement History
router.get("/:parcelId/history", authenticateToken, getParcelHistory);

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

router.post("/seller/:parcelId/video-signature",
  authenticateToken,
  authorizeRoles("seller"),
  getVideoUploadSignature
);

router.post("/seller/:parcelId/video",
  authenticateToken,
  authorizeRoles("seller"),
  (req, res, next) => {
    if (req.is("application/json")) return next();
    return uploadVideoMiddleware.single("video")(req, res, next);
  },
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
  authorizeRoles("coordinator", "seller"),
  streamVideo
);

// Coordinator Return to Hub Approval
router.post("/coordinator/:parcelId/return-to-hub",
  authenticateToken,
  authorizeRoles("coordinator"),
  coordinatorInitiateReturnToHub
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
