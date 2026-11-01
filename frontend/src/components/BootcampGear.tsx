import { Reveal } from '@/components/Brand';
import './BootcampGear.css';

const JOURNEY = [
  ['01', 'LEARN', 'Understand the fundamentals and develop practical cybersecurity skills.'],
  ['02', 'INNOVATE', 'Experiment, investigate, and turn knowledge into solutions.'],
  ['03', 'CONNECT', 'Build relationships, share ideas, and grow together.'],
  ['04', 'EXPLORE', 'Discover real-world technologies and industry opportunities.'],
] as const;

/**
 * Home “Bootcamp gear” story. One section, one symbol.
 * Reveals are opacity-only (`data-reveal="fade"` → transform: none) so this
 * block cannot recreate the page-enter transform containing-block bug.
 */
export function BootcampGear() {
  return (
    <section className="section section--dark gear" id="gear" aria-labelledby="gear-title">
      <div className="container">
        <div className="gear__hero">
          <Reveal className="gear__identity" reveal="fade">
            <p className="eyebrow">Bootcamp gear</p>
            <h2 id="gear-title" className="gear__title">NOT EVERY HACKER WEARS A BLACK HAT.</h2>
            <div className="gear__story">
              <p className="gear__triad">Some wear <em>white</em>. Some build defences. Some challenge the systems others trust.</p>
              <p>We are the Maxim Nyansa Cybersecurity Bootcamp 2026 cohort — a generation of curious minds, problem-solvers, and aspiring cybersecurity professionals learning to think like attackers and defend like professionals.</p>
              <p>We don&apos;t just learn how systems work. We learn how to protect them.</p>
            </div>
            <p className="gear__creed">Think ethically. Hack responsibly. Defend relentlessly.</p>
          </Reveal>
          <Reveal as="figure" className="gear__figure" reveal="fade" i={1}>
            <p className="gear__plate"><span>Fig. 01</span><span>Cohort mark</span></p>
            <picture>
              <source type="image/webp" srcSet="/assets/gear/bootcamp-hat-800.webp 800w, /assets/gear/bootcamp-hat.webp 1467w" sizes="(max-width: 900px) 92vw, 640px" />
              <img src="/assets/gear/bootcamp-hat.png" width={1467} height={843} alt="White fedora with MAXIM NYANSA stitched on the crown and CYBERSECURITY 2026 on the black band." loading="lazy" decoding="async" />
            </picture>
          </Reveal>
        </div>

        <Reveal className="gear__mindset" reveal="fade" i={2}>
          <h3 className="gear__mindset-title">
            <span className="gear__signal">THE WHITE HAT.</span>{' '}
            <span className="gear__mindset-rest">THE RIGHT MINDSET.</span>
          </h3>
          <div className="gear__mindset-grid">
            <div className="gear__mindset-copy">
              <p>It is more than fabric, a crown, and a black band.</p>
              <p className="gear__duty">It represents a responsibility.</p>
              <ul className="gear__virtues">
                <li>The knowledge to discover vulnerabilities.</li>
                <li>The courage to question what others overlook.</li>
                <li>The discipline to understand risks.</li>
                <li>And the integrity to use every skill for good.</li>
              </ul>
            </div>
            <dl className="gear__spec">
              <div>
                <dt>Crown</dt>
                <dd>MAXIM NYANSA across the crown represents the community behind the journey.</dd>
              </div>
              <div>
                <dt>Band</dt>
                <dd>CYBERSECURITY 2026 across the band represents the people, the experience, and the legacy we are building together.</dd>
              </div>
            </dl>
          </div>
          <p className="gear__commit">We wear the <em>white hat</em> not because we know everything, but because we are committed to learning, protecting, and doing what is right.</p>
        </Reveal>

        <Reveal reveal="fade" i={3}>
          <ol className="gear__journey">
            {JOURNEY.map(([index, title, text]) => (
              <li key={title}>
                <span className="gear__step" aria-hidden="true">{index}</span>
                <h3>{title}</h3>
                <p>{text}</p>
              </li>
            ))}
          </ol>
        </Reveal>

        <Reveal className="gear__cohort" reveal="fade" i={4}>
          <h3>DIFFERENT BACKGROUNDS. ONE MISSION.</h3>
          <div className="gear__prose">
            <p>Every great cybersecurity professional starts somewhere.</p>
            <p>Some of us came with technical experience. Others came with curiosity, questions, and a willingness to learn.</p>
            <p>But we share something bigger than our individual backgrounds: the desire to understand technology, challenge assumptions, and make the digital world safer.</p>
          </div>
        </Reveal>

        <Reveal className="gear__legacy" reveal="fade" i={5}>
          <h3>THE JOURNEY DOESN&apos;T END HERE.</h3>
          <p className="gear__prose-lead">The bootcamp may have a timeline, but the knowledge, relationships, and responsibility we carry forward have no expiration date.</p>
          <div className="gear__horizon">
            <p>Today, we are learners.</p>
            <p>Tomorrow, we become the people others trust to protect what matters.</p>
          </div>
          <p className="gear__oath">
            <span>WEAR THE HAT.</span> <span>CARRY THE RESPONSIBILITY.</span> <span>PROTECT THE FUTURE.</span>
          </p>
        </Reveal>
      </div>
    </section>
  );
}
