/**
 * Inline script — ustawia data-font-scale na <html> natychmiast z localStorage,
 * zapobiegając FOUC (flash of unstyled content) przed hydracją React.
 *
 * Renderowany w <head> przed <body>.
 */
export function FontScaleScript() {
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `(function(){try{var s=localStorage.getItem("fontScale");if(s==="large"||s==="xlarge"){document.documentElement.setAttribute("data-font-scale",s);}}catch(e){}})();`,
      }}
    />
  );
}
