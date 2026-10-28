import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { Contact } from './Contact';

describe('Contact form', () => {
  it('shows an error for every invalid field and focuses the first one', async () => {
    const user = userEvent.setup();
    render(<Contact />);

    await user.click(screen.getByRole('button', { name: /send message/i }));

    expect(screen.getByRole('alert')).toHaveTextContent('Please fix 3 errors');
    expect(screen.getByLabelText('Name')).toBeInvalid();
    expect(screen.getByLabelText('Name')).toHaveFocus();
    expect(screen.getByLabelText('Name')).toHaveAccessibleDescription(/enter your name/i);
    expect(screen.getByLabelText('Email')).toHaveAccessibleDescription(/enter your email/i);
    expect(screen.getByLabelText('Message')).toHaveAccessibleDescription(/at least 10/i);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('uses the singular when there is a single error', async () => {
    const user = userEvent.setup();
    render(<Contact />);

    await user.type(screen.getByLabelText('Name'), 'Ada');
    await user.type(screen.getByLabelText('Email'), 'not-an-email');
    await user.type(screen.getByLabelText('Message'), 'A long enough message.');
    await user.click(screen.getByRole('button', { name: /send message/i }));

    expect(screen.getByRole('alert')).toHaveTextContent('Please fix 1 error ');
    expect(screen.getByLabelText('Email')).toHaveAccessibleDescription(/valid email/i);
    expect(screen.getByLabelText('Email')).toHaveFocus();
  });

  it('shows a success message and resets the form for valid input', async () => {
    const user = userEvent.setup();
    render(<Contact />);

    await user.type(screen.getByLabelText('Name'), 'Ada Lovelace');
    await user.type(screen.getByLabelText('Email'), 'ada@example.com');
    await user.type(screen.getByLabelText('Message'), 'Hello, this is a valid message.');
    await user.click(screen.getByRole('button', { name: /send message/i }));

    expect(screen.getByRole('status')).toHaveTextContent(/thank you/i);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toHaveValue('');
  });

  it('clears the success message when the user starts typing again', async () => {
    const user = userEvent.setup();
    render(<Contact />);

    await user.type(screen.getByLabelText('Name'), 'Ada Lovelace');
    await user.type(screen.getByLabelText('Email'), 'ada@example.com');
    await user.type(screen.getByLabelText('Message'), 'Hello, this is a valid message.');
    await user.click(screen.getByRole('button', { name: /send message/i }));
    await user.type(screen.getByLabelText('Name'), 'B');

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
