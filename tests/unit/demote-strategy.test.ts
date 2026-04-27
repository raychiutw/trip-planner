import { describe, expect, it, vi } from 'vitest';
import { demoteEntry, DemoteValidationError, type DemoteApi } from '../../src/lib/demote-strategy';

function createApi(overrides: Partial<DemoteApi> = {}): DemoteApi {
  return {
    deleteEntry: vi.fn().mockResolvedValue(undefined),
    clearPromotedIdea: vi.fn().mockResolvedValue(undefined),
    createIdea: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('demoteEntry', () => {
  it('promoted entry：DELETE entry + PATCH 原 idea promoted_to_entry_id=null', async () => {
    const api = createApi();
    await demoteEntry(
      { tripId: 'okinawa', entryId: 42, sourceIdeaId: 7, title: '美ら海' },
      api,
    );
    expect(api.deleteEntry).toHaveBeenCalledWith('okinawa', 42);
    expect(api.clearPromotedIdea).toHaveBeenCalledWith(7);
    expect(api.createIdea).not.toHaveBeenCalled();
  });

  it('native entry：DELETE entry + POST 新 idea，保留 poi_id / title / note', async () => {
    const api = createApi();
    await demoteEntry(
      { tripId: 'okinawa', entryId: 99, title: '隨便加的景點', poiId: 555, note: '備註' },
      api,
    );
    expect(api.deleteEntry).toHaveBeenCalledWith('okinawa', 99);
    expect(api.clearPromotedIdea).not.toHaveBeenCalled();
    expect(api.createIdea).toHaveBeenCalledWith({
      tripId: 'okinawa',
      title: '隨便加的景點',
      poiId: 555,
      note: '備註',
    });
  });

  it('native entry 無 title → throw DemoteValidationError，不呼叫任何 API', async () => {
    const api = createApi();
    await expect(
      demoteEntry({ tripId: 'okinawa', entryId: 99, title: '   ' }, api),
    ).rejects.toBeInstanceOf(DemoteValidationError);
    expect(api.deleteEntry).not.toHaveBeenCalled();
  });

  it('entryId 必須是正整數', async () => {
    const api = createApi();
    await expect(
      demoteEntry({ tripId: 'okinawa', entryId: 0, sourceIdeaId: 1 }, api),
    ).rejects.toBeInstanceOf(DemoteValidationError);
  });

  it('tripId 必填', async () => {
    const api = createApi();
    await expect(
      demoteEntry({ tripId: '', entryId: 42, sourceIdeaId: 7 }, api),
    ).rejects.toBeInstanceOf(DemoteValidationError);
  });
});
