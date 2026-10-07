import Markdown, { type Components, type ExtraProps } from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ComponentProps } from "react";
import { repoFromUrl, repoMeta } from "@/lib/repos";

type HastNode = ExtraProps["node"];

/** Repos linked anywhere inside a hast node, so list items can be filtered by repo. */
function reposIn(node: HastNode | undefined, found = new Set<string>()): Set<string> {
  if (!node) return found;
  if (node.tagName === "a" && typeof node.properties?.href === "string") {
    const repo = repoFromUrl(node.properties.href);
    if (repo) found.add(repo);
  }
  for (const child of node.children ?? []) {
    if (child.type === "element") reposIn(child, found);
  }
  return found;
}

const components: Components = {
  a({ node, href = "", children, ...rest }) {
    void node;
    const repo = repoFromUrl(href);
    const external = /^https?:/.test(href);
    return (
      <a
        href={href}
        {...rest}
        {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
        className={repo ? "ref" : undefined}
        style={repo ? ({ "--ref": repoMeta(repo).color } as React.CSSProperties) : undefined}
      >
        {children}
      </a>
    );
  },
  li({ node, children, ...rest }: ComponentProps<"li"> & ExtraProps) {
    const repos = [...reposIn(node)];
    return (
      <li {...rest} data-repos={repos.length ? repos.join(" ") : undefined}>
        {children}
      </li>
    );
  },
  tr({ node, children, ...rest }: ComponentProps<"tr"> & ExtraProps) {
    const repos = [...reposIn(node)];
    return (
      <tr {...rest} data-repos={repos.length ? repos.join(" ") : undefined}>
        {children}
      </tr>
    );
  },
  table({ node, children, ...rest }) {
    void node;
    return (
      <div className="table-wrap">
        <table {...rest}>{children}</table>
      </div>
    );
  },
};

export function Md({ children, className = "" }: { children: string; className?: string }) {
  return (
    <div className={`md ${className}`}>
      <Markdown remarkPlugins={[remarkGfm]} components={components}>
        {children}
      </Markdown>
    </div>
  );
}
