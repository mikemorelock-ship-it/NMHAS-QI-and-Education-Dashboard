import { redirect } from "next/navigation";

// Upload functionality has been moved to the Data Entry page (Upload CSV tab).
// Redirect any bookmarks or stale links.
export default function UploadPage() {
  redirect("/admin/data-entry");
}
