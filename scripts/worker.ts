import "dotenv/config";
import { registerNotificationWorker, processDueNotifications } from "../src/features/notifications";

async function main() {
  const queue = await registerNotificationWorker();
  if (queue) {
    console.log("pg-boss notification worker started");
    return;
  }

  console.log("ENABLE_PG_BOSS is not true; polling due notifications every 30s");
  await processDueNotifications();
  setInterval(() => {
    processDueNotifications().catch((error) => console.error(error));
  }, 30_000);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
