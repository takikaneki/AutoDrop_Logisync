import { useState } from "react";
import { Link } from "react-router-dom";
import { SPX_LOGO_DATA_URL } from "../../data/spxLogo.js";

// Global image banner displayed at the top across all user portals (Coordinator, Seller, and Rider).
// Provides official SPX Express branding, crisp logo and portal badge alignment, and balanced height.
const CONTENT = {
  coordinator: {
    home: "/dashboard",
    label: "Coordinator Hub",
    tagline: "Verify parcels and coordinate every delivery.",
    image: "/images/spx-sorting-center.jpg",
    objectPosition: "object-[center_35%]",
  },
  seller: {
    home: "/seller",
    label: "Seller Portal",
    tagline: "Register, verify and track every parcel.",
    image: "/images/spx-trucks-fleet.jpg",
    objectPosition: "object-[center_45%]",
  },
  rider: {
    home: "/rider",
    label: "Rider Portal",
    tagline: "Scan, deliver and update every drop.",
    image: "/images/spx-doorstep-delivery.jpg",
    objectPosition: "object-[72%_20%]",
  },
};

export default function GlobalBanner() {
  return null;
}
