export default function Pagination({ page, pageSize, total, onPage }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);

  // 1 … 4 5 6 … 20
  const nums = [];
  for (let n = 1; n <= pages; n++) {
    if (n === 1 || n === pages || Math.abs(n - page) <= 1) nums.push(n);
    else if (nums[nums.length - 1] !== "…") nums.push("…");
  }

  const btn = "min-w-[30px] h-[30px] px-2 rounded-md border text-[13px]";
  return (
    <div className="flex items-center justify-between mt-[18px] gap-3 flex-wrap max-[600px]:flex-col max-[600px]:items-start">
      <span className="text-[12px] text-[#999]">
        Showing {from}–{to} of {total}
      </span>
      <div className="flex items-center gap-[5px]">
        <button
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
          aria-label="Previous page"
          className={`${btn} border-[#eee] bg-white text-[#777] hover:border-brand hover:text-brand disabled:opacity-40 disabled:hover:border-[#eee] disabled:hover:text-[#777] dark:bg-night-head dark:border-night-line`}
        >
          <i className="fa-solid fa-chevron-left text-[11px]" />
        </button>
        {nums.map((n, i) =>
          n === "…" ? (
            <span key={`e${i}`} className="px-1 text-[#aaa]">…</span>
          ) : (
            <button
              key={n}
              onClick={() => onPage(n)}
              className={`${btn} ${
                n === page
                  ? "bg-brand border-brand text-white"
                  : "bg-white border-[#eee] text-[#777] hover:border-brand hover:text-brand dark:bg-night-head dark:border-night-line"
              }`}
            >
              {n}
            </button>
          )
        )}
        <button
          disabled={page >= pages}
          onClick={() => onPage(page + 1)}
          aria-label="Next page"
          className={`${btn} border-[#eee] bg-white text-[#777] hover:border-brand hover:text-brand disabled:opacity-40 disabled:hover:border-[#eee] disabled:hover:text-[#777] dark:bg-night-head dark:border-night-line`}
        >
          <i className="fa-solid fa-chevron-right text-[11px]" />
        </button>
      </div>
    </div>
  );
}
