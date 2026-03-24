import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Page from '../app/page';

describe('App smoke test', () => {
  it('renders the main page without crashing', () => {
    render(<Page />);
    expect(screen.getByText(/SignalCraft/i)).toBeInTheDocument();
  });
});
