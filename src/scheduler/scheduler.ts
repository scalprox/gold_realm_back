import cron from "node-cron";
import { update_mine_emission } from "../games/trip";

cron.schedule("*/15 * * * *", async () => {
  // every 15min
  try {
    await update_mine_emission();
  } catch (error) {
    console.error(error);
  }
});
