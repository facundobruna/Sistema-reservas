import { exportCustomerData } from "@/features/privacy";
import { getDinerSession } from "@/lib/auth";
import { errorResponse, handleError, json } from "@/lib/http";

export async function GET(request: Request) {
  try {
    const session = await getDinerSession(request);
    if (!session) return errorResponse("unauthorized", "Missing diner session", 401);
    const exportData = await exportCustomerData(session.customerId);
    return json(exportData, {
      headers: {
        "content-disposition": `attachment; filename="mesa-clara-data-${session.customerId}.json"`
      }
    });
  } catch (error) {
    return handleError(error);
  }
}
