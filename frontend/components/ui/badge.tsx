import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

const badgeVariants = cva(
  "group/badge inline-flex h-[22px] w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-md border border-transparent px-2 text-xs font-medium whitespace-nowrap transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 aria-invalid:border-destructive [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default: "bg-primary/10 text-primary border-primary/15 dark:bg-primary/15 [a]:hover:bg-primary/15",
        solid: "bg-primary text-primary-foreground [a]:hover:bg-primary/90",
        secondary:
          "bg-secondary text-secondary-foreground border-border/60 [a]:hover:bg-secondary/80",
        success: "bg-success/10 text-success border-success/20 dark:bg-success/15",
        warning: "bg-warning/10 text-warning border-warning/25 dark:bg-warning/15",
        info: "bg-info/10 text-info border-info/20 dark:bg-info/15",
        destructive:
          "bg-destructive/10 text-destructive border-destructive/20 dark:bg-destructive/15 [a]:hover:bg-destructive/20",
        outline:
          "border-border bg-background/60 text-foreground [a]:hover:bg-muted",
        ghost:
          "text-muted-foreground hover:bg-muted",
        link: "text-primary underline-offset-4 hover:underline",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ variant }), className),
      },
      props
    ),
    render,
    state: {
      slot: "badge",
      variant,
    },
  })
}

export { Badge, badgeVariants }
