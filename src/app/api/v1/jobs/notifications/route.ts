import { processDueNotifications } from "@/features/notifications";
import { errorResponse, handleError, json } from "@/lib/http";

export async function POST(request: Request) {
  try {
    const secret = process.env.JOBS_SECRET;
    if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
      return errorResponse("unauthorized", "Invalid jobs secret", 401);
    }
    const results = await processDueNotifications();
    return json({ results });
  } catch (error) {
    return handleError(error);
  }
}
