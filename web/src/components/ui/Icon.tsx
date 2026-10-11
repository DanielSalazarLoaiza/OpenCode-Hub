import type { Icon as IconsaxIcon } from "iconsax-react";

/**
 * Iconsax Linear wrapper. iconsax-react relies on `defaultProps`, which
 * React 19 ignores on function components — so every icon MUST receive
 * explicit variant/color/size. Color flows from `currentColor`.
 */
export function Icon({
  icon: Cmp,
  size = 16,
  className,
}: {
  icon: IconsaxIcon;
  size?: number;
  className?: string;
}) {
  return (
    <Cmp
      variant="Linear"
      color="currentColor"
      size={size}
      className={className}
      aria-hidden="true"
    />
  );
}
