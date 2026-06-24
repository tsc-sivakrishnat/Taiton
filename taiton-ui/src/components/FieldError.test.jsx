import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FieldError } from './FieldError.jsx';

describe('FieldError', () => {
  it('renders nothing when message empty', () => {
    const { container } = render(<FieldError message="" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders alert with message', () => {
    render(<FieldError message="Email is required." />);
    expect(screen.getByRole('alert')).toHaveTextContent('Email is required.');
  });
});
