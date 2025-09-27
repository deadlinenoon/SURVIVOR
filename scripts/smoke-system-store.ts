import { readDashboard, writeDashboard } from '../lib/system-store';

(async () => {
  console.log('token?', !!process.env.BLOB_READ_WRITE_TOKEN);
  const dashboard = await readDashboard();
  console.log('read ok', dashboard.note ?? '');
  const updated = {
    ...dashboard,
    note: {
      message: 'smoke',
      updatedAt: new Date().toISOString(),
    },
  };
  await writeDashboard(updated);
  console.log('write ok');
})();
