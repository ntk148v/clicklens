import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface AccessDeniedProps {
  title?: string;
  message?: string;
  description?: string;
  actionLabel?: string;
  actionHref?: string;
}

export function AccessDenied({
  title = "Access Denied",
  message = "You do not have permission to view this page.",
  description,
  actionLabel = "Return Home",
  actionHref = "/",
}: AccessDeniedProps) {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center bg-muted/20 rounded-lg border border-border max-w-lg mx-auto mt-12">
      <div className="p-3 rounded-full bg-destructive/10 mb-4">
        <ShieldAlert className="w-8 h-8 text-destructive" />
      </div>
      <h2 className="text-xl font-bold tracking-tight mb-2">{title}</h2>
      <p className="text-muted-foreground mb-2">{message}</p>
      {description && (
        <p className="text-sm text-muted-foreground/80 mb-6">{description}</p>
      )}
      <Button asChild variant="outline" className="mt-2">
        <Link href={actionHref}>{actionLabel}</Link>
      </Button>
    </div>
  );
}
