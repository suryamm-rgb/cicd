export interface ContactValues {
  name: string;
  email: string;
  message: string;
}

export type ContactErrors = Partial<Record<keyof ContactValues, string>>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const MESSAGE_MIN = 10;
export const MESSAGE_MAX = 1000;

export function validateContact(values: ContactValues): ContactErrors {
  const errors: ContactErrors = {};
  const name = values.name.trim();
  const email = values.email.trim();
  const message = values.message.trim();

  if (name.length < 2) {
    errors.name = 'Enter your name (at least 2 characters).';
  }

  if (email === '') {
    errors.email = 'Enter your email address.';
  } else if (!EMAIL_PATTERN.test(email)) {
    errors.email = 'Enter a valid email address, for example name@example.com.';
  }

  if (message.length < MESSAGE_MIN) {
    errors.message = `Enter a message of at least ${String(MESSAGE_MIN)} characters.`;
  } else if (message.length > MESSAGE_MAX) {
    errors.message = `Keep your message under ${String(MESSAGE_MAX)} characters.`;
  }

  return errors;
}
