import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from './App';

const product = { id: 1, sku: 'HUB-1', name: 'USB Hub', category: 'Electronics', unit_price: '100.00', quantity: 2, reorder_level: 5 };
function mockApi({ rejectWrite = false } = {}) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, options = {}) => {
    if (options.method && options.method !== 'GET') return { ok: !rejectWrite, status: rejectWrite ? 409 : 201, json: async () => rejectWrite ? { detail: 'Insufficient stock' } : product };
    const bodies = { '/api/products': [product], '/api/movements': [], '/api/dashboard': { product_count: 1, total_units: 2, inventory_value: '200.00', low_stock_count: 1 }, '/api/version': { commit: 'abcdef1234567890' } };
    return { ok: true, status: 200, json: async () => bodies[url] };
  });
}

test('renders inventory and deployed commit', async () => {
  mockApi(); render(<App />);
  expect(await screen.findByText('abcdef12')).toBeInTheDocument();
  expect(screen.getByText('Product inventory')).toBeInTheDocument();
});

test('creates a product through the API', async () => {
  const fetchMock = mockApi(); render(<App />);
  await screen.findByText('abcdef12'); fireEvent.click(screen.getByText('＋ Add product'));
  fireEvent.change(screen.getByLabelText('SKU'), { target: { value: 'NEW-1' } });
  fireEvent.change(screen.getByLabelText('Category'), { target: { value: 'Office' } });
  fireEvent.change(screen.getByLabelText('Product name'), { target: { value: 'Notebook' } });
  fireEvent.click(screen.getByText('Save product'));
  await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/products', expect.objectContaining({ method: 'POST', body: expect.stringContaining('Notebook') })));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
});

test('issues stock with negative delta', async () => {
  const fetchMock = mockApi(); render(<App />); await screen.findByText('abcdef12');
  fireEvent.click(screen.getByText('Stock ⇄'));
  fireEvent.change(screen.getByLabelText('Movement type'), { target: { value: 'ISSUE' } });
  fireEvent.change(screen.getByLabelText('Units'), { target: { value: '2' } });
  fireEvent.change(screen.getByLabelText('Reason'), { target: { value: 'Demo issue' } });
  fireEvent.click(screen.getByText('Record movement'));
  await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/products/1/movements', expect.objectContaining({ method: 'POST', body: JSON.stringify({ delta: -2, kind: 'ISSUE', reason: 'Demo issue' }) })));
});

test('keeps stock dialog open when API rejects movement', async () => {
  mockApi({ rejectWrite: true }); render(<App />); await screen.findByText('abcdef12');
  fireEvent.click(screen.getByText('Stock ⇄'));
  fireEvent.change(screen.getByLabelText('Reason'), { target: { value: 'Test' } });
  fireEvent.click(screen.getByText('Record movement'));
  expect(await screen.findByRole('alert')).toHaveTextContent('Insufficient stock');
  expect(screen.getByRole('dialog')).toBeInTheDocument();
});

test('product form declares required and nonnegative fields', async () => {
  mockApi(); render(<App />); await screen.findByText('abcdef12');
  fireEvent.click(screen.getByText('＋ Add product'));
  expect(screen.getByLabelText('Product name')).toBeRequired();
  expect(screen.getByLabelText('Unit price (INR)')).toHaveAttribute('min', '0');
  expect(screen.getByLabelText('SKU')).toHaveAttribute('pattern', '[A-Za-z0-9_-]+');
});

test('shows backend error and retry', async () => {
  vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Backend unavailable'));
  render(<App />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Backend unavailable');
  expect(screen.getByText('Retry')).toBeInTheDocument();
});

test('search filters the catalog', async () => {
  mockApi(); render(<App />); await screen.findByText('abcdef12');
  fireEvent.change(screen.getByLabelText('Search products'), { target: { value: 'missing' } });
  expect(screen.getByText('No products match your filters.')).toBeInTheDocument();
});
