import { currentUser } from "@/lib/auth";
import { configuration } from "@/lib/config";
import { apiError, json } from "@/lib/http";
export async function GET() {
  try {
    const user = await currentUser();
    const config = configuration();
    return json({ configured: config.ready, loginReady: config.loginReady, user: user ? { id: user.id, name: user.name, email: user.email } : null, drive: user?.drive ? { status: user.drive.status, backupEnabled: user.drive.backupEnabled, folderUrl: user.drive.rootFolderId ? `https://drive.google.com/drive/folders/${user.drive.rootFolderId}` : null } : null });
  } catch (error) { return apiError(error); }
}
