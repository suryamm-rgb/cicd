import { describe, expect, it } from 'vitest';
import { MESSAGE_MAX, validateContact } from './validation';

const valid = { name: 'Ada Lovelace', email: 'ada@example.com', message: 'Hello, this is a test.' };

describe('validateContact', () => {
  it('accepts valid input', () => {
    expect(validateContact(valid)).toEqual({});
  });

  it('requires a name of at least 2 characters', () => {
    expect(validateContact({ ...valid, name: ' a ' }).name).toMatch(/name/i);
  });

  it('requires an email', () => {
    expect(validateContact({ ...valid, email: '' }).email).toMatch(/enter your email/i);
  });

  it.each(['plainaddress', 'a@b', 'a b@example.com', '@example.com'])(
    'rejects malformed email %s',
    (email) => {
      expect(validateContact({ ...valid, email }).email).toMatch(/valid email/i);
    },
  );

  it('requires a message of at least 10 characters', () => {
    expect(validateContact({ ...valid, message: 'short' }).message).toMatch(/at least 10/);
  });

  it('rejects overly long messages', () => {
    const message = 'x'.repeat(MESSAGE_MAX + 1);
    expect(validateContact({ ...valid, message }).message).toMatch(/under/);
  });

  it('reports every invalid field at once', () => {
    expect(Object.keys(validateContact({ name: '', email: '', message: '' }))).toEqual([
      'name',
      'email',
      'message',
    ]);
  });
});
