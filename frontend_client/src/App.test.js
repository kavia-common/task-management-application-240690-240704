import { render, screen } from '@testing-library/react';
import App from './App';

test('renders retro to-do header', () => {
  render(<App />);
  expect(screen.getByText(/retro task terminal/i)).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: /to-do/i })).toBeInTheDocument();
});
