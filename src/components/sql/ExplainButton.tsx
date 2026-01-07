import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { ChevronDown, Network } from "lucide-react";

export type ExplainType = "AST" | "SYNTAX" | "PLAN" | "PIPELINE";

interface ExplainButtonProps {
  onExplain: (type: ExplainType) => void;
  disabled?: boolean;
}

export function ExplainButton({ onExplain, disabled }: ExplainButtonProps) {
  return (
    <div className="flex items-center">
      <Button
        size="sm"
        variant="secondary"
        onClick={() => onExplain("PLAN")}
        disabled={disabled}
        className="rounded-r-none"
      >
        <Network className="w-4 h-4 mr-1" />
        Explain
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            size="sm"
            variant="secondary"
            disabled={disabled}
            className="rounded-l-none border-l-0 px-2 border-l border-primary/20"
          >
            <ChevronDown className="w-4 h-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => onExplain("PLAN")}>
            Explain Plan
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onExplain("PIPELINE")}>
            Explain Pipeline
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onExplain("AST")}>
            Explain AST
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onExplain("SYNTAX")}>
            Explain Syntax
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
