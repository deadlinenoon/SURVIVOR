import React from 'react';
import { render, screen } from '@testing-library/react';
import GameFieldCard, { type GameFieldCardProps } from '@/components/GameFieldCard';

type Props = GameFieldCardProps;

const baseProps: Props = {
  kickoff: 'Sun 8:20 ET',
  away: { name: 'Green Bay Packers', logo: '/logos/gb.png' },
  home: { name: 'Buffalo Bills', logo: '/logos/buf.png' },
  favorite: 'home',
  spread: 6.5,
  total: 43.5,
  weather: {
    tempF: 30,
    windSpeedMph: 12,
    windDirDeg: 45,
    precipType: 'rain',
    precipIntensity: 0.6,
    thunderstorm: false,
    indoor: false,
  },
  venue: {
    name: 'Highmark Stadium',
    city: 'Orchard Park',
    state: 'NY',
    orientationDeg: 90,
  },
};

describe('GameFieldCard', () => {
  it('renders matchup teams, kickoff, and betting lines', () => {
    render(<GameFieldCard {...baseProps} />);

    expect(screen.getByText('Green Bay Packers')).toBeInTheDocument();
    expect(screen.getByText('Buffalo Bills')).toBeInTheDocument();
    expect(screen.getByText(baseProps.kickoff)).toBeInTheDocument();

    expect(screen.getByText('Spread')).toBeInTheDocument();
    expect(screen.getByText('-6.5')).toBeInTheDocument();
    expect(screen.getByText('Total')).toBeInTheDocument();
    expect(screen.getByText('43.5')).toBeInTheDocument();
    expect(screen.getByText('+6.5')).toBeInTheDocument();

    expect(screen.getByText(/Highmark Stadium/)).toBeInTheDocument();
    expect(screen.getByText(/🌡 30°F/)).toBeInTheDocument();
  });

  it('shows wind direction icon outdoors and hides it indoors', () => {
    const { rerender } = render(<GameFieldCard {...baseProps} />);
    expect(screen.getByRole('img', { name: /Wind direction and strength/i })).toBeInTheDocument();

    rerender(
      <GameFieldCard
        {...baseProps}
        weather={{
          ...baseProps.weather,
          indoor: true,
        }}
      />,
    );
    expect(screen.queryByRole('img', { name: /Wind direction and strength/i })).toBeNull();
  });

  it('renders rain and snow overlays based on precip type and intensity', () => {
    const { rerender, container } = render(<GameFieldCard {...baseProps} />);
    expect(container.querySelectorAll('[style*="raindrop"]').length).toBeGreaterThan(0);

    rerender(
      <GameFieldCard
        {...baseProps}
        weather={{ ...baseProps.weather, precipType: 'snow', precipIntensity: 0.8 }}
      />,
    );
    expect(container.querySelectorAll('[style*="snowfall"]').length).toBeGreaterThan(0);

    rerender(
      <GameFieldCard
        {...baseProps}
        weather={{ ...baseProps.weather, precipType: 'rain', precipIntensity: 0 }}
      />,
    );
    expect(container.querySelectorAll('[style*="raindrop"]').length).toBe(0);
  });

  it('shows thunderstorm delay overlay when thunderstorm is true', () => {
    render(
      <GameFieldCard
        {...baseProps}
        weather={{ ...baseProps.weather, thunderstorm: true }}
      />,
    );
    expect(screen.getByText(/Game Delayed/i)).toBeInTheDocument();
  });
});
