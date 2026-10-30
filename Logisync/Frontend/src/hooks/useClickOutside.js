import { useEffect } from "react";

// Isinasara ang dropdown kapag nag-click sa labas nito o pinindot ang Esc.
// ref    = ang kahon ng dropdown
// onClose = function na magsasara
// active = kailangan lang makinig kapag bukas ang dropdown
export default function useClickOutside(ref, onClose, active = true) {
  useEffect(() => {
    if (!active) return;
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [ref, onClose, active]);
}
