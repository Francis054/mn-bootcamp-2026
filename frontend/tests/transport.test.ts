import { describe, expect, it } from 'vitest';
import { api, setEnvForTests } from '@/api/client';
import { ApiError } from '@/domain/types';
import { getState } from '@/dev/store';

describe('development authentication adapter', () => {
  it('refuses sign-in when production authentication is disabled', async () => {
    setEnvForTests({ apiMode: 'development-adapter', apiBaseUrl: '', authMode: 'disabled', sessionTtlMs: 1000 });
    await expect(api({ method: 'POST', path: '/auth/login', body: { email: 'administrator@example.test', password: 'not-a-secret', developmentAck: true } })).rejects.toMatchObject({ code: 'unauthenticated' });
    setEnvForTests(null);
  });

  it('signs in a fixture without storing the password', async () => {
    const before = JSON.stringify(getState());
    const result = await api<{ provider: string; user: { role: string } }>({
      method: 'POST',
      path: '/auth/login',
      body: { email: 'editor@example.test', password: 'length-ok', developmentAck: true },
    });
    expect(result.provider).toBe('development-adapter');
    expect(result.user.role).toBe('editor');
    expect(JSON.stringify(getState())).toBe(before);
    expect(JSON.stringify(getState())).not.toContain('length-ok');
  });

  it('blocks an editor from managing users', async () => {
    await api({ method: 'POST', path: '/auth/login', body: { email: 'editor@example.test', password: 'length-ok', developmentAck: true } });
    await expect(api({ method: 'GET', path: '/admin/users' })).rejects.toMatchObject({ status: 403 });
  });

  it('blocks a viewer from creating a class', async () => {
    await api({ method: 'POST', path: '/auth/login', body: { email: 'viewer@example.test', password: 'length-ok', developmentAck: true } });
    await expect(api({ method: 'POST', path: '/admin/classes', body: { title: 'Too short' } })).rejects.toBeInstanceOf(ApiError);
    await expect(api({ method: 'POST', path: '/admin/classes', body: { title: 'A real class title', moduleId: 'network', week: 4, date: '2026-11-02', summary: 'A summary long enough for the card.' } })).rejects.toMatchObject({ status: 403 });
  });

  it('returns field errors and discards a reset password', async () => {
    await api({ method: 'POST', path: '/auth/login', body: { email: 'administrator@example.test', password: 'length-ok', developmentAck: true } });
    await expect(api({ method: 'POST', path: '/admin/classes', body: { title: 'No' } })).rejects.toMatchObject({ code: 'validation', status: 422 });
    const reset = await api<{ developmentResetPath: string | null; delivered: boolean }>({ method: 'POST', path: '/auth/password-reset/request', body: { email: 'viewer@example.test' } });
    expect(reset.delivered).toBe(false);
    expect(reset.developmentResetPath).toContain('token=');
    const token = new URL(`http://local${reset.developmentResetPath}`).searchParams.get('token');
    const done = await api<{ passwordStored: boolean }>({ method: 'POST', path: '/auth/password-reset/complete', body: { token, password: 'another-one', confirm: 'another-one' } });
    expect(done.passwordStored).toBe(false);
    expect(JSON.stringify(getState())).not.toContain('another-one');
  });
});

describe('public projections', () => {
  it('does not include trainee email on the public list', async () => {
    const trainees = await api<Array<Record<string, unknown>>>({ method: 'GET', path: '/public/trainees' });
    expect(trainees.length).toBeGreaterThan(0);
    expect(trainees.every((trainee) => !('email' in trainee))).toBe(true);
  });

  it('keeps the hackathon marked to be confirmed', async () => {
    const event = await api<{ dateTbc: boolean; summary: string }>({ method: 'GET', path: '/public/events/hackathon' });
    expect(event.dateTbc).toBe(true);
    expect(event.summary.toLowerCase()).toContain('to be confirmed');
  });

  it('accepts an enquiry without delivering it', async () => {
    const result = await api<{ delivered: boolean }>({ method: 'POST', path: '/public/enquiries', body: { name: 'Sample Person', email: 'person@example.test', message: 'This is a long enough sample message.', consent: true, company: '' } });
    expect(result.delivered).toBe(false);
  });
});
