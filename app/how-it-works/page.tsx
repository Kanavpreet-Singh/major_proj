const STEPS = [
  { title: 'Split', text: 'The claim is broken into single facts.' },
  { title: 'Search', text: 'Each fact is looked up on Wikipedia and the web.' },
  { title: 'Debate', text: 'A defender and a prosecutor argue from the sources found. Quotes that are not in a source are flagged.' },
  { title: 'Rule', text: 'A judge weighs both sides and decides, or says there is not enough evidence.' },
];

const OTHERS = [
  { title: 'Images', text: 'A trained CLIP model checks whether the image matches the claim.' },
  { title: 'Articles', text: 'Article X-Ray finds the checkable claims in an article and runs each one through the steps above.' },
];

export default function HowItWorksPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
      <h1 className="font-serif text-4xl font-medium tracking-tight sm:text-5xl">How it works</h1>

      <ol className="mt-14 space-y-10">
        {STEPS.map((s, i) => (
          <li key={s.title} className="grid grid-cols-[3rem_1fr] gap-4">
            <span className="font-serif text-4xl leading-none text-muted-foreground/50 tabular-nums">{i + 1}</span>
            <div>
              <h2 className="font-serif text-2xl">{s.title}</h2>
              <p className="mt-1 max-w-[60ch] text-lg text-muted-foreground">{s.text}</p>
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-16 grid gap-10 border-t pt-12 sm:grid-cols-2">
        {OTHERS.map((o) => (
          <div key={o.title}>
            <h2 className="font-serif text-2xl">{o.title}</h2>
            <p className="mt-1 text-muted-foreground">{o.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
