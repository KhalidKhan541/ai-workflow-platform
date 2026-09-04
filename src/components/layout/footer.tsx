import * as React from "react";
import { cn } from "@/lib/utils";

interface FooterProps {
  children?: React.ReactNode;
  className?: string;
}

function Footer({ children, className }: FooterProps) {
  return (
    <footer className={cn("border-t bg-card py-6", className)}>
      {children}
    </footer>
  );
}

interface FooterContentProps {
  children: React.ReactNode;
  className?: string;
}

function FooterContent({ children, className }: FooterContentProps) {
  return (
    <div className={cn("container mx-auto px-4", className)}>
      {children}
    </div>
  );
}

interface FooterLinksProps {
  groups: {
    title: string;
    links: { label: string; href: string }[];
  }[];
  className?: string;
}

function FooterLinks({ groups, className }: FooterLinksProps) {
  return (
    <div className={cn("grid grid-cols-2 gap-8 md:grid-cols-4", className)}>
      {groups.map((group) => (
        <div key={group.title}>
          <h3 className="text-sm font-semibold text-foreground mb-3">{group.title}</h3>
          <ul className="space-y-2">
            {group.links.map((link) => (
              <li key={link.label}>
                <a
                  href={link.href}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

interface FooterBottomProps {
  copyright?: string;
  links?: { label: string; href: string }[];
  className?: string;
}

function FooterBottom({ copyright, links, className }: FooterBottomProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-between gap-4 border-t pt-6 md:flex-row",
        className
      )}
    >
      {copyright && (
        <p className="text-sm text-muted-foreground">{copyright}</p>
      )}
      {links && (
        <div className="flex items-center gap-4">
          {links.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {link.label}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

interface FooterBrandProps {
  logo: React.ReactNode;
  name: string;
  description?: string;
  className?: string;
}

function FooterBrand({ logo, name, description, className }: FooterBrandProps) {
  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center gap-2">
        {logo}
        <span className="text-lg font-bold">{name}</span>
      </div>
      {description && (
        <p className="text-sm text-muted-foreground max-w-xs">{description}</p>
      )}
    </div>
  );
}

export { Footer, FooterContent, FooterLinks, FooterBottom, FooterBrand };
