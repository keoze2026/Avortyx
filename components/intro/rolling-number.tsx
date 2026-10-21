// A figure whose digits roll into place when it changes ("$82,084", "1,420"): each digit is a column
// of 0-9 that slides to the current one; separators and symbols stay still. The columns are hidden
// from screen readers and copy-paste; the plain text is there for both instead. Sized in em, so it
// takes the size of the text around it (keep that a whole number of pixels so the digits stay sharp).

function Digit({ d }: { d: number }) {
  return (
    <span className="relative inline-block h-[1em] overflow-hidden leading-none" style={{ width: "0.62em" }}>
      <span
        className="absolute left-0 top-0 flex flex-col transition-transform duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)] motion-reduce:transition-none"
        style={{ transform: `translateY(${-d}em)` }}
      >
        {Array.from({ length: 10 }, (_, n) => (
          <span key={n} className="block h-[1em] text-center">
            {n}
          </span>
        ))}
      </span>
    </span>
  );
}

export function RollingNumber({ text }: { text: string }) {
  return (
    <span className="inline-flex items-center">
      <span className="sr-only">{text}</span>
      <span className="inline-flex select-none items-center" aria-hidden="true">
        {/* keyed from the right, so a figure gaining a digit doesn't re-roll the ones it already had */}
        {[...text].map((ch, i) =>
          /\d/.test(ch) ? <Digit key={text.length - i} d={Number(ch)} /> : <span key={`s${text.length - i}`} className="leading-none">{ch}</span>,
        )}
      </span>
    </span>
  );
}
