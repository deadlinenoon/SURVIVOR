import { SpeedInsights } from '@vercel/speed-insights/next';

export default function SpeedInsightsProd() {
  if (process.env.NODE_ENV !== 'production') return null;
  return <SpeedInsights />;
}
