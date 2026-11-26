import { useEffect, useState } from "react";
import { Modal } from "../ui.jsx";
import { Notice } from "../portal.jsx";
import { btnGhost, btnPrimary, inputCls, labelCls, textareaCls } from "../styles.js";
import { reportIncident } from "../../services/parcelService.js";
import { toast } from "../../store/toast.js";
import Icon from "../Icon.jsx";
import { FilterSelect } from "../SearchFilterBar.jsx";

export default function ReportIncidentModal({ open, onClose }) {
  const [incidentType, setIncidentType] = useState("Vehicle Breakdown");
  const [incidentDesc, setIncidentDesc] = useState("");
  const [incidentSubmitting, setIncidentSubmitting] = useState(false);
  const [incidentError, setIncidentError] = useState("");

  useEffect(() => {
    if (open) setIncidentError("");
  }, [open]);

  const handleReportIncident = async () => {
    if (!incidentDesc.trim()) {
      return setIncidentError("Please describe what happened (location, situation, impact).");
    }
    setIncidentSubmitting(true);
    setIncidentError("");
    try {
      await reportIncident({ incident_type: incidentType, description: incidentDesc.trim() });
      toast("Incident report submitted. Coordinator notified to review delivery hold.", "info");
      setIncidentDesc("");
      onClose?.();
    } catch (err) {
      setIncidentError(err.message || "Failed to submit incident report.");
    } finally {
      setIncidentSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      z="z-[3500]"
      className="w-full max-w-[500px] p-6 dark:bg-night-panel"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute right-3.5 top-3.5 h-8 w-8 rounded-full bg-[#f4f6f8] text-[#7c8da0] dark:bg-night-line"
      >
        <Icon name="x" />
      </button>
      <div className="mb-3 flex items-center gap-2.5 text-[#d97706]">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#fef3c7] text-[18px]">
          <Icon name="triangle-alert" />
        </span>
        <h2 className="text-[18px] font-bold text-[#27364f] dark:text-[#f1eeeb]">Report Incident</h2>
      </div>
      <p className="mb-4 text-[13px] text-[#64748b] dark:text-[#cbd5e1]">
        Report road incidents, vehicle breakdowns, or emergencies. The Coordinator will review and place your undelivered parcels on delivery hold (pausing the 3-day reschedule counter).
      </p>

      <label className={labelCls} htmlFor="incident-type">Incident Type</label>
      <FilterSelect
        id="incident-type"
        value={incidentType}
        onChange={(e) => setIncidentType(e.target.value)}
        icon="triangle-alert"
        fullWidth
        inline
        ariaLabel="Incident Type"
      >
        <option value="Vehicle Breakdown">Vehicle Breakdown</option>
        <option value="Accident / Road Incident">Accident / Road Incident</option>
        <option value="Medical Emergency">Medical Emergency</option>
        <option value="Severe Weather / Flooding">Severe Weather / Flooding</option>
        <option value="Personal Emergency">Personal Emergency</option>
        <option value="Other">Other Emergency</option>
      </FilterSelect>

      <div className="mt-4">
        <label className={labelCls} htmlFor="incident-desc">Details / Description</label>
        <textarea
          id="incident-desc"
          rows={3}
          value={incidentDesc}
          onChange={(e) => setIncidentDesc(e.target.value)}
          placeholder="Describe what happened, current location, condition..."
          className={textareaCls}
        />
      </div>

      {incidentError && (
        <div className="mt-4">
          <Notice tone="error" icon="circle-alert">{incidentError}</Notice>
        </div>
      )}

      <div className="mt-5 flex justify-end gap-2.5">
        <button type="button" onClick={onClose} className={btnGhost}>Cancel</button>
        <button type="button" onClick={handleReportIncident} disabled={incidentSubmitting} className={btnPrimary}>
          {incidentSubmitting ? "Submitting…" : "Submit Report"}
        </button>
      </div>
    </Modal>
  );
}
