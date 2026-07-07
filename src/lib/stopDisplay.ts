type StopDisplayInput = {
  title?: string | null;
  poiName?: string | null;
  poiType?: string | null;
};

type TimelineDisplayInput = {
  title?: string | null;
  displayTitle?: string | null;
};

const GENERIC_MEAL_TITLE_RE =
  /^(早餐|早午餐|午餐|晚餐|宵夜|用餐|餐廳|餐厅|breakfast|brunch|lunch|dinner|supper|meal|restaurant)$/i;

function clean(value?: string | null): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function isGenericMealStopTitle(title?: string | null): boolean {
  const normalized = clean(title);
  return normalized ? GENERIC_MEAL_TITLE_RE.test(normalized) : false;
}

export function getStopDisplayTitle(input: StopDisplayInput): string | null {
  const poiName = clean(input.poiName);
  return poiName;
}

export function getTimelineEntryDisplayTitle(entry: TimelineDisplayInput): string {
  return clean(entry.displayTitle) ?? '（未選擇景點）';
}
