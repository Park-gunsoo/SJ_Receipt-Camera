import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { apiError, AppError, boundedJson, json, sameOrigin } from "@/lib/http";

export async function PATCH(request: Request) {
  try {
    sameOrigin(request);
    const user = await requireUser();
    if (request.headers.get("x-sj-owner") !== user.id) throw new AppError("ACCOUNT_CHANGED", 409);
    const input = z.strictObject({ backupEnabled: z.boolean() }).safeParse(await boundedJson(request, 1024));
    if (!input.success) throw new AppError("INVALID_INPUT", 422);
    if (!user.drive) throw new AppError("DRIVE_RECONNECT", 409);
    if (input.data.backupEnabled && user.drive.status !== "CONNECTED") throw new AppError("DRIVE_RECONNECT", 409);
    const result = await db().driveConnection.update({ where: { userId: user.id }, data: { backupEnabled: input.data.backupEnabled }, select: { backupEnabled: true } });
    return json(result);
  } catch (error) { return apiError(error); }
}
