import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AccessDenied } from './AccessDenied.jsx';

describe('AccessDenied', () => {
  it('renders default title and message', () => {
    render(<AccessDenied />);
    expect(screen.getByRole('heading', { name: /access denied/i })).toBeInTheDocument();
    expect(screen.getByText(/do not have permission/i)).toBeInTheDocument();
  });

  it('renders custom message', () => {
    render(<AccessDenied message="Custom denial" />);
    expect(screen.getByText('Custom denial')).toBeInTheDocument();
  });
});
