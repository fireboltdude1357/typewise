import { cn } from "@/lib/utils";
import { typeStyle } from "@/lib/pokemon/type-styles";

export function TypePill({
  type,
  small = false,
  className,
}: {
  type: string;
  small?: boolean;
  className?: string;
}) {
  const colors = typeStyle(type);

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full border border-black/10 font-bold uppercase tracking-[0.08em]",
        small ? "h-5 px-2 text-[9px]" : "h-6 px-2.5 text-[10px]",
        className,
      )}
      style={{ background: colors.background, color: colors.foreground }}
    >
      {type}
    </span>
  );
}

