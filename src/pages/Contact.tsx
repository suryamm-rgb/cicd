import { useRef, useState, type ChangeEvent, type SubmitEvent } from 'react';
import { usePageMeta } from '../lib/usePageMeta';
import { validateContact, type ContactErrors, type ContactValues } from '../lib/validation';
import styles from './Contact.module.css';
import page from './Page.module.css';

const emptyValues: ContactValues = { name: '', email: '', message: '' };
const fieldOrder = ['name', 'email', 'message'] as const;

export function Contact() {
  usePageMeta('Contact', 'Get in touch with the cicd-showcase team using the contact form.');

  const [values, setValues] = useState<ContactValues>(emptyValues);
  const [errors, setErrors] = useState<ContactErrors>({});
  const [submitted, setSubmitted] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const errorCount = Object.keys(errors).length;

  function handleChange(event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const { name, value } = event.target;
    setValues((current) => ({ ...current, [name]: value }));
    setSubmitted(false);
  }

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const found = validateContact(values);
    setErrors(found);

    const firstInvalid = fieldOrder.find((field) => found[field]);
    if (firstInvalid) {
      setSubmitted(false);
      formRef.current?.querySelector<HTMLElement>(`[name="${firstInvalid}"]`)?.focus();
      return;
    }

    setValues(emptyValues);
    setSubmitted(true);
  }

  return (
    <>
      <h1>Contact</h1>
      <p className={page.lead}>
        Have a question or want to collaborate? Send us a message. This demo form has no backend, so
        nothing is stored or sent.
      </p>

      {submitted && (
        <p role="status" className={styles.success}>
          Thank you! Your message has been received.
        </p>
      )}

      {errorCount > 0 && (
        <p role="alert" className={styles.summary}>
          Please fix {errorCount} {errorCount === 1 ? 'error' : 'errors'} below and try again.
        </p>
      )}

      <form ref={formRef} className={styles.form} onSubmit={handleSubmit} noValidate>
        <div className={styles.field}>
          <label htmlFor="name">Name</label>
          <input
            id="name"
            name="name"
            type="text"
            autoComplete="name"
            value={values.name}
            onChange={handleChange}
            aria-invalid={errors.name ? true : undefined}
            aria-describedby={errors.name ? 'name-error' : undefined}
          />
          {errors.name && (
            <p id="name-error" className={styles.error}>
              {errors.name}
            </p>
          )}
        </div>

        <div className={styles.field}>
          <label htmlFor="email">Email</label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            value={values.email}
            onChange={handleChange}
            aria-invalid={errors.email ? true : undefined}
            aria-describedby={errors.email ? 'email-error' : undefined}
          />
          {errors.email && (
            <p id="email-error" className={styles.error}>
              {errors.email}
            </p>
          )}
        </div>

        <div className={styles.field}>
          <label htmlFor="message">Message</label>
          <textarea
            id="message"
            name="message"
            rows={6}
            value={values.message}
            onChange={handleChange}
            aria-invalid={errors.message ? true : undefined}
            aria-describedby={errors.message ? 'message-error' : undefined}
          />
          {errors.message && (
            <p id="message-error" className={styles.error}>
              {errors.message}
            </p>
          )}
        </div>

        <button type="submit" className={page.button}>
          Send message
        </button>
      </form>
    </>
  );
}
