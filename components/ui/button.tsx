import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
	"inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 touch-manipulation [&>svg]:h-4 [&>svg]:w-4 [&>svg]:shrink-0",
	{
		variants: {
			variant: {
				default:
					"bg-primary text-primary-foreground shadow hover:bg-primary/90 active:bg-primary/80",
				destructive:
					"bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90 active:bg-destructive/80",
				outline:
					"border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground active:bg-accent/80",
				secondary:
					"bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80 active:bg-secondary/70",
				ghost: "hover:bg-accent hover:text-accent-foreground active:bg-accent/80",
				link: "text-primary underline-offset-4 hover:underline active:text-primary/80",
			},
			size: {
				default: "h-10 px-4 py-2 min-h-[40px]",
				sm: "h-9 rounded-md px-3 text-xs min-h-[36px]",
				lg: "h-11 rounded-md px-8 min-h-[44px]",
				icon: "h-10 w-10 min-h-[40px] min-w-[40px]",
			},
		},
		defaultVariants: {
			variant: "default",
			size: "default",
		},
	}
);

export interface ButtonProps
	extends React.ButtonHTMLAttributes<HTMLButtonElement>,
		VariantProps<typeof buttonVariants> {
	asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
	({ className, variant, size, asChild = false, ...props }, ref) => {
		const Comp = asChild ? Slot : "button";
		return (
			<Comp
				className={cn(buttonVariants({ variant, size, className }))}
				ref={ref}
				{...props}
				style={{
					WebkitTapHighlightColor: "transparent",
					...props.style,
				}}
			/>
		);
	}
);
Button.displayName = "Button";

export { Button, buttonVariants };
