import { HelpPageContent } from "@/components/help/HelpPageContent";

export default function PublicHelpPage() {
  return (
    <div className="p-4 md:p-8">
      <HelpPageContent portal="public" />
    </div>
  );
}
