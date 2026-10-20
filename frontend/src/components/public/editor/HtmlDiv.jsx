import { useMemo } from "react";

// Stable __html object so React 19 does not reset innerHTML (and the caret) on every re-render while editing.
export const HtmlDiv = ({ html, ...props }) => {
  const inner = useMemo(() => ({ __html: html || "" }), [html]);
  return <div {...props} dangerouslySetInnerHTML={inner} />;
};
