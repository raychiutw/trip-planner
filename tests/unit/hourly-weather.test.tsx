import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import HourlyWeather from '../../src/components/trip/HourlyWeather';
import {
  fetchWeatherForDay,
  makeDefaultMg,
  type MergedHourly,
  type WeatherDay,
} from '../../src/lib/weather';

vi.mock('../../src/lib/weather', async (importOriginal) => ({
  ...await importOriginal<typeof import('../../src/lib/weather')>(),
  fetchWeatherForDay: vi.fn(),
}));

const mockedFetchWeather = vi.mocked(fetchWeatherForDay);
const weatherDay: WeatherDay = {
  label: '沖繩',
  locations: [{ name: '首里城', lat: 26.217, lon: 127.719, start: 9 }],
};

function renderWeather(overrides: Partial<React.ComponentProps<typeof HourlyWeather>> = {}) {
  return render(
    <HourlyWeather
      dayId={1}
      dayNum={1}
      dayDate="2026-07-29"
      weatherDay={weatherDay}
      tripStart="2026-07-29"
      tripEnd="2026-08-02"
      timezone="Asia/Tokyo"
      {...overrides}
    />,
  );
}

describe('HourlyWeather', () => {
  beforeEach(() => {
    vi.setSystemTime(new Date('2026-07-27T12:00:00+08:00'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows the Flutter-aligned preview when no forecast location exists', () => {
    renderWeather({ weatherDay: null });

    expect(screen.getByText('天氣示意')).toBeInTheDocument();
    expect(screen.getByText(/28°C.*晴時多雲.*20%/)).toBeInTheDocument();
    expect(screen.getByText('尚無可用預報位置')).toBeInTheDocument();
    expect(mockedFetchWeather).not.toHaveBeenCalled();
  });

  it('cycles preview data by day number while the date is beyond 16 days', () => {
    renderWeather({ dayNum: 4, dayDate: '2026-08-20' });

    expect(screen.getByText(/26°C.*短暫陣雨.*40%/)).toBeInTheDocument();
    expect(screen.getByText('天氣預報將於出發前 16 天開放')).toBeInTheDocument();
    expect(mockedFetchWeather).not.toHaveBeenCalled();
  });

  it('keeps the preview visible when the day has no date', () => {
    renderWeather({ dayDate: undefined });

    expect(screen.getByText('天氣示意')).toBeInTheDocument();
    expect(screen.getByText('目前沒有可用預報')).toBeInTheDocument();
    expect(mockedFetchWeather).not.toHaveBeenCalled();
  });

  it('keeps preview information visible while updating', () => {
    mockedFetchWeather.mockReturnValue(new Promise(() => {}));

    renderWeather();

    expect(screen.getByText('正在更新預報')).toBeInTheDocument();
    expect(screen.getByText('天氣示意')).toBeInTheDocument();
  });

  it('shows the preview and aligned error text when loading fails', async () => {
    mockedFetchWeather.mockRejectedValue(new Error('network'));

    renderWeather();

    expect(await screen.findByText('暫時無法取得預報')).toBeInTheDocument();
    expect(screen.getByText('天氣示意')).toBeInTheDocument();
  });

  it('shows the preview when the provider returns no usable forecast', async () => {
    mockedFetchWeather.mockResolvedValue(makeDefaultMg());

    renderWeather();

    expect(await screen.findByText('目前沒有可用預報')).toBeInTheDocument();
    expect(screen.getByText('天氣示意')).toBeInTheDocument();
  });

  it('renders the live daily temperature and rain ranges', async () => {
    const data: MergedHourly = {
      temps: Array.from({ length: 24 }, (_, hour) => 24 + (hour % 8)),
      rains: Array.from({ length: 24 }, (_, hour) => 10 + (hour % 5) * 10),
      codes: Array(24).fill(1),
    };
    mockedFetchWeather.mockResolvedValue(data);

    renderWeather();

    expect(await screen.findByRole('button', { name: '展開天氣' })).toHaveTextContent('24~31°C');
    expect(screen.getByRole('button', { name: '展開天氣' })).toHaveTextContent('10~50%');
  });

  it('expands all 24 hours with the keyboard and exposes its state', async () => {
    mockedFetchWeather.mockResolvedValue({
      temps: Array(24).fill(28),
      rains: Array(24).fill(20),
      codes: Array(24).fill(1),
    });
    renderWeather();
    const toggle = await screen.findByRole('button', { name: '展開天氣' });

    fireEvent.keyDown(toggle, { key: 'Enter' });

    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: '收合天氣' })).toBeInTheDocument();
    expect(document.querySelectorAll('[data-hour]')).toHaveLength(24);
    expect(document.querySelector('[data-hour="0"]')).toHaveTextContent('0:00');
    expect(document.querySelector('[data-hour="23"]')).toHaveTextContent('23:00');
  });
});
