import { useEffect, useState } from 'react';
import { api } from '@/api/client';
import { Avatar } from '@/components/Brand';
import {
  aboutPersonGroupLabel,
  normalizePublicAboutPeople,
  personHue,
  personInitials,
} from '@/domain/aboutPeople';
import type { AboutPersonGroup, PublicAboutPerson } from '@/domain/types';

const GROUPS: AboutPersonGroup[] = ['founder', 'team', 'partner'];

/** Founder, team, and partners. The whole section stays off the page when nobody is published. */
export function OurPeople() {
  const [people, setPeople] = useState<PublicAboutPerson[] | null>(null);

  useEffect(() => {
    let cancel = false;
    api<unknown>({ method: 'GET', path: '/public/about-people' })
      .then((rows) => {
        if (!cancel) setPeople(normalizePublicAboutPeople(rows));
      })
      .catch(() => {
        if (!cancel) setPeople([]);
      });
    return () => {
      cancel = true;
    };
  }, []);

  if (!people || people.length === 0) return null;

  return (
    <section className="section" aria-labelledby="our-people">
      <div className="container">
        <div className="sec-head">
          <div className="sec-head__title">
            <span className="eyebrow">The Foundation</span>
            <h2 id="our-people" className="h2">
              Our People
            </h2>
          </div>
        </div>
        {GROUPS.map((group) => {
          const rows = people.filter((person) => person.group === group);
          if (!rows.length) return null;
          return (
            <div className="people-group" key={group}>
              <h3>{aboutPersonGroupLabel(group)}</h3>
              <div
                className={group === 'founder' ? 'people-grid people-grid--founder' : 'people-grid'}
              >
                {rows.map((person) => (
                  <PersonCard person={person} key={person.id} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function PersonCard({ person }: { person: PublicAboutPerson }) {
  const photo = person.photoUrl;
  return (
    <article className="tcard people-card">
      <div className="tcard__art" style={{ ['--h' as string]: personHue(person.name) }}>
        {photo ? (
          <img
            className="trainee-photo"
            src={photo}
            alt=""
            width={person.width || undefined}
            height={person.height || undefined}
          />
        ) : (
          <Avatar initials={personInitials(person.name)} hue={personHue(person.name)} />
        )}
      </div>
      <div className="tcard__body">
        <h4>{person.name}</h4>
        {person.title ? <p className="people-card__title">{person.title}</p> : null}
        {person.description ? <p className="people-card__note">{person.description}</p> : null}
      </div>
    </article>
  );
}
