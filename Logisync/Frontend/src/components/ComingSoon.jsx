import Topbar from "./Topbar.jsx";
import { panel } from "./styles.js";

// Malinaw na placeholder para sa mga page na hindi pa nagagawa.
export default function ComingSoon({ title, note }) {
  return (
    <>
      <Topbar title={title} subtitle="This page is not available yet." />
      <section className={`${panel} px-6 py-14 text-center`}>
        <span className="mx-auto mb-4 flex h-[64px] w-[64px] items-center justify-center rounded-full bg-brand-soft text-[26px] text-brand dark:bg-night-head">
          <i className="fa-solid fa-hammer" />
        </span>
        <p className="text-[18px] font-bold">Coming soon</p>
        <p className="mx-auto mt-2 max-w-md text-[14px] leading-relaxed text-[#999]">
          {note || "This page will be built in a later step."}
        </p>
      </section>
    </>
  );
}
