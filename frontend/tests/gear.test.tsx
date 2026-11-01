import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BootcampGear } from '@/components/BootcampGear';

const LINES = [
  'NOT EVERY HACKER WEARS A BLACK HAT.',
  'Some wear white. Some build defences. Some challenge the systems others trust.',
  'We are the Maxim Nyansa Cybersecurity Bootcamp 2026 cohort — a generation of curious minds, problem-solvers, and aspiring cybersecurity professionals learning to think like attackers and defend like professionals.',
  "We don't just learn how systems work. We learn how to protect them.",
  'Think ethically. Hack responsibly. Defend relentlessly.',
  'THE WHITE HAT. THE RIGHT MINDSET.',
  'It is more than fabric, a crown, and a black band.',
  'It represents a responsibility.',
  'The knowledge to discover vulnerabilities.',
  'The courage to question what others overlook.',
  'The discipline to understand risks.',
  'And the integrity to use every skill for good.',
  'MAXIM NYANSA across the crown represents the community behind the journey.',
  'CYBERSECURITY 2026 across the band represents the people, the experience, and the legacy we are building together.',
  'We wear the white hat not because we know everything, but because we are committed to learning, protecting, and doing what is right.',
  'Understand the fundamentals and develop practical cybersecurity skills.',
  'Experiment, investigate, and turn knowledge into solutions.',
  'Build relationships, share ideas, and grow together.',
  'Discover real-world technologies and industry opportunities.',
  'DIFFERENT BACKGROUNDS. ONE MISSION.',
  'Every great cybersecurity professional starts somewhere.',
  'Some of us came with technical experience. Others came with curiosity, questions, and a willingness to learn.',
  'But we share something bigger than our individual backgrounds: the desire to understand technology, challenge assumptions, and make the digital world safer.',
  "THE JOURNEY DOESN'T END HERE.",
  'The bootcamp may have a timeline, but the knowledge, relationships, and responsibility we carry forward have no expiration date.',
  'Today, we are learners.',
  'Tomorrow, we become the people others trust to protect what matters.',
  'WEAR THE HAT. CARRY THE RESPONSIBILITY. PROTECT THE FUTURE.',
];

describe('bootcamp gear campaign', () => {
  it('tells the white-hat story once, with the original fedora', () => {
    render(<BootcampGear />);
    const section = document.getElementById('gear');
    expect(section).not.toBeNull();
    expect(section?.tagName).toBe('SECTION');
    expect(document.querySelectorAll('section')).toHaveLength(1);

    const heading = screen.getByRole('heading', { level: 2, name: /not every hacker wears a black hat/i });
    expect(heading).toHaveAttribute('id', 'gear-title');
    expect(section).toHaveAttribute('aria-labelledby', 'gear-title');
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(1);

    const text = (section?.textContent ?? '').replace(/\s+/g, ' ').trim();
    for (const line of LINES) {
      expect(text.split(line).length - 1, line).toBe(1);
    }
    expect(text).not.toMatch(/A fedora for the cohort/i);
    expect(text).not.toMatch(/The 2026 white hat/i);

    for (const name of ['THE WHITE HAT. THE RIGHT MINDSET.', 'LEARN', 'INNOVATE', 'CONNECT', 'EXPLORE', 'DIFFERENT BACKGROUNDS. ONE MISSION.', "THE JOURNEY DOESN'T END HERE."]) {
      expect(screen.getByRole('heading', { level: 3, name })).toBeInTheDocument();
    }

    const hat = screen.getByRole('img', { name: /white fedora with maxim nyansa/i });
    expect(hat).toHaveAttribute('src', '/assets/gear/bootcamp-hat.png');
    expect(hat).toHaveAttribute('width', '1467');
    expect(hat).toHaveAttribute('height', '843');
    expect(hat).toHaveAttribute('loading', 'lazy');
    expect(hat).toHaveAttribute('alt', 'White fedora with MAXIM NYANSA stitched on the crown and CYBERSECURITY 2026 on the black band.');
    expect(hat.parentElement?.querySelector('source')?.getAttribute('srcset')).toContain('bootcamp-hat.webp');
    expect(hat.parentElement?.querySelector('source')?.getAttribute('srcset')).toContain('bootcamp-hat-800.webp');

    const reveals = section?.querySelectorAll('[data-reveal]') ?? [];
    expect(reveals.length).toBeGreaterThan(0);
    for (const node of reveals) {
      expect(node.getAttribute('data-reveal')).toBe('fade');
      expect(node.getAttribute('style') ?? '').not.toMatch(/transform/i);
    }
    expect(section?.querySelector('[data-reveal="scale"]')).toBeNull();
  });
});
