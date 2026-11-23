import { useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@/api/client';
import { useAuth } from '@/auth/AuthProvider';
import { ErrorSummary, Field, FormLegend } from '@/components/controls';
import {
  EmptyState,
  ErrorState,
  LoadingRows,
  StatusBadge,
  useConfirm,
  useToast,
} from '@/components/feedback';
import { usePageMeta } from '@/components/SiteChrome';
import { useAdminForm } from '@/components/adminForm';
import {
  ABOUT_PERSON_GROUPS,
  aboutPersonFieldErrors,
  aboutPersonGroupLabel,
  normalizeAdminAboutPeople,
  personHue,
  personInitials,
} from '@/domain/aboutPeople';
import { displayPhotoUrl } from '@/domain/photo';
import { isApiError, type AboutPerson, type AboutPersonGroup } from '@/domain/types';
import { useAsync } from '@/hooks/useAsync';
import { Avatar } from '@/components/Brand';

const LABELS = {
  group: 'Group',
  name: 'Name',
  title: 'Title',
  description: 'Description',
  file: 'Photo',
};

export function AboutPeoplePage() {
  const auth = useAuth();
  const canWrite = auth.allowed('content.write');
  const toast = useToast();
  const confirm = useConfirm();
  const form = useAdminForm();
  const [nonce, setNonce] = useState(0);
  const [group, setGroup] = useState<AboutPersonGroup>('founder');
  const [name, setName] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [published, setPublished] = useState(false);
  const [editing, setEditing] = useState<AboutPerson | null>(null);
  const [pending, setPending] = useState(false);
  const [fileKey, setFileKey] = useState(0);
  const busy = useRef(false);
  const record = useAsync(`about-people:${nonce}`, () =>
    api<unknown>({ method: 'GET', path: '/admin/about-people' }),
  );
  const rows = normalizeAdminAboutPeople(record.data);
  usePageMeta('Our people');

  const resetForm = () => {
    setEditing(null);
    setGroup('founder');
    setName('');
    setTitle('');
    setDescription('');
    setPublished(false);
    setFileKey((value) => value + 1);
    form.setErrors({});
  };

  const beginEdit = (person: AboutPerson) => {
    setEditing(person);
    setGroup(person.group);
    setName(person.name);
    setTitle(person.title);
    setDescription(person.description);
    setPublished(person.published);
    setFileKey((value) => value + 1);
    form.setErrors({});
    document.getElementById('name')?.focus();
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const chosen = data.get('file');
    const file = chosen instanceof File && chosen.size > 0 ? chosen : null;
    const problems = aboutPersonFieldErrors({
      group,
      name,
      title,
      description,
      file,
    });
    if (!form.block(problems) || busy.current) return;
    busy.current = true;
    setPending(true);
    const body = {
      group,
      name: name.trim(),
      title: title.trim(),
      description: description.trim(),
      published,
    };
    let saved = false;
    try {
      const row = editing
        ? await api<AboutPerson>({
            method: 'PATCH',
            path: `/admin/about-people/${editing.id}`,
            body,
          })
        : await api<AboutPerson>({
            method: 'POST',
            path: '/admin/about-people',
            body,
          });
      saved = true;
      if (file) {
        const photo = new FormData();
        photo.set('file', file);
        await api({
          method: 'POST',
          path: `/admin/about-people/${row.id}/photo`,
          body: photo,
        });
      }
      toast(
        editing ? 'Person updated' : 'Person saved',
        published
          ? 'The About page can show this person.'
          : 'They stay off the About page until you publish them.',
      );
      resetForm();
      setNonce((value) => value + 1);
    } catch (error) {
      if (saved) {
        toast(
          'Could not finish the photo',
          isApiError(error) ? error.message : 'Request failed.',
          'error',
        );
        resetForm();
        setNonce((value) => value + 1);
      } else {
        if (isApiError(error)) form.applyServer(error.fieldErrors);
        toast(
          editing ? 'Could not update' : 'Could not save',
          isApiError(error) ? error.message : 'Request failed.',
          'error',
        );
      }
    } finally {
      busy.current = false;
      setPending(false);
    }
  };

  const setPublishedFlag = async (person: AboutPerson, live: boolean) => {
    try {
      await api({
        method: 'PATCH',
        path: `/admin/about-people/${person.id}`,
        body: { published: live },
      });
      toast(
        live ? 'Person published' : 'Person unpublished',
        live ? 'The About page can show this person.' : 'They are off the About page again.',
      );
      setNonce((value) => value + 1);
    } catch (error) {
      toast(
        live ? 'Could not publish' : 'Could not unpublish',
        isApiError(error) ? error.message : 'Request failed.',
        'error',
      );
    }
  };

  const move = async (person: AboutPerson, direction: -1 | 1) => {
    const groupRows = rows.filter((item) => item.group === person.group);
    const index = groupRows.findIndex((item) => item.id === person.id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= groupRows.length) return;
    const order = groupRows.map((item) => item.id);
    const current = order[index];
    const swap = order[target];
    if (!current || !swap) return;
    order[index] = swap;
    order[target] = current;
    try {
      await api({
        method: 'POST',
        path: '/admin/about-people/reorder',
        body: { group: person.group, ids: order },
      });
      toast('Order saved', `${aboutPersonGroupLabel(person.group)} is in the new order.`);
      setNonce((value) => value + 1);
    } catch (error) {
      toast('Could not reorder', isApiError(error) ? error.message : 'Request failed.', 'error');
    }
  };

  const removePhoto = async (person: AboutPerson) => {
    const ok = await confirm({
      title: `Remove the photo of ${person.name}?`,
      text: 'The portrait is deleted. The name stays in the list.',
      ok: 'Remove photo',
      danger: true,
    });
    if (!ok) return;
    try {
      await api({
        method: 'DELETE',
        path: `/admin/about-people/${person.id}/photo`,
      });
      toast('Photo removed', 'The stored image has been deleted.');
      setNonce((value) => value + 1);
    } catch (error) {
      toast(
        'Could not remove the photo',
        isApiError(error) ? error.message : 'Request failed.',
        'error',
      );
    }
  };

  const remove = async (person: AboutPerson) => {
    const ok = await confirm({
      title: `Remove ${person.name}?`,
      text: 'The person and their photo will be deleted from the About page.',
      ok: 'Remove',
      danger: true,
    });
    if (!ok) return;
    try {
      await api({ method: 'DELETE', path: `/admin/about-people/${person.id}` });
      if (editing?.id === person.id) resetForm();
      toast('Person removed', 'They no longer appear in this list.');
      setNonce((value) => value + 1);
    } catch (error) {
      toast('Could not remove', isApiError(error) ? error.message : 'Request failed.', 'error');
    }
  };

  return (
    <>
      <div className="a-head">
        <div>
          <h1>Our people</h1>
          <p>
            Add the founder, the team, and partners. A description is optional. Leave it blank to
            show the photo, name, and title only. Publish a person to show them on the public About
            page.
          </p>
        </div>
        <Link className="btn btn--ghost btn--sm" to="/about">
          Preview about
        </Link>
      </div>
      {canWrite ? (
        <form
          className="panel"
          onSubmit={(event) => void submit(event)}
          style={{ marginBottom: 24 }}
          noValidate
        >
          <div className="panel__body form-grid">
            <h2>{editing ? `Edit ${editing.name}` : 'Add a person'}</h2>
            <FormLegend />
            <ErrorSummary errors={form.errors} labels={LABELS} summaryRef={form.summaryRef} />
            <Field id="group" label="Group" required error={form.errors.group}>
              <select
                className="select"
                id="group"
                name="group"
                value={group}
                onChange={(event) => {
                  const next = event.target.value;
                  if (next === 'founder' || next === 'team' || next === 'partner') {
                    setGroup(next);
                    form.clearFixed('group', undefined);
                  }
                }}
              >
                {ABOUT_PERSON_GROUPS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field id="name" label="Name" required error={form.errors.name}>
              <input
                className="input"
                id="name"
                name="name"
                value={name}
                onChange={(event) => {
                  setName(event.target.value);
                  form.clearFixed(
                    'name',
                    aboutPersonFieldErrors({
                      group,
                      name: event.target.value,
                      title,
                      description,
                    }).name,
                  );
                }}
              />
            </Field>
            <Field
              id="title"
              label="Title"
              required={false}
              error={form.errors.title}
              hint="Optional. A short role line under the name, such as Director."
            >
              <input
                className="input"
                id="title"
                name="title"
                value={title}
                onChange={(event) => {
                  setTitle(event.target.value);
                  form.clearFixed(
                    'title',
                    aboutPersonFieldErrors({
                      group,
                      name,
                      title: event.target.value,
                      description,
                    }).title,
                  );
                }}
              />
            </Field>
            <Field
              id="description"
              label="Description"
              required={false}
              error={form.errors.description}
              hint="Optional. Leave this blank to show only the photo, name, and title."
            >
              <textarea
                className="textarea"
                id="description"
                name="description"
                value={description}
                onChange={(event) => {
                  setDescription(event.target.value);
                  form.clearFixed(
                    'description',
                    aboutPersonFieldErrors({
                      group,
                      name,
                      title,
                      description: event.target.value,
                    }).description,
                  );
                }}
              />
            </Field>
            <Field
              id="file"
              label={editing ? 'Replacement photo' : 'Photo'}
              required={false}
              error={form.errors.file}
              hint="Optional. JPEG, PNG, or WebP."
            >
              <input
                key={fileKey}
                className="input"
                id="file"
                name="file"
                type="file"
                accept="image/jpeg,image/png,image/webp"
              />
            </Field>
            <Field
              id="published"
              label="Show on the About page"
              hint="Leave this off until you are ready for visitors to see this person."
            >
              <input
                type="checkbox"
                id="published"
                name="published"
                checked={published}
                onChange={(event) => setPublished(event.target.checked)}
              />
            </Field>
            <div className="flex wrap" style={{ gap: 8 }}>
              <button className="btn btn--dark btn--sm" type="submit" disabled={pending}>
                {pending ? 'Saving…' : editing ? 'Save changes' : 'Add person'}
              </button>
              {editing ? (
                <button className="btn btn--ghost btn--sm" type="button" onClick={resetForm}>
                  Cancel
                </button>
              ) : null}
            </div>
          </div>
        </form>
      ) : (
        <p className="muted" style={{ marginBottom: 24 }}>
          You can look through this list. An editor or an administrator can add and change people.
        </p>
      )}
      {record.loading ? <LoadingRows /> : null}
      {record.error ? (
        <ErrorState
          title="Could not load people"
          text={record.error.message}
          onRetry={() => setNonce((value) => value + 1)}
        />
      ) : null}
      {!record.loading && !record.error && !rows.length ? (
        <EmptyState
          icon="users"
          title="No people yet"
          text="Add the founder, team, or partners, then publish the ones that should appear on the About page."
        />
      ) : null}
      {rows.length ? (
        <div className="stack" style={{ display: 'grid', gap: 16 }}>
          {ABOUT_PERSON_GROUPS.map((option) => {
            const groupRows = rows.filter((person) => person.group === option.id);
            if (!groupRows.length) return null;
            return (
              <section key={option.id} aria-labelledby={`people-${option.id}`}>
                <h2 id={`people-${option.id}`} className="h3" style={{ marginBottom: 12 }}>
                  {option.label}
                </h2>
                <div className="media-grid" role="list">
                  {groupRows.map((person, index) => {
                    const photo = displayPhotoUrl(person.photoUrl);
                    return (
                      <article
                        className="media-item"
                        key={person.id}
                        style={{
                          display: 'block',
                          textAlign: 'left',
                          cursor: 'default',
                        }}
                      >
                        {photo ? (
                          <img src={photo} alt="" />
                        ) : (
                          <span
                            className="ph"
                            style={{
                              display: 'grid',
                              placeItems: 'center',
                              minHeight: 120,
                            }}
                          >
                            <Avatar
                              initials={personInitials(person.name)}
                              hue={personHue(person.name)}
                            />
                          </span>
                        )}
                        <span className="mi-flag">
                          <StatusBadge status={person.published ? 'published' : 'draft'} />
                        </span>
                        <span className="mi-name">{person.name}</span>
                        {person.title ? (
                          <p style={{ padding: '0 12px', margin: 0 }}>{person.title}</p>
                        ) : null}
                        {person.description ? (
                          <p style={{ padding: '8px 12px 0', margin: 0 }}>{person.description}</p>
                        ) : null}
                        {canWrite ? (
                          <div className="flex wrap" style={{ gap: 8, padding: 12 }}>
                            <button
                              className="btn btn--ghost btn--xs"
                              type="button"
                              onClick={() => beginEdit(person)}
                            >
                              Edit
                            </button>
                            <button
                              className="btn btn--ghost btn--xs"
                              type="button"
                              disabled={index === 0}
                              onClick={() => void move(person, -1)}
                              aria-label={`Move ${person.name} up`}
                            >
                              Up
                            </button>
                            <button
                              className="btn btn--ghost btn--xs"
                              type="button"
                              disabled={index === groupRows.length - 1}
                              onClick={() => void move(person, 1)}
                              aria-label={`Move ${person.name} down`}
                            >
                              Down
                            </button>
                            {person.published ? (
                              <button
                                className="btn btn--ghost btn--xs"
                                type="button"
                                onClick={() => void setPublishedFlag(person, false)}
                              >
                                Unpublish
                              </button>
                            ) : (
                              <button
                                className="btn btn--dark btn--xs"
                                type="button"
                                onClick={() => void setPublishedFlag(person, true)}
                              >
                                Publish
                              </button>
                            )}
                            {person.photoUrl ? (
                              <button
                                className="btn btn--ghost btn--xs"
                                type="button"
                                onClick={() => void removePhoto(person)}
                              >
                                Remove photo
                              </button>
                            ) : null}
                            <button
                              className="btn btn--ghost btn--xs"
                              type="button"
                              onClick={() => void remove(person)}
                            >
                              Remove
                            </button>
                          </div>
                        ) : null}
                      </article>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      ) : null}
    </>
  );
}
