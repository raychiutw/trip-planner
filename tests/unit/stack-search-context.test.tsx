import { expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { useStackSearchParams } from '../../src/hooks/useStackSearchParams';

function View({ explicit = false }: { explicit?: boolean }) {
  const [params, setParams] = useStackSearchParams(); const location = useLocation();
  return <><button onClick={() => { const next = new URLSearchParams(params); next.set('day', '2'); setParams(next, explicit ? { replace: true, state: null } : { replace: true }); }}>Change day</button>
    <output>{JSON.stringify({ path: location.pathname + location.search + location.hash, state: location.state })}</output></>;
}
for (const explicit of [false, true]) it(`query update preserves the anchor and respects explicit state=${explicit}`, () => {
  render(<MemoryRouter initialEntries={[{ pathname: '/trip/t/add-entry', search: '?keep=a%26b', hash: '#entry', state: { depth: 2, opStacked: true, scrollAnchor: 'one-use' } }]}><View explicit={explicit} /></MemoryRouter>);
  fireEvent.click(screen.getByText('Change day'));
  expect(screen.getByRole('status').textContent).toBe(JSON.stringify({ path: '/trip/t/add-entry?keep=a%26b&day=2#entry', state: explicit ? null : { depth: 2, opStacked: true } }));
});
